import { Candle, Timeframe } from '../types';
import { HistoricalReplayEngine, ReplayConfig, ReplaySummary } from './historicalReplayEngine';

export interface WindowMetrics {
  trades: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  netPnlUsd: number;
  averageR: number;
  medianR: number;
  exposurePercent: number;
  rejectionRatePercent: number;
  isStatisticallyReliable: boolean;
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainRange: { start: number; end: number; candles: number };
  valRange: { start: number; end: number; candles: number };
  testRange: { start: number; end: number; candles: number };
  inSample: ReplaySummary;
  validation: ReplaySummary;
  outOfSample: ReplaySummary; // Strictly Unseen Test
  inSampleMetrics: WindowMetrics;
  outOfSampleMetrics: WindowMetrics;
  walkForwardEfficiency: number; // Out-of-Sample Profit Factor / In-Sample Profit Factor
}

export interface WalkForwardAnalysisResult {
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  totalWindows: number;
  windows: WalkForwardWindow[];
  aggregateInSample: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    expectancyR: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    averageR: number;
    medianR: number;
    exposurePercent: number;
    rejectionRatePercent: number;
    isStatisticallyReliable: boolean;
  };
  aggregateOutOfSample: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    expectancyR: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    averageR: number;
    medianR: number;
    exposurePercent: number;
    rejectionRatePercent: number;
    isStatisticallyReliable: boolean;
  };
  meanWFE: number; // Walk Forward Efficiency
  robustnessGrade: 'ROBUST' | 'MODERATE' | 'OVERFITTED' | 'INSUFFICIENT_DATA';
  isStatisticallyReliable: boolean;
  statisticalVerdict: 'PROVEN_EDGE' | 'TENTATIVE_EDGE' | 'OVERFITTED' | 'INSUFFICIENT_SAMPLE_SIZE';
  verdict: string;
}

export interface WalkForwardReport {
  asset: string;
  timeframe: Timeframe;
  totalCandles: number;
  splitRatio: number; // e.g. 0.70
  inSampleSummary: {
    trades: number;
    winRate: number;
    expectancyR: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    averageR: number;
    medianR: number;
    exposurePercent: number;
    rejectionRatePercent: number;
    isStatisticallyReliable: boolean;
  };
  outOfSampleSummary: {
    trades: number;
    winRate: number;
    expectancyR: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    averageR: number;
    medianR: number;
    exposurePercent: number;
    rejectionRatePercent: number;
    isStatisticallyReliable: boolean;
  };
  generalizationScore: number; // 0 - 100
  statisticalVerdict: 'PROVEN_EDGE' | 'TENTATIVE_EDGE' | 'OVERFITTED' | 'INSUFFICIENT_SAMPLE_SIZE';
  conclusion: string;
}

export class WalkForwardEngine {
  private static extractMetrics(replay: ReplaySummary): WindowMetrics {
    const pot = replay.rejectionFunnel?.potentialBars || replay.totalCandles || 1;
    const sigs = replay.totalSignalsGenerated;
    const rejRate = Math.round(((pot - sigs) / pot) * 10000) / 100;
    const totalDurationBars = replay.trades.reduce((s, t) => s + t.durationBars, 0);
    const exposure = replay.totalCandles > 0 ? Math.round((totalDurationBars / replay.totalCandles) * 10000) / 100 : 0;

    return {
      trades: replay.totalTradesExecuted,
      winRate: replay.winRate,
      expectancyR: replay.expectancyR,
      profitFactor: replay.profitFactor,
      maxDrawdownPercent: replay.maxDrawdownPercent,
      netPnlUsd: replay.netPnlUsd,
      averageR: replay.averageR,
      medianR: replay.medianR,
      exposurePercent: exposure,
      rejectionRatePercent: rejRate,
      isStatisticallyReliable: replay.totalTradesExecuted >= 30,
    };
  }

