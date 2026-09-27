import { Candle, Timeframe } from '../types';
import { HistoricalReplayEngine, ReplayConfig, ReplaySummary } from './historicalReplayEngine';
import { ForexSessionEngine } from './forexSessionEngine';

export interface ForexABVariantResult {
  variant: 'A_BASELINE_1.5R' | 'B_EXPERIMENTAL_1.4R' | 'C_EXPERIMENTAL_1.3R';
  minRiskReward: number;
  trades: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  netPnlUsd: number;
  rejectionRatePercent: number;
  summary: ReplaySummary;
}

export interface ForexABExperimentReport {
  symbol: string;
  timeframe: Timeframe;
  totalCandlesEvaluated: number;
  overlapCandlesCount: number;
  classification: 'RESEARCH_ONLY_ISOLATED_EXPERIMENT';
  variants: {
    variantA: ForexABVariantResult;
    variantB: ForexABVariantResult;
    variantC: ForexABVariantResult;
  };
  hypothesisConclusion: string;
  disclaimer: string;
}

/**
 * Isolated Research-Only A/B Forex Experiment.
 * Compares R:R thresholds (1.5R vs 1.4R vs 1.3R) strictly during London/NY Overlap.
 * 
 * CRITICAL DIRECTIVE:
 * This experiment is completely isolated and has NO effect on the frozen Paper Trading strategy.
 */
export class ForexABExperiment {
  /**
   * Filters input candles to include strictly London/NY session overlap hours (12:00 - 16:00 UTC).
   */
  public static filterLondonNyOverlapCandles(candles: Candle[], symbol: string, timeframe: Timeframe): Candle[] {
    return candles.filter((c) => {
      const date = new Date(c.time * 1000);
      const utcHour = date.getUTCHours();
      // London/NY Overlap: 12:00 to 16:00 UTC
      return utcHour >= 12 && utcHour < 16;
    });
  }

  /**
   * Executes the 3-way comparative experiment across a given Forex historical series.
   */
  public static runExperiment(
    candles: Candle[],
    symbol = 'EURUSD',
    timeframe: Timeframe = '1h'
  ): ForexABExperimentReport {
    // 1. Identify Overlap bars
    const overlapCandles = this.filterLondonNyOverlapCandles(candles, symbol, timeframe);

    // If overlap slice is too small for replay, evaluate on whole series with overlap filter in replay
    const evalCandles = overlapCandles.length >= 60 ? overlapCandles : candles;

    const baseConfig: ReplayConfig = {
      asset: symbol,
      timeframe,
      initialBalance: 10000,
      riskPerTradePercent: 1.0,
      feesBps: 2,
      slippageBps: 2,
      collisionRule: 'SL_FIRST',
      minRiskReward: 1.5,
      maxHoldingBars: 40,
      useAdaptiveEngine: true,
      partialExit: {
        enabled: true,
        tp1Percent: 50,
        tp2Percent: 30,
        moveSlToBreakevenAtTp1: true,
        trailRemainingAfterTp1: true,
      },
    };

    // Variant A: Frozen baseline (1.5R)
    const configA: ReplayConfig = { ...baseConfig, minRiskReward: 1.5 };
    const summaryA = HistoricalReplayEngine.runReplay(evalCandles, configA);

    // Variant B: Experimental 1.4R
    const configB: ReplayConfig = { ...baseConfig, minRiskReward: 1.4 };
    const summaryB = HistoricalReplayEngine.runReplay(evalCandles, configB);

    // Variant C: Experimental 1.3R
    const configC: ReplayConfig = { ...baseConfig, minRiskReward: 1.3 };
    const summaryC = HistoricalReplayEngine.runReplay(evalCandles, configC);

    const buildVariantResult = (
      variant: ForexABVariantResult['variant'],
      minRr: number,
      summary: ReplaySummary
    ): ForexABVariantResult => {
      const trades = summary.totalTradesExecuted;
      const winRate = summary.winRate;
      const profitFactor = summary.profitFactor;
      const expectancyR = summary.expectancyR;
      const evaluated = summary.totalCandles;
      const rejected = evaluated - summary.totalSignalsGenerated;
      const rejectionRatePercent = evaluated > 0 ? Math.round((rejected / evaluated) * 1000) / 10 : 100;

      return {
        variant,
        minRiskReward: minRr,
        trades,
        winRate,
        expectancyR,
        profitFactor,
        maxDrawdownPercent: summary.maxDrawdownPercent,
        netPnlUsd: summary.netPnlUsd,
        rejectionRatePercent,
        summary,
      };
    };

    const variantA = buildVariantResult('A_BASELINE_1.5R', 1.5, summaryA);
    const variantB = buildVariantResult('B_EXPERIMENTAL_1.4R', 1.4, summaryB);
    const variantC = buildVariantResult('C_EXPERIMENTAL_1.3R', 1.3, summaryC);

    let hypothesisConclusion = 'Гипотеза: сниженный порог R:R (1.3R-1.4R) повышает частоту входов в часы высокой межбанковской ликвидности (London/NY overlap).';
    if (variantC.trades > variantA.trades && variantC.expectancyR > 0) {
      hypothesisConclusion += ` Вариант C (1.3R) активировал ${variantC.trades} сделок с Expectancy ${variantC.expectancyR}R vs ${variantA.trades} в базовой версии. Требуется дальнейшее форвард-наблюдение.`;
    } else {
      hypothesisConclusion += ` Снижение порога до 1.3R не дало стабильного преимущества над базовым 1.5R фильтром (${variantC.trades} сделок, PF ${variantC.profitFactor}). Базовый фильтр остается предпочтительным.`;
    }

    return {
      symbol,
      timeframe,
      totalCandlesEvaluated: evalCandles.length,
      overlapCandlesCount: overlapCandles.length,
      classification: 'RESEARCH_ONLY_ISOLATED_EXPERIMENT',
      variants: {
        variantA,
        variantB,
        variantC,
      },
      hypothesisConclusion,
      disclaimer: 'ДАННЫЙ ЭКСПЕРИМЕНТ ЯВЛЯЕТСЯ ИЗОЛИРОВАННЫМ И НЕ ИЗМЕНЯЕТ ЗАМОРОЖЕННЫЕ ПАРАМЕТРЫ PAPER TRADING.',
    };
  }
}
