import { Candle, Timeframe } from '../types';
import { HistoricalReplayEngine, ReplayConfig } from './historicalReplayEngine';
import { FilterAblationConfig } from './signalDecisionEngine';

export interface AblationScenarioResult {
  scenarioId: string;
  name: string;
  filterDisabled: string;
  config: FilterAblationConfig;
  signalsCount: number;
  tradesCount: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  averageR: number;
  netPnlUsd: number;
  verdict: 'CRITICAL_PROTECTOR' | 'HARMFUL_DRAG' | 'NEUTRAL_FILTER';
  verdictReason: string;
}

export interface FilterAblationReport {
  asset: string;
  timeframe: Timeframe;
  totalCandles: number;
  baseline: AblationScenarioResult;
  scenarios: AblationScenarioResult[];
  summaryConclusion: string;
}

export class FilterAblationEngine {
  /**
   * Evaluates the marginal utility of each risk and structural filter.
   * Compares the baseline (all filters active) against scenarios with individual filters disabled.
   */
  public static runAblation(candles: Candle[], userConfig: ReplayConfig): FilterAblationReport {
    const definitions: {
      id: string;
      name: string;
      filterDisabled: string;
      config: FilterAblationConfig;
    }[] = [
      {
        id: 'baseline',
        name: 'Baseline (All Filters Active)',
        filterDisabled: 'None',
        config: {},
      },
      {
        id: 'without_mtf',
        name: 'Without MTF Alignment Filter',
        filterDisabled: 'MTF Alignment (Higher TF confirmation)',
        config: { skipMtfFilter: true },
      },
      {
        id: 'without_volatility',
        name: 'Without Extreme Volatility Filter',
        filterDisabled: 'ATR Volatility Gate (>5.5% ATR)',
        config: { skipVolatilityFilter: true },
      },
      {
        id: 'without_rr',
        name: 'Without R:R Gate (R:R < 1.5)',
        filterDisabled: 'Minimum Risk/Reward Threshold',
        config: { skipRiskRewardFilter: true },
      },
      {
        id: 'without_structure',
        name: 'Without Market Structure Filter',
        filterDisabled: 'Structural Swing Verification',
        config: { skipStructureFilter: true },
      },
      {
        id: 'without_momentum',
        name: 'Without Momentum Filter (RSI/MACD)',
        filterDisabled: 'Momentum Alignment Threshold',
        config: { skipMomentumFilter: true },
      },
      {
        id: 'without_resistance',
        name: 'Without S/R Proximity Filter',
        filterDisabled: 'Resistance/Support Proximity Penalty (<0.6%)',
        config: { skipResistanceFilter: true },
      },
    ];

    const results: AblationScenarioResult[] = [];
    let baselineResult: AblationScenarioResult | null = null;

    for (const def of definitions) {
      const replay = HistoricalReplayEngine.runReplay(candles, {
        ...userConfig,
        ablation: def.config,
      });

      const entry: AblationScenarioResult = {
        scenarioId: def.id,
        name: def.name,
        filterDisabled: def.filterDisabled,
        config: def.config,
        signalsCount: replay.totalSignalsGenerated,
        tradesCount: replay.totalTradesExecuted,
        winRate: replay.winRate,
        expectancyR: replay.expectancyR,
        profitFactor: replay.profitFactor,
        maxDrawdownPercent: replay.maxDrawdownPercent,
        averageR: replay.averageR,
        netPnlUsd: replay.netPnlUsd,
        verdict: 'NEUTRAL_FILTER',
        verdictReason: '',
      };

      if (def.id === 'baseline') {
        baselineResult = entry;
      }
      results.push(entry);
    }

    if (!baselineResult) {
      throw new Error('Baseline scenario execution failed');
    }

    // Assess marginal impact against baseline
    for (const res of results) {
      if (res.scenarioId === 'baseline') {
        res.verdict = 'NEUTRAL_FILTER';
        res.verdictReason = 'Эталонная конфигурация со всеми институциональными фильтрами.';
        continue;
      }

      const ddDiff = res.maxDrawdownPercent - baselineResult.maxDrawdownPercent;
      const expDiff = res.expectancyR - baselineResult.expectancyR;
      const tradeCountDiff = res.tradesCount - baselineResult.tradesCount;

      if (ddDiff > 5.0 || expDiff < -0.15) {
        res.verdict = 'CRITICAL_PROTECTOR';
        res.verdictReason = `Фильтр защищает капитал: без него просадка выросла на +${ddDiff.toFixed(1)}% или матожидание снизилось на ${expDiff.toFixed(2)} R.`;
      } else if (tradeCountDiff > 0 && expDiff > 0.05 && ddDiff <= 2.0) {
        res.verdict = 'HARMFUL_DRAG';
        res.verdictReason = `Фильтр излишне консервативен: без него матожидание улучшилось на +${expDiff.toFixed(2)} R при контроле просадки.`;
      } else {
        res.verdict = 'NEUTRAL_FILTER';
        res.verdictReason = 'Фильтр оказывает умеренное влияние на баланс риска и доходности.';
      }
    }

    const protectors = results.filter((r) => r.verdict === 'CRITICAL_PROTECTOR').map((r) => r.filterDisabled);
    const drags = results.filter((r) => r.verdict === 'HARMFUL_DRAG').map((r) => r.filterDisabled);

    let summaryConclusion = 'Все фильтры сбалансированы.';
    if (protectors.length > 0) {
      summaryConclusion = `Ключевые защитные фильтры: [${protectors.join(', ')}]. Их отключение приводит к росту просадки.`;
    }
    if (drags.length > 0) {
      summaryConclusion += ` Рекомендуется калибровка следующих фильтров: [${drags.join(', ')}].`;
    }

    return {
      asset: userConfig.asset,
      timeframe: userConfig.timeframe,
      totalCandles: candles.length,
      baseline: baselineResult,
      scenarios: results,
      summaryConclusion,
    };
  }