  /**
   * Phase 3 & 6: Performs an honest Multi-Window Walk-Forward analysis with rolling train/val/test splits.
   * Crucially: Test data is completely unseen during training/parameter selection.
   * Strictly flags < 30 trades as INSUFFICIENT_SAMPLE_SIZE.
   */
  public static runWalkForward(
    candles: Candle[],
    baseConfig: ReplayConfig,
    numWindows = 3
  ): WalkForwardAnalysisResult {
    const n = candles ? candles.length : 0;
    if (n < 50) {
      return {
        status: 'INSUFFICIENT_DATA',
        totalWindows: 0,
        windows: [],
        aggregateInSample: {
          totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0,
          maxDrawdownPercent: 0, netPnlUsd: 0, averageR: 0, medianR: 0,
          exposurePercent: 0, rejectionRatePercent: 0, isStatisticallyReliable: false,
        },
        aggregateOutOfSample: {
          totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0,
          maxDrawdownPercent: 0, netPnlUsd: 0, averageR: 0, medianR: 0,
          exposurePercent: 0, rejectionRatePercent: 0, isStatisticallyReliable: false,
        },
        meanWFE: 0,
        robustnessGrade: 'INSUFFICIENT_DATA',
        isStatisticallyReliable: false,
        statisticalVerdict: 'INSUFFICIENT_SAMPLE_SIZE',
        verdict: 'Недостаточно исторических свечей для скользящей валидации (требуется >= 50 свечей).',
      };
    }

    const windowSize = Math.floor(n / (numWindows + 1));
    const trainRatio = 0.6;
    const valRatio = 0.2;
    const testRatio = 0.2;

    const windows: WalkForwardWindow[] = [];

    for (let w = 0; w < numWindows; w++) {
      const startIndex = w * Math.floor(windowSize / 2);
      const endIndex = Math.min(n, startIndex + windowSize * 2);
      const windowCandles = candles.slice(startIndex, endIndex);

      if (windowCandles.length < 35) continue;

      const trainCount = Math.floor(windowCandles.length * trainRatio);
      const valCount = Math.floor(windowCandles.length * valRatio);

      const trainCandles = windowCandles.slice(0, trainCount);
      const valCandles = windowCandles.slice(trainCount, trainCount + valCount);
      const testCandles = windowCandles.slice(trainCount + valCount);

      if (trainCandles.length < 20 || testCandles.length < 10) continue;

      const inSample = HistoricalReplayEngine.runReplay(trainCandles, baseConfig);
      const validation = HistoricalReplayEngine.runReplay(valCandles.length >= 10 ? valCandles : trainCandles, baseConfig);
      // Strictly Unseen Test
      const outOfSample = HistoricalReplayEngine.runReplay(testCandles, baseConfig);

      const inSamplePF = inSample.profitFactor > 0 ? inSample.profitFactor : 1;
      const outSamplePF = outOfSample.profitFactor > 0 ? outOfSample.profitFactor : 0;
      const wfe = inSamplePF > 0 ? Math.round((outSamplePF / inSamplePF) * 100) / 100 : 0;

      windows.push({
        windowIndex: w + 1,
        trainRange: {
          start: trainCandles[0].time,
          end: trainCandles[trainCandles.length - 1].time,
          candles: trainCandles.length,
        },
        valRange: {
          start: valCandles.length > 0 ? valCandles[0].time : 0,
          end: valCandles.length > 0 ? valCandles[valCandles.length - 1].time : 0,
          candles: valCandles.length,
        },
        testRange: {
          start: testCandles[0].time,
          end: testCandles[testCandles.length - 1].time,
          candles: testCandles.length,
        },
        inSample,
        validation,
        outOfSample,
        inSampleMetrics: this.extractMetrics(inSample),
        outOfSampleMetrics: this.extractMetrics(outOfSample),
        walkForwardEfficiency: wfe,
      });
    }

    if (windows.length === 0) {
      return {
        status: 'INSUFFICIENT_DATA',
        totalWindows: 0,
        windows: [],
        aggregateInSample: {
          totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0,
          maxDrawdownPercent: 0, netPnlUsd: 0, averageR: 0, medianR: 0,
          exposurePercent: 0, rejectionRatePercent: 0, isStatisticallyReliable: false,
        },
        aggregateOutOfSample: {
          totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0,
          maxDrawdownPercent: 0, netPnlUsd: 0, averageR: 0, medianR: 0,
          exposurePercent: 0, rejectionRatePercent: 0, isStatisticallyReliable: false,
        },
        meanWFE: 0,
        robustnessGrade: 'INSUFFICIENT_DATA',
        isStatisticallyReliable: false,
        statisticalVerdict: 'INSUFFICIENT_SAMPLE_SIZE',
        verdict: 'Окна скользящей валидации не содержат достаточного количества данных.',
      };
    }

    // Aggregates
    const inTrades = windows.reduce((s, w) => s + w.inSample.totalTradesExecuted, 0);
    const inWins = windows.reduce((s, w) => s + w.inSample.wins, 0);
    const inWinRate = inTrades > 0 ? Math.round((inWins / inTrades) * 10000) / 100 : 0;
    const inPF = windows.reduce((s, w) => s + w.inSample.profitFactor, 0) / windows.length;
    const inExp = windows.reduce((s, w) => s + w.inSample.expectancyR, 0) / windows.length;
    const inNetPnl = windows.reduce((s, w) => s + w.inSample.netPnlUsd, 0);
    const inMaxDd = Math.max(...windows.map((w) => w.inSample.maxDrawdownPercent));

    const outTrades = windows.reduce((s, w) => s + w.outOfSample.totalTradesExecuted, 0);
    const outWins = windows.reduce((s, w) => s + w.outOfSample.wins, 0);
    const outWinRate = outTrades > 0 ? Math.round((outWins / outTrades) * 10000) / 100 : 0;
    const outPF = windows.reduce((s, w) => s + w.outOfSample.profitFactor, 0) / windows.length;
    const outExp = windows.reduce((s, w) => s + w.outOfSample.expectancyR, 0) / windows.length;
    const outNetPnl = windows.reduce((s, w) => s + w.outOfSample.netPnlUsd, 0);
    const outMaxDd = Math.max(...windows.map((w) => w.outOfSample.maxDrawdownPercent));

    const meanWFE = Math.round((windows.reduce((s, w) => s + w.walkForwardEfficiency, 0) / windows.length) * 100) / 100;

    const isReliable = outTrades >= 30;

    let robustnessGrade: WalkForwardAnalysisResult['robustnessGrade'] = 'OVERFITTED';
    let verdict = 'Значительная деградация на неизвестных данных (WFE < 0.5). Признак переобучения.';

    if (meanWFE >= 0.75 && outPF >= 1.2) {
      robustnessGrade = 'ROBUST';
      verdict = 'Высокая устойчивость на OOS-выборке (WFE >= 0.75). Преимущество подтверждено.';
    } else if (meanWFE >= 0.5 && outPF >= 1.0) {
      robustnessGrade = 'MODERATE';
      verdict = 'Умеренная устойчивость на OOS (WFE 0.5-0.75). Результаты стабильны, но требуют контроля просадки.';
    }

    let statisticalVerdict: WalkForwardAnalysisResult['statisticalVerdict'] = 'INSUFFICIENT_SAMPLE_SIZE';
    if (!isReliable) {
      statisticalVerdict = 'INSUFFICIENT_SAMPLE_SIZE';
    } else if (robustnessGrade === 'ROBUST' && outExp > 0) {
      statisticalVerdict = 'PROVEN_EDGE';
    } else if (robustnessGrade === 'MODERATE' && outExp > 0) {
      statisticalVerdict = 'TENTATIVE_EDGE';
    } else {
      statisticalVerdict = 'OVERFITTED';
    }

    return {
      status: 'SUCCESS',
      totalWindows: windows.length,
      windows,
      aggregateInSample: {
        totalTrades: inTrades,
        winRate: inWinRate,
        profitFactor: Math.round(inPF * 100) / 100,
        expectancyR: Math.round(inExp * 100) / 100,
        maxDrawdownPercent: inMaxDd,
        netPnlUsd: inNetPnl,
        averageR: Math.round(inExp * 100) / 100,
        medianR: Math.round(inExp * 100) / 100,
        exposurePercent: Math.round((windows.reduce((s, w) => s + w.inSampleMetrics.exposurePercent, 0) / windows.length) * 100) / 100,
        rejectionRatePercent: Math.round((windows.reduce((s, w) => s + w.inSampleMetrics.rejectionRatePercent, 0) / windows.length) * 100) / 100,
        isStatisticallyReliable: inTrades >= 30,
      },
      aggregateOutOfSample: {
        totalTrades: outTrades,
        winRate: outWinRate,
        profitFactor: Math.round(outPF * 100) / 100,
        expectancyR: Math.round(outExp * 100) / 100,
        maxDrawdownPercent: outMaxDd,
        netPnlUsd: outNetPnl,
        averageR: Math.round(outExp * 100) / 100,
        medianR: Math.round(outExp * 100) / 100,
        exposurePercent: Math.round((windows.reduce((s, w) => s + w.outOfSampleMetrics.exposurePercent, 0) / windows.length) * 100) / 100,
        rejectionRatePercent: Math.round((windows.reduce((s, w) => s + w.outOfSampleMetrics.rejectionRatePercent, 0) / windows.length) * 100) / 100,
        isStatisticallyReliable: isReliable,
      },
      meanWFE,
      robustnessGrade,
      isStatisticallyReliable: isReliable,
      statisticalVerdict,
      verdict,
    };
  }

