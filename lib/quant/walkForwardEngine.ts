import { Candle } from '../types';
import { HistoricalReplayEngine, ReplayConfig, ReplaySummary } from './historicalReplayEngine';

export interface WalkForwardWindow {
  windowIndex: number;
  trainRange: { start: number; end: number; candles: number };
  valRange: { start: number; end: number; candles: number };
  testRange: { start: number; end: number; candles: number };
  inSample: ReplaySummary;
  validation: ReplaySummary;
  outOfSample: ReplaySummary; // Strictly Unseen Test
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
  };
  aggregateOutOfSample: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    expectancyR: number;
  };
  meanWFE: number; // Walk Forward Efficiency
  robustnessGrade: 'ROBUST' | 'MODERATE' | 'OVERFITTED' | 'INSUFFICIENT_DATA';
  verdict: string;
}

export class WalkForwardEngine {
  /**
   * Performs an honest Walk-Forward analysis with rolling train/val/test splits.
   * Crucially: Test data is completely unseen during training/parameter selection.
   */
  public static runWalkForward(
    candles: Candle[],
    baseConfig: ReplayConfig,
    numWindows = 3
  ): WalkForwardAnalysisResult {
    const n = candles.length;
    if (n < 120) {
      return {
        status: 'INSUFFICIENT_DATA',
        totalWindows: 0,
        windows: [],
        aggregateInSample: { totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0 },
        aggregateOutOfSample: { totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0 },
        meanWFE: 0,
        robustnessGrade: 'INSUFFICIENT_DATA',
        verdict: 'Недостаточно исторических свечей для скользящей валидации (требуется >= 120 свечей).',
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

      if (windowCandles.length < 50) continue;

      const trainCount = Math.floor(windowCandles.length * trainRatio);
      const valCount = Math.floor(windowCandles.length * valRatio);

      const trainCandles = windowCandles.slice(0, trainCount);
      const valCandles = windowCandles.slice(trainCount, trainCount + valCount);
      const testCandles = windowCandles.slice(trainCount + valCount);

      if (trainCandles.length < 30 || testCandles.length < 15) continue;

      const inSample = HistoricalReplayEngine.runReplay(trainCandles, baseConfig);
      const validation = HistoricalReplayEngine.runReplay(valCandles, baseConfig);
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
        walkForwardEfficiency: wfe,
      });
    }

    if (windows.length === 0) {
      return {
        status: 'INSUFFICIENT_DATA',
        totalWindows: 0,
        windows: [],
        aggregateInSample: { totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0 },
        aggregateOutOfSample: { totalTrades: 0, winRate: 0, profitFactor: 0, expectancyR: 0 },
        meanWFE: 0,
        robustnessGrade: 'INSUFFICIENT_DATA',
        verdict: 'Окна скользящей валидации не содержат достаточного количества данных.',
      };
    }

    // Aggregates
    const inTrades = windows.reduce((s, w) => s + w.inSample.totalTradesExecuted, 0);
    const inWins = windows.reduce((s, w) => s + w.inSample.wins, 0);
    const inWinRate = inTrades > 0 ? Math.round((inWins / inTrades) * 10000) / 100 : 0;
    const inPF = windows.reduce((s, w) => s + w.inSample.profitFactor, 0) / windows.length;
    const inExp = windows.reduce((s, w) => s + w.inSample.expectancyR, 0) / windows.length;

    const outTrades = windows.reduce((s, w) => s + w.outOfSample.totalTradesExecuted, 0);
    const outWins = windows.reduce((s, w) => s + w.outOfSample.wins, 0);
    const outWinRate = outTrades > 0 ? Math.round((outWins / outTrades) * 10000) / 100 : 0;
    const outPF = windows.reduce((s, w) => s + w.outOfSample.profitFactor, 0) / windows.length;
    const outExp = windows.reduce((s, w) => s + w.outOfSample.expectancyR, 0) / windows.length;

    const meanWFE = Math.round((windows.reduce((s, w) => s + w.walkForwardEfficiency, 0) / windows.length) * 100) / 100;

    let robustnessGrade: WalkForwardAnalysisResult['robustnessGrade'] = 'OVERFITTED';
    let verdict = 'Значительная деградация на неизвестных данных (WFE < 0.5). Признак переобучения.';

    if (meanWFE >= 0.75 && outPF >= 1.2) {
      robustnessGrade = 'ROBUST';
      verdict = 'Высокая устойчивость на OOS-выборке (WFE >= 0.75). Преимущество подтверждено.';
    } else if (meanWFE >= 0.5 && outPF >= 1.0) {
      robustnessGrade = 'MODERATE';
      verdict = 'Умеренная устойчивость на OOS (WFE 0.5-0.75). Результаты стабильны, но требуют контроля просадки.';
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
      },
      aggregateOutOfSample: {
        totalTrades: outTrades,
        winRate: outWinRate,
        profitFactor: Math.round(outPF * 100) / 100,
        expectancyR: Math.round(outExp * 100) / 100,
      },
      meanWFE,
      robustnessGrade,
      verdict,
    };
  }
}
