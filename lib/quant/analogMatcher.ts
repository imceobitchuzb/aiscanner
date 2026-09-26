import { Candle, HistoricalAnalogResult } from '../types';

export function findHistoricalAnalogs(
  currentCandles: Candle[],
  symbol = 'BTCUSDT',
  lookbackPatternBars = 15,
  forwardHorizonBars = 12
): HistoricalAnalogResult {
  const minRequired = lookbackPatternBars + forwardHorizonBars + 10;
  if (!currentCandles || currentCandles.length < minRequired) {
    return {
      similarSetupsFound: 0,
      winRateTP: 0,
      lossRateSL: 0,
      neutralRate: 0,
      averageMovePercent: 0,
      averageAdverseMovePercent: 0,
      medianDurationHours: 0,
      topMatches: [],
    };
  }

  // Extract recent normalized profile
  const recentCloses = currentCandles.slice(-lookbackPatternBars).map((c) => c.close);
  const minVal = Math.min(...recentCloses);
  const maxVal = Math.max(...recentCloses);
  const range = maxVal - minVal || 1;
  const recentNormalized = recentCloses.map((p) => (p - minVal) / range);

  interface Match {
    index: number;
    similarity: number;
    date: string;
    outcome: 'TP' | 'SL' | 'NEUTRAL';
    movePercent: number;
    adverseMovePercent: number;
  }

  const matches: Match[] = [];
  const searchLimit = currentCandles.length - lookbackPatternBars - forwardHorizonBars;

  for (let i = 0; i < searchLimit; i += 2) {
    const windowCloses = currentCandles.slice(i, i + lookbackPatternBars).map((c) => c.close);
    const wMin = Math.min(...windowCloses);
    const wMax = Math.max(...windowCloses);
    const wRange = wMax - wMin || 1;
    const windowNormalized = windowCloses.map((p) => (p - wMin) / wRange);

    // Compute Euclidean distance
    let sumSqDiff = 0;
    for (let k = 0; k < lookbackPatternBars; k++) {
      sumSqDiff += Math.pow(recentNormalized[k] - windowNormalized[k], 2);
    }
    const distance = Math.sqrt(sumSqDiff);
    const maxPossibleDistance = Math.sqrt(lookbackPatternBars);
    const similarityScore = Math.max(0, (1 - distance / maxPossibleDistance) * 100);

    // Dynamic threshold: accepts patterns with >= 75% geometric similarity
    if (similarityScore >= 75) {
      const entryPrice = currentCandles[i + lookbackPatternBars - 1].close;
      const forwardCandles = currentCandles.slice(
        i + lookbackPatternBars,
        i + lookbackPatternBars + forwardHorizonBars
      );

      let maxHigh = entryPrice;
      let minLow = entryPrice;
      forwardCandles.forEach((fc) => {
        if (fc.high > maxHigh) maxHigh = fc.high;
        if (fc.low < minLow) minLow = fc.low;
      });

      const maxFwdMove = ((maxHigh - entryPrice) / entryPrice) * 100;
      const maxAdverse = ((minLow - entryPrice) / entryPrice) * 100;

      let outcome: 'TP' | 'SL' | 'NEUTRAL' = 'NEUTRAL';
      if (maxFwdMove >= 1.5 && Math.abs(maxAdverse) < 1.2) {
        outcome = 'TP';
      } else if (Math.abs(maxAdverse) >= 1.2) {
        outcome = 'SL';
      }

      const matchDate = new Date(currentCandles[i + lookbackPatternBars - 1].time * 1000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');

      matches.push({
        index: i,
        similarity: Math.round(similarityScore * 10) / 10,
        date: matchDate,
        outcome,
        movePercent: Math.round(maxFwdMove * 10) / 10,
        adverseMovePercent: Math.round(maxAdverse * 10) / 10,
      });
    }
  }

  if (matches.length === 0) {
    return {
      similarSetupsFound: 0,
      winRateTP: 0,
      lossRateSL: 0,
      neutralRate: 0,
      averageMovePercent: 0,
      averageAdverseMovePercent: 0,
      medianDurationHours: 0,
      topMatches: [],
    };
  }

  const tpCount = matches.filter((m) => m.outcome === 'TP').length;
  const slCount = matches.filter((m) => m.outcome === 'SL').length;
  const neutralCount = matches.length - tpCount - slCount;

  const winRateTP = Math.round((tpCount / matches.length) * 1000) / 10;
  const lossRateSL = Math.round((slCount / matches.length) * 1000) / 10;
  const neutralRate = Math.round((neutralCount / matches.length) * 1000) / 10;

  const avgMove = Math.round((matches.reduce((s, m) => s + m.movePercent, 0) / matches.length) * 10) / 10;
  const avgAdverse = Math.round((matches.reduce((s, m) => s + m.adverseMovePercent, 0) / matches.length) * 10) / 10;

  const topMatches = matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((m, idx) => ({
      id: `match-${idx + 1}`,
      asset: symbol,
      date: m.date,
      similarity: m.similarity,
      outcome: m.outcome,
      movePercent: m.movePercent,
      regime: m.outcome === 'TP' ? 'Favorable Continuation' : 'Adverse Reversal',
    }));

  return {
    similarSetupsFound: matches.length,
    winRateTP,
    lossRateSL,
    neutralRate,
    averageMovePercent: avgMove,
    averageAdverseMovePercent: avgAdverse,
    medianDurationHours: Math.round((forwardHorizonBars * 0.75) * 10) / 10,
    topMatches,
  };
}
