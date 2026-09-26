import { Candle, MultiTimeframeAnalysis, MultiTimeframeRow } from '../types';
import { calculateEMA, calculateRSI } from './indicators';

export function analyzeMultiTimeframe(candles: Candle[]): MultiTimeframeAnalysis {
  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1] || 100;

  const rsi = calculateRSI(closes, 14);
  const currentRsi = rsi[rsi.length - 1] || 50;
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const e20 = ema20[ema20.length - 1] || currentPrice;
  const e50 = ema50[ema50.length - 1] || currentPrice;

  const rows: MultiTimeframeRow[] = [];
  let bullishVotes = 0;
  let bearishVotes = 0;
  let totalVotes = 0;

  // We synthesize simulated multi-scale aggregations from the base dataset
  // using different sampling intervals and lookbacks
  timeframes.forEach((tf, index) => {
    const lookback = (index + 1) * 6;
    const pastPrice = closes[Math.max(0, closes.length - lookback)] || currentPrice;
    const change = ((currentPrice - pastPrice) / pastPrice) * 100;

    let trend: MultiTimeframeRow['trend'] = 'NEUTRAL';
    let bias: MultiTimeframeRow['bias'] = 'NEUTRAL';
    let momentum: MultiTimeframeRow['momentum'] = 'MODERATE';
    let structure: MultiTimeframeRow['structure'] = 'RANGE_BOUND';
    let volatility: MultiTimeframeRow['volatility'] = 'NORMAL';

    if (change > 0.8 || (currentPrice > e20 && currentRsi > 55)) {
      trend = 'BULLISH';
      bias = 'BULLISH';
      bullishVotes += (index >= 3 ? 2 : 1); // higher timeframes get more weight
    } else if (change < -0.8 || (currentPrice < e20 && currentRsi < 45)) {
      trend = 'BEARISH';
      bias = 'BEARISH';
      bearishVotes += (index >= 3 ? 2 : 1);
    } else {
      trend = 'NEUTRAL';
      bias = 'NEUTRAL';
    }
    totalVotes += (index >= 3 ? 2 : 1);

    if (Math.abs(change) > 3.0 || currentRsi > 68 || currentRsi < 32) {
      momentum = 'STRONG';
    } else if (Math.abs(change) < 0.4) {
      momentum = 'WEAK';
    }

    if (change > 2.0) {
      structure = 'BULL_BREAK';
    } else if (change < -2.0) {
      structure = 'BEAR_BREAK';
    } else if (change > 0) {
      structure = 'SWING_LOW';
    } else {
      structure = 'SWING_HIGH';
    }

    if (Math.abs(change) > 2.5) {
      volatility = 'EXPANSION';
    } else if (Math.abs(change) < 0.3) {
      volatility = 'COMPRESSION';
    }

    rows.push({
      timeframe: tf,
      trend,
      momentum,
      structure,
      volatility,
      bias,
    });
  });

  const dominantDirection = bullishVotes >= bearishVotes ? 'BULLISH' : 'BEARISH';
  const dominantVotes = Math.max(bullishVotes, bearishVotes);
  const alignmentScore = Math.min(96, Math.max(42, Math.round((dominantVotes / totalVotes) * 100)));

  // Identify conflicts
  const conflicts: string[] = [];
  const shortTerm = rows.slice(0, 3);
  const higherTerm = rows.slice(3);

  const shortBullish = shortTerm.filter((r) => r.trend === 'BULLISH').length;
  const shortBearish = shortTerm.filter((r) => r.trend === 'BEARISH').length;
  const highBullish = higherTerm.filter((r) => r.trend === 'BULLISH').length;
  const highBearish = higherTerm.filter((r) => r.trend === 'BEARISH').length;

  if (shortBullish >= 2 && highBearish >= 2) {
    conflicts.push('Short-term momentum (1m-15m) is pushing bullish into higher timeframe (1H-1D) resistance.');
  } else if (shortBearish >= 2 && highBullish >= 2) {
    conflicts.push('Short-term pullback (1m-15m) against established daily bull trend (4H-1D). Retest opportunity.');
  } else if (highBullish === 0 && highBearish === 0) {
    conflicts.push('Macro timeframes (4H, 1D) are consolidating in neutral range; avoid chasing low-timeframe breakout wicks.');
  }

  let synthesis = '';
  if (alignmentScore >= 75) {
    synthesis = `Strong cross-timeframe alignment (${alignmentScore}%). Directional flow is synchronized across execution (15m) and macro anchor (4H) timeframes.`;
  } else if (alignmentScore >= 55) {
    synthesis = `Moderate alignment (${alignmentScore}%). Lower timeframes are leading momentum, but confirmation on the 4H/1D candle close is advised.`;
  } else {
    synthesis = `Low alignment (${alignmentScore}%). Divergent signals across scales indicate chop or imminent transition phase. Keep risk defensive.`;
  }

  return {
    rows,
    alignmentScore,
    conflicts,
    synthesis,
  };
}
