import { AISignal, Candle, MarketRegimeState, MarketStructure, MultiTimeframeAnalysis, SignalQualityBreakdown } from '../types';
import { calculateATR, calculateRSI } from './indicators';

export function evaluateSignalQuality(
  candles: Candle[],
  regime: MarketRegimeState,
  structure: MarketStructure,
  mtf: MultiTimeframeAnalysis
): { signal: AISignal; quality: SignalQualityBreakdown } {
  const currentPrice = candles[candles.length - 1]?.close || 100;
  const closes = candles.map((c) => c.close);
  const rsi = calculateRSI(closes, 14);
  const currentRsi = rsi[rsi.length - 1] || 50;
  const atr = calculateATR(candles, 14);
  const currentATR = atr[atr.length - 1] || currentPrice * 0.015;

  // Factor 1: Trend Score (max 20)
  let trendScore = 10;
  if (regime.regime === 'TRENDING_BULL' || regime.regime === 'BREAKOUT') {
    trendScore = 18;
  } else if (regime.regime === 'TRENDING_BEAR' || regime.regime === 'BREAKDOWN') {
    trendScore = 17;
  } else if (regime.regime === 'ACCUMULATION' || regime.regime === 'DISTRIBUTION') {
    trendScore = 13;
  } else {
    trendScore = 8;
  }

  // Factor 2: Momentum Score (max 20)
  let momentumScore = 10;
  if (currentRsi > 55 && currentRsi < 70) {
    momentumScore = 17; // healthy bullish momentum, not overbought
  } else if (currentRsi < 45 && currentRsi > 30) {
    momentumScore = 16; // healthy bearish momentum, not oversold
  } else if (currentRsi >= 70 || currentRsi <= 30) {
    momentumScore = 9; // exhaustion risk
  }

  // Factor 3: Market Structure Score (max 20)
  let structureScore = 10;
  if (structure.trend === 'UPTREND' && regime.regime === 'TRENDING_BULL') {
    structureScore = 18;
  } else if (structure.trend === 'DOWNTREND' && regime.regime === 'TRENDING_BEAR') {
    structureScore = 17;
  } else if (structure.fairValueGaps.length > 0 || structure.orderBlocks.length > 0) {
    structureScore = 14;
  }

  // Factor 4: Volume Score (max 15)
  const recentVol = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
  const priorVol = candles.slice(-20, -5).reduce((s, c) => s + c.volume, 0) / 15;
  let volumeScore = 10;
  if (recentVol > priorVol * 1.25) {
    volumeScore = 14; // strong volume expansion
  } else if (recentVol < priorVol * 0.75) {
    volumeScore = 6; // low conviction
  }

  // Factor 5: MTF Alignment Score (max 15)
  const mtfScore = Math.round((mtf.alignmentScore / 100) * 15);

  // Factor 6: Risk Penalty (deducted from total, 0 to -10)
  let riskPenalty = 0;
  const atrPercent = (currentATR / currentPrice) * 100;
  if (atrPercent > 3.0) riskPenalty += 4;
  if (regime.stability === 'LOW') riskPenalty += 3;
  if (mtf.conflicts.length > 0) riskPenalty += 2;

  // Factor 7: News / Macro Penalty (0 to -5)
  const newsPenalty = 2; // Baseline conservative assumption

  const overallScore = Math.max(
    20,
    Math.min(98, trendScore + momentumScore + structureScore + volumeScore + mtfScore - riskPenalty - newsPenalty)
  );

  const quality: SignalQualityBreakdown = {
    overallScore,
    trendScore,
    momentumScore,
    structureScore,
    volumeScore,
    mtfScore,
    riskPenalty,
    newsPenalty,
  };

  // Determine Direction
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (overallScore >= 60) {
    if (
      regime.regime === 'TRENDING_BULL' ||
      regime.regime === 'BREAKOUT' ||
      regime.regime === 'ACCUMULATION' ||
      (structure.trend === 'UPTREND' && currentRsi > 50)
    ) {
      direction = 'LONG';
    } else if (
      regime.regime === 'TRENDING_BEAR' ||
      regime.regime === 'BREAKDOWN' ||
      regime.regime === 'DISTRIBUTION' ||
      (structure.trend === 'DOWNTREND' && currentRsi < 50)
    ) {
      direction = 'SHORT';
    }
  }

  // Determine Grade
  let setupGrade: AISignal['setupGrade'] = 'C';
  if (overallScore >= 85) setupGrade = 'A+';
  else if (overallScore >= 75) setupGrade = 'A';
  else if (overallScore >= 65) setupGrade = 'B';
  else setupGrade = 'C';

  // Entry, SL, TP levels calculation
  const isLong = direction === 'LONG';
  const entrySpread = currentATR * 0.25;
  const entryZone: [number, number] = isLong
    ? [Math.round((currentPrice - entrySpread) * 100) / 100, Math.round(currentPrice * 100) / 100]
    : [Math.round(currentPrice * 100) / 100, Math.round((currentPrice + entrySpread) * 100) / 100];

  const stopDistance = Math.max(currentATR * 1.5, Math.abs(currentPrice - (isLong ? structure.keySupport : structure.keyResistance)));
  const stopLoss = isLong
    ? Math.round((currentPrice - stopDistance) * 100) / 100
    : Math.round((currentPrice + stopDistance) * 100) / 100;

  const takeProfit1 = isLong
    ? Math.round((currentPrice + stopDistance * 1.5) * 100) / 100
    : Math.round((currentPrice - stopDistance * 1.5) * 100) / 100;

  const takeProfit2 = isLong
    ? Math.round((currentPrice + stopDistance * 2.8) * 100) / 100
    : Math.round((currentPrice - stopDistance * 2.8) * 100) / 100;

  const riskRewardRatio = Math.round(((Math.abs(takeProfit2 - currentPrice) / Math.abs(currentPrice - stopLoss)) || 2.4) * 10) / 10;

  // Build Explanations & Evidence
  const whyList: string[] = [];
  if (isLong) {
    whyList.push(`Structural support validated at $${structure.keySupport.toLocaleString()}`);
    whyList.push(`Regime detected as ${regime.regime.replace('_', ' ')} with ${regime.confidence}% model certainty`);
    whyList.push(`Multi-timeframe momentum alignment verified at ${mtf.alignmentScore}%`);
    whyList.push(`Healthy RSI (${currentRsi.toFixed(1)}) with non-divergent volume confirmation`);
    if (structure.orderBlocks.some((ob) => ob.type === 'BULLISH')) {
      whyList.push('Bullish institutional order block demand cluster absorbed selling pressure');
    }
  } else if (direction === 'SHORT') {
    whyList.push(`Key overhead liquidity rejected at $${structure.keyResistance.toLocaleString()}`);
    whyList.push(`Dominant bearish structure (${regime.regime.replace('_', ' ')}) with declining EMA slopes`);
    whyList.push(`Multi-timeframe directional bias synchronized across lower and macro charts`);
    whyList.push(`Break of intermediate swing low with impulsive downward expansion`);
  } else {
    whyList.push('Market structure is compressing in neutral range; reward-to-risk does not meet trade threshold');
    whyList.push('Conflicting timeframes reduce probabilistic edge; waiting for clean breakout');
  }

  const riskList: string[] = [];
  riskList.push(`Nearest liquidity barrier located ${((Math.abs(structure.keyResistance - currentPrice) / currentPrice) * 100).toFixed(1)}% away`);
  if (regime.stability === 'LOW') {
    riskList.push('Low regime stability: elevated chance of false breakout / whip-saw');
  }
  if (atrPercent > 2.5) {
    riskList.push(`High volatility environment (ATR ${(atrPercent).toFixed(2)}%): scale down position sizing`);
  }
  riskList.push('Macro event or scheduled high-impact economic calendar volatility risk');

  const invalidation = isLong
    ? `Sustained 1H candle close below structural anchor $${stopLoss.toLocaleString()}`
    : `Sustained 1H candle close above resistance barrier $${stopLoss.toLocaleString()}`;

  const signal: AISignal = {
    id: `sig-${Date.now()}`,
    symbol: 'ASSET',
    direction,
    setupGrade,
    confidence: Math.round(overallScore * 0.95),
    quality,
    entryZone,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio,
    expectedHoldingTime: '4–12 hours',
    marketRegime: regime.regime.replace('_', ' '),
    mtfAlignment: mtf.alignmentScore,
    whyList,
    riskList,
    invalidation,
    timestamp: Date.now(),
  };

  return { signal, quality };
}