  /**
   * Phase 5A Ablation: Compares Adaptive Engine Baseline with Static Fallbacks
   * (Static Weights, Static MTF, Static SL/TP) and Core Risk Gates.
   */
  public static runPhase5Ablation(candles: Candle[], userConfig: ReplayConfig): FilterAblationReport {
    const definitions: {
      id: string;
      name: string;
      filterDisabled: string;
      config: FilterAblationConfig;
    }[] = [
      {
        id: 'adaptive_baseline',
        name: 'Phase 5A Adaptive Baseline',
        filterDisabled: 'None',
        config: {},
      },
      {
        id: 'static_weights',
        name: 'Static Weights Fallback',
        filterDisabled: 'Dynamic Regime-Aware Weighting',
        config: { useStaticWeights: true },
      },
      {
        id: 'static_mtf',
        name: 'Static MTF Fallback',
        filterDisabled: 'Hierarchical MTF Alignment Penalty',
        config: { useStaticMtf: true },
      },
      {
        id: 'static_sl',
        name: 'Static Fixed Stop Loss',
        filterDisabled: 'Dynamic Structural Regime Stop Loss',
        config: { useStaticSl: true },
      },
      {
        id: 'without_volatility',
        name: 'Without Volatility Filter',
        filterDisabled: 'Extreme Volatility Gate',
        config: { skipVolatilityFilter: true },
      },
      {
        id: 'without_rr',
        name: 'Without R:R Gate',
        filterDisabled: 'Minimum Risk/Reward Gate',
        config: { skipRiskRewardFilter: true },
      },
    ];

    const results: AblationScenarioResult[] = [];
    let baselineResult: AblationScenarioResult | null = null;

    for (const def of definitions) {
      const replay = HistoricalReplayEngine.runReplay(candles, {
        ...userConfig,
        useAdaptiveEngine: true,
        ablation: def.config,
      });

      const entry: AblationScenarioResult = {
        scenarioId: def.id,
        name: def.name,
        filterDisabled: def.filterDisabled,
        config: def.config,
        signalsCount: replay.totalSignalsGenerated,
        tradesCount: replay.totalTradesExecuted,
        winRate: replay.winRate,
        expectancyR: replay.expectancyR,
        profitFactor: replay.profitFactor,
        maxDrawdownPercent: replay.maxDrawdownPercent,
        averageR: replay.averageR,
        netPnlUsd: replay.netPnlUsd,
        verdict: 'NEUTRAL_FILTER',
        verdictReason: '',
      };

      if (def.id === 'adaptive_baseline') {
        baselineResult = entry;
      }
      results.push(entry);
    }

    if (!baselineResult) {
      throw new Error('Baseline scenario execution failed');
    }

    for (const res of results) {
      if (res.scenarioId === 'adaptive_baseline') {
        res.verdict = 'NEUTRAL_FILTER';
        res.verdictReason = 'Эталонная адаптивная архитектура Phase 5A со всеми динамическими профилями.';
        continue;
      }

      const ddDiff = res.maxDrawdownPercent - baselineResult.maxDrawdownPercent;
      const expDiff = res.expectancyR - baselineResult.expectancyR;
      const tradeCountDiff = res.tradesCount - baselineResult.tradesCount;

      if (ddDiff > 3.0 || expDiff < -0.10) {
        res.verdict = 'CRITICAL_PROTECTOR';
        res.verdictReason = `Компонент защищает капитал: при откате к статике просадка выросла на +${ddDiff.toFixed(1)}% или матожидание упало на ${expDiff.toFixed(2)} R.`;
      } else if (tradeCountDiff > 0 && expDiff > 0.05 && ddDiff <= 1.5) {
        res.verdict = 'HARMFUL_DRAG';
        res.verdictReason = `Компонент излишне строг: без него матожидание улучшилось на +${expDiff.toFixed(2)} R.`;
      } else {
        res.verdict = 'NEUTRAL_FILTER';
        res.verdictReason = 'Компонент обеспечивает стабильность метрик на данном историческом участке.';
      }
    }

    return {
      asset: userConfig.asset,
      timeframe: userConfig.timeframe,
      totalCandles: candles.length,
      baseline: baselineResult,
      scenarios: results,
      summaryConclusion: 'Phase 5A Adaptive Architecture Ablation Test completed.',
    };
  }
}
