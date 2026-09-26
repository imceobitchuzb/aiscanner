import { BacktestStrategyConfig, Candle, WalkForwardResult } from '../types';
import { runBacktest } from './backtestEngine';

export function runWalkForwardAnalysis(
  candles: Candle[],
  config: BacktestStrategyConfig,
  splitRatio = 0.7
): WalkForwardResult {
  if (!candles || candles.length < 80) {
    return {
      inSampleSharpe: 0,
      outOfSampleSharpe: 0,
      degradationPercent: 0,
      inSampleWinRate: 0,
      outOfSampleWinRate: 0,
      robustnessGrade: 'INSUFFICIENT_DATA',
    };
  }

  const splitIndex = Math.floor(candles.length * splitRatio);
  const inSampleCandles = candles.slice(0, splitIndex);
  const outOfSampleCandles = candles.slice(splitIndex);

  const inSampleReport = runBacktest(inSampleCandles, config);
  const outOfSampleReport = runBacktest(outOfSampleCandles, config);

  const inSharpe = inSampleReport.sharpeRatio || 0;
  const outSharpe = outOfSampleReport.sharpeRatio || 0;

  // Real statistical degradation calculation
  let degradation = 0;
  if (inSharpe > 0) {
    degradation = Math.round(((inSharpe - outSharpe) / inSharpe) * 1000) / 10;
  }

  let robustnessGrade: WalkForwardResult['robustnessGrade'] = 'ROBUST';
  if (inSharpe === 0 && outSharpe === 0) {
    robustnessGrade = 'INSUFFICIENT_DATA';
  } else if (degradation > 45 || outSharpe < 0.5) {
    robustnessGrade = 'OVERFITTED';
  } else if (degradation > 25) {
    robustnessGrade = 'MODERATE';
  }

  return {
    inSampleSharpe: Math.round(inSharpe * 100) / 100,
    outOfSampleSharpe: Math.round(outSharpe * 100) / 100,
    degradationPercent: Math.max(0, degradation),
    inSampleWinRate: inSampleReport.winRatePercent,
    outOfSampleWinRate: outOfSampleReport.winRatePercent,
    robustnessGrade,
  };
}