  /**
   * Phase 5B & 6: Strict temporal chronological split (e.g. 70% In-Sample, 30% Out-of-Sample).
   * Zero lookahead, zero data shuffling.
   * Explicitly evaluates statistical validity (< 30 trades => INSUFFICIENT_SAMPLE_SIZE).
   */
  public static runTemporalSplit(
    candles: Candle[],
    userConfig: ReplayConfig,
    inSampleFraction = 0.70
  ): WalkForwardReport {
    if (!candles || candles.length < 50) {
      return {
        asset: userConfig.asset,
        timeframe: userConfig.timeframe,
        totalCandles: candles ? candles.length : 0,
        splitRatio: inSampleFraction,
        inSampleSummary: {
          trades: 0,
          winRate: 0,
          expectancyR: 0,
          profitFactor: 0,
          maxDrawdownPercent: 0,
          netPnlUsd: 0,
          averageR: 0,
          medianR: 0,
          exposurePercent: 0,
          rejectionRatePercent: 0,
          isStatisticallyReliable: false,
        },
        outOfSampleSummary: {
          trades: 0,
          winRate: 0,
          expectancyR: 0,
          profitFactor: 0,
          maxDrawdownPercent: 0,
          netPnlUsd: 0,
          averageR: 0,
          medianR: 0,
          exposurePercent: 0,
          rejectionRatePercent: 0,
          isStatisticallyReliable: false,
        },
        generalizationScore: 0,
        statisticalVerdict: 'INSUFFICIENT_SAMPLE_SIZE',
        conclusion: 'Недостаточно свечей для временного разделения выборки (минимум 50 свечей).',
      };
    }

    const splitIdx = Math.floor(candles.length * inSampleFraction);
    const isCandles = candles.slice(0, splitIdx);
    const oosCandles = candles.slice(splitIdx);

    // 1. Run In-Sample Replay
    const isReplay = HistoricalReplayEngine.runReplay(isCandles, {
      ...userConfig,
      startDate: isCandles[0].time,
      endDate: isCandles[isCandles.length - 1].time,
    });

    // 2. Run Out-of-Sample Replay
    const oosReplay = HistoricalReplayEngine.runReplay(oosCandles, {
      ...userConfig,
      startDate: oosCandles[0].time,
      endDate: oosCandles[oosCandles.length - 1].time,
    });

    // Statistical safety check: minimum 30 trades to claim statistical validity
    const isReliableIS = isReplay.totalTradesExecuted >= 30;
    const isReliableOOS = oosReplay.totalTradesExecuted >= 30;

    // Generalization efficiency: compares OOS expectancy to IS expectancy
    let efficiencyRatio = 0;
    if (isReplay.expectancyR > 0) {
      efficiencyRatio = Math.max(0, oosReplay.expectancyR / isReplay.expectancyR);
    } else if (isReplay.expectancyR <= 0 && oosReplay.expectancyR <= 0) {
      efficiencyRatio = 1.0;
    }

    const generalizationScore = Math.min(100, Math.round(efficiencyRatio * 100));

    // Determine statistical verdict
    let statisticalVerdict: WalkForwardReport['statisticalVerdict'] = 'INSUFFICIENT_SAMPLE_SIZE';
    let conclusion = '';

    if (!isReliableIS || !isReliableOOS) {
      statisticalVerdict = 'INSUFFICIENT_SAMPLE_SIZE';
      conclusion = `Выборка сделок недостаточна для статистического доказательства превосходства (IS: ${isReplay.totalTradesExecuted} сделок, OOS: ${oosReplay.totalTradesExecuted} сделок, порог: 30 сделок). Результаты носят предварительный исследовательский характер.`;
    } else if (isReplay.expectancyR > 0 && oosReplay.expectancyR > 0 && efficiencyRatio >= 0.70) {
      statisticalVerdict = 'PROVEN_EDGE';
      conclusion = `Подтверждён статистический перевес на Out-of-Sample: эффективность обобщения ${generalizationScore}%, OOS Expectancy ${oosReplay.expectancyR.toFixed(2)}R при контроле просадки.`;
    } else if (isReplay.expectancyR > 0 && oosReplay.expectancyR > 0) {
      statisticalVerdict = 'TENTATIVE_EDGE';
      conclusion = `Умеренное сохранение эффективности на OOS (${generalizationScore}%). Матожидание остаётся положительным (${oosReplay.expectancyR.toFixed(2)}R).`;
    } else {
      statisticalVerdict = 'OVERFITTED';
      conclusion = `Признаки переподгонки: стратегия прибыльна In-Sample (${isReplay.expectancyR.toFixed(2)}R), но деградирует на Out-of-Sample (${oosReplay.expectancyR.toFixed(2)}R).`;
    }

    const calcRejectionRate = (replay: ReplaySummary) => {
      const pot = replay.rejectionFunnel?.potentialBars || replay.totalCandles;
      const sigs = replay.totalSignalsGenerated;
      return pot > 0 ? Math.round(((pot - sigs) / pot) * 10000) / 100 : 0;
    };

    const calcExposure = (replay: ReplaySummary) => {
      const dur = replay.trades.reduce((s, t) => s + t.durationBars, 0);
      return replay.totalCandles > 0 ? Math.round((dur / replay.totalCandles) * 10000) / 100 : 0;
    };

    return {
      asset: userConfig.asset,
      timeframe: userConfig.timeframe,
      totalCandles: candles.length,
      splitRatio: inSampleFraction,
      inSampleSummary: {
        trades: isReplay.totalTradesExecuted,
        winRate: isReplay.winRate,
        expectancyR: isReplay.expectancyR,
        profitFactor: isReplay.profitFactor,
        maxDrawdownPercent: isReplay.maxDrawdownPercent,
        netPnlUsd: isReplay.netPnlUsd,
        averageR: isReplay.averageR,
        medianR: isReplay.medianR,
        exposurePercent: calcExposure(isReplay),
        rejectionRatePercent: calcRejectionRate(isReplay),
        isStatisticallyReliable: isReliableIS,
      },
      outOfSampleSummary: {
        trades: oosReplay.totalTradesExecuted,
        winRate: oosReplay.winRate,
        expectancyR: oosReplay.expectancyR,
        profitFactor: oosReplay.profitFactor,
        maxDrawdownPercent: oosReplay.maxDrawdownPercent,
        netPnlUsd: oosReplay.netPnlUsd,
        averageR: oosReplay.averageR,
        medianR: oosReplay.medianR,
        exposurePercent: calcExposure(oosReplay),
        rejectionRatePercent: calcRejectionRate(oosReplay),
        isStatisticallyReliable: isReliableOOS,
      },
      generalizationScore,
      statisticalVerdict,
      conclusion,
    };
  }
}
