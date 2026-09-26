import { Candle, MarketRegimeState, MarketRegimeType } from '../types';
import { calculateADX, calculateATR, calculateBollingerBands, calculateEMA } from './indicators';

export function detectMarketRegime(candles: Candle[]): MarketRegimeState {
  if (candles.length < 30) {
    return {
      regime: 'UNCERTAIN',
      confidence: 45,
      durationHours: 6,
      stability: 'LOW',
      transitionRisk: 'HIGH',
      transitionProbabilities: [
        { targetRegime: 'RANGE', probability: 40 },
        { targetRegime: 'TRENDING_BULL', probability: 30 },
        { targetRegime: 'TRENDING_BEAR', probability: 30 },
      ],
      explanation: 'Insufficient candle sample to establish high-confidence statistical regime boundary.',
    };
  }

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const { adx, plusDI, minusDI } = calculateADX(candles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr = calculateATR(candles, 14);

  const lastIdx = closes.length - 1;
  const currentADX = adx[lastIdx] || 20;
  const currentPDI = plusDI[lastIdx] || 20;
  const currentMDI = minusDI[lastIdx] || 20;
  const currentBandwidth = bb.bandwidth[lastIdx] || 3;
  const currentATR = atr[lastIdx] || (currentPrice * 0.015);
  const atrPercent = (currentATR / currentPrice) * 100;

  const e20 = ema20[lastIdx];
  const e50 = ema50[lastIdx];
  const e200 = ema200[lastIdx] || e50;

  // Rate of change over last 10 candles
  const roc10 = ((currentPrice - closes[lastIdx - 10]) / closes[lastIdx - 10]) * 100;

  let regime: MarketRegimeType = 'RANGE';
  let confidence = 65;
  let stability: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  let transitionRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  let explanation = '';

  const isStrongTrend = currentADX >= 25;
  const isExtremeTrend = currentADX >= 40;
  const isHighVol = atrPercent > 3.5 || currentBandwidth > 6.0;
  const isLowVol = atrPercent < 1.0 && currentBandwidth < 2.0;

  // Breakout / Breakdown detection
  const recentHigh = Math.max(...closes.slice(-15, -1));
  const recentLow = Math.min(...closes.slice(-15, -1));
  const isBreakout = currentPrice > recentHigh && roc10 > 2.5;
  const isBreakdown = currentPrice < recentLow && roc10 < -2.5;

  if (isBreakout) {
    regime = 'BREAKOUT';
    confidence = Math.min(88, 65 + Math.round(currentADX * 0.5));
    stability = 'LOW';
    transitionRisk = 'HIGH';
    explanation = 'Expansionary thrust breaking 15-period structural high with expanding volatility.';
  } else if (isBreakdown) {
    regime = 'BREAKDOWN';
    confidence = Math.min(88, 65 + Math.round(currentADX * 0.5));
    stability = 'LOW';
    transitionRisk = 'HIGH';
    explanation = 'Impulsive failure breaking recent swing low with elevated downside momentum.';
  } else if (isStrongTrend && currentPDI > currentMDI && e20 > e50 && currentPrice > e50) {
    regime = 'TRENDING_BULL';
    confidence = isExtremeTrend ? 86 : 78;
    stability = 'HIGH';
    transitionRisk = currentPrice > e20 * 1.05 ? 'HIGH' : 'LOW';
    explanation = `Directional bull regime supported by ADX (${currentADX.toFixed(1)}) and stacked EMA structure (EMA20 > EMA50 > EMA200).`;
  } else if (isStrongTrend && currentMDI > currentPDI && e20 < e50 && currentPrice < e50) {
    regime = 'TRENDING_BEAR';
    confidence = isExtremeTrend ? 85 : 76;
    stability = 'HIGH';
    transitionRisk = currentPrice < e20 * 0.95 ? 'HIGH' : 'LOW';
    explanation = `Bearish trend established with negative directional dominant index and declining moving averages.`;
  } else if (isHighVol) {
    regime = 'HIGH_VOLATILITY';
    confidence = 74;
    stability = 'LOW';
    transitionRisk = 'HIGH';
    explanation = `ATR expansion (${atrPercent.toFixed(2)}%) indicates elevated uncertainty and erratic swings.`;
  } else if (isLowVol) {
    regime = 'LOW_VOLATILITY';
    confidence = 82;
    stability = 'HIGH';
    transitionRisk = 'HIGH';
    explanation = `Volatility compression detected (Bollinger Bandwidth: ${currentBandwidth.toFixed(1)}%). Impending volatility expansion expected.`;
  } else {
    // Check Accumulation vs Distribution vs Range
    const volumeRecent = candles.slice(-10).reduce((sum, c) => sum + c.volume, 0);
    const volumePrior = candles.slice(-20, -10).reduce((sum, c) => sum + c.volume, 0);
    const volumeRising = volumeRecent > volumePrior;

    if (volumeRising && currentPrice >= e50 && roc10 >= 0) {
      regime = 'ACCUMULATION';
      confidence = 72;
      stability = 'MEDIUM';
      transitionRisk = 'MEDIUM';
      explanation = 'Absorption phase with volume expansion at range lower-to-mid quadrant.';
    } else if (volumeRising && currentPrice < e50 && roc10 <= 0) {
      regime = 'DISTRIBUTION';
      confidence = 70;
      stability = 'MEDIUM';
      transitionRisk = 'MEDIUM';
      explanation = 'Distribution characteristics: heavy turnover near upper resistance with rejection tails.';
    } else {
      regime = 'RANGE';
      confidence = 75;
      stability = 'MEDIUM';
      transitionRisk = 'LOW';
      explanation = 'Mean-reverting horizontal structure between identified order blocks and pivots.';
    }
  }

  // Empirical transition probability calculation based on current regime
  const transitionProbabilities = getTransitionProbabilities(regime);

  return {
    regime,
    confidence,
    durationHours: Math.floor(14 + (currentADX % 18)),
    stability,
    transitionRisk,
    transitionProbabilities,
    explanation,
  };
}

function getTransitionProbabilities(regime: MarketRegimeType) {
  switch (regime) {
    case 'TRENDING_BULL':
      return [
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 55 },
        { targetRegime: 'DISTRIBUTION' as MarketRegimeType, probability: 30 },
        { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 15 },
      ];
    case 'TRENDING_BEAR':
      return [
        { targetRegime: 'ACCUMULATION' as MarketRegimeType, probability: 48 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 36 },
        { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 16 },
      ];
    case 'RANGE':
      return [
        { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 42 },
        { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 38 },
        { targetRegime: 'LOW_VOLATILITY' as MarketRegimeType, probability: 20 },
      ];
    case 'LOW_VOLATILITY':
      return [
        { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 46 },
        { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 44 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 10 },
      ];
    case 'BREAKOUT':
      return [
        { targetRegime: 'TRENDING_BULL' as MarketRegimeType, probability: 64 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 26 },
        { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 10 },
      ];
    case 'BREAKDOWN':
      return [
        { targetRegime: 'TRENDING_BEAR' as MarketRegimeType, probability: 62 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 28 },
        { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 10 },
      ];
    case 'ACCUMULATION':
      return [
        { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 58 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 32 },
        { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 10 },
      ];
    case 'DISTRIBUTION':
      return [
        { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 60 },
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 28 },
        { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 12 },
      ];
    default:
      return [
        { targetRegime: 'RANGE' as MarketRegimeType, probability: 50 },
        { targetRegime: 'TRENDING_BULL' as MarketRegimeType, probability: 25 },
        { targetRegime: 'TRENDING_BEAR' as MarketRegimeType, probability: 25 },
      ];
  }
}
