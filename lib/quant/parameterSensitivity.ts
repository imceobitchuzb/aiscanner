import { Candle } from '../types';
import { HistoricalReplayEngine, ReplayConfig, ReplaySummary } from './historicalReplayEngine';

export interface ParameterVariation {
  parameterName: string;
  testedValue: number | string;
  isBaseline: boolean;
  trades: number;
  winRate: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdownPct: number;
  netPnlUsd: number;
  sensitivityDeltaPct: number; // % change in profit factor vs baseline
}

export interface SensitivityAnalysisResult {
  baselineSummary: ReplaySummary;
  variations: ParameterVariation[];
  parameterRobustnessVerdict: 'ROBUST' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  assessment: string;
}

export class ParameterSensitivityEngine {
  /**
   * Tests strategy parameter stability by perturbing key parameters
   * (min R:R, fees, slippage, collision rule) to detect curve-fitting fragility.
   */
  public static analyze(
    candles: Candle[],
    baseConfig: ReplayConfig
  ): SensitivityAnalysisResult {
    const baseline = HistoricalReplayEngine.runReplay(candles, baseConfig);

    if (baseline.status === 'INSUFFICIENT_DATA' || baseline.totalTradesExecuted < 5) {
      return {
        baselineSummary: baseline,
        variations: [],
        parameterRobustnessVerdict: 'INSUFFICIENT_DATA',
        assessment: 'Недостаточно сделок в базовом прогоне для анализа устойчивости параметров.',
      };
    }

    const variations: ParameterVariation[] = [];

    // 1. Record Baseline
    variations.push({
      parameterName: 'Baseline Parameters',
      testedValue: `RR ${baseConfig.minRiskReward || 1.5}, Fee ${baseConfig.feesBps || 5}bps`,
      isBaseline: true,
      trades: baseline.totalTradesExecuted,
      winRate: baseline.winRate,
      profitFactor: baseline.profitFactor,
      expectancyR: baseline.expectancyR,
      maxDrawdownPct: baseline.maxDrawdownPercent,
      netPnlUsd: baseline.netPnlUsd,
      sensitivityDeltaPct: 0,
    });

    // 2. Test minRiskReward Variations (1.3 vs 1.8)
    const testRR = [1.3, 1.8];
    for (const rr of testRR) {
      const summary = HistoricalReplayEngine.runReplay(candles, {
        ...baseConfig,
        minRiskReward: rr,
      });
      const delta = baseline.profitFactor > 0
        ? Math.round(((summary.profitFactor - baseline.profitFactor) / baseline.profitFactor) * 1000) / 10
        : 0;
      variations.push({
        parameterName: 'minRiskReward',
        testedValue: rr,
        isBaseline: false,
        trades: summary.totalTradesExecuted,
        winRate: summary.winRate,
        profitFactor: summary.profitFactor,
        expectancyR: summary.expectancyR,
        maxDrawdownPct: summary.maxDrawdownPercent,
        netPnlUsd: summary.netPnlUsd,
        sensitivityDeltaPct: delta,
      });
    }

    // 3. Test Fees & Slippage Stress (0 bps vs 10 bps fees, 10 bps slippage)
    const costScenarios = [
      { name: 'Zero Cost (Gross)', fees: 0, slip: 0 },
      { name: 'High Friction Stress', fees: 10, slip: 8 },
    ];
    for (const c of costScenarios) {
      const summary = HistoricalReplayEngine.runReplay(candles, {
        ...baseConfig,
        feesBps: c.fees,
        slippageBps: c.slip,
      });
      const delta = baseline.profitFactor > 0
        ? Math.round(((summary.profitFactor - baseline.profitFactor) / baseline.profitFactor) * 1000) / 10
        : 0;
      variations.push({
        parameterName: c.name,
        testedValue: `Fee ${c.fees}bps / Slip ${c.slip}bps`,
        isBaseline: false,
        trades: summary.totalTradesExecuted,
        winRate: summary.winRate,
        profitFactor: summary.profitFactor,
        expectancyR: summary.expectancyR,
        maxDrawdownPct: summary.maxDrawdownPercent,
        netPnlUsd: summary.netPnlUsd,
        sensitivityDeltaPct: delta,
      });
    }

    // 4. Test Collision Rule ('TP_FIRST' optimistic vs 'SL_FIRST' conservative)
    const altCollision = HistoricalReplayEngine.runReplay(candles, {
      ...baseConfig,
      collisionRule: 'TP_FIRST',
    });
    const colDelta = baseline.profitFactor > 0
      ? Math.round(((altCollision.profitFactor - baseline.profitFactor) / baseline.profitFactor) * 1000) / 10
      : 0;
    variations.push({
      parameterName: 'collisionRule (Optimistic TP First)',
      testedValue: 'TP_FIRST',
      isBaseline: false,
      trades: altCollision.totalTradesExecuted,
      winRate: altCollision.winRate,
      profitFactor: altCollision.profitFactor,
      expectancyR: altCollision.expectancyR,
      maxDrawdownPct: altCollision.maxDrawdownPercent,
      netPnlUsd: altCollision.netPnlUsd,
      sensitivityDeltaPct: colDelta,
    });

    // Assess robustness: Does slight variation completely destroy edge?
    const worstDelta = Math.min(...variations.filter((v) => !v.isBaseline).map((v) => v.sensitivityDeltaPct));
    let parameterRobustnessVerdict: SensitivityAnalysisResult['parameterRobustnessVerdict'] = 'ROBUST';
    let assessment = 'Стратегия сохраняет математическое преимущество при умеренном изменении параметров и увеличении комиссий.';

    if (worstDelta < -40) {
      parameterRobustnessVerdict = 'FRAGILE';
      assessment = 'Высокая чувствительность: изменение порогов R:R или увеличение издержек приводит к существенной деградации (> 40%).';
    }

    return {
      baselineSummary: baseline,
      variations,
      parameterRobustnessVerdict,
      assessment,
    };
  }
}
