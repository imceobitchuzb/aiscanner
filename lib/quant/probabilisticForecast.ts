import { Candle, ForecastConePoint, MarketRegimeState, ProbabilisticForecast, ProbabilisticScenario } from '../types';
import { calculateATR, calculateEMA } from './indicators';

export function generateProbabilisticForecast(
  candles: Candle[],
  regimeState: MarketRegimeState,
  horizonPeriods = 24
): ProbabilisticForecast {
  if (candles.length < 20) {
    const dummyPrice = candles[candles.length - 1]?.close || 100;
    return {
      currentPrice: dummyPrice,
      modelType: 'Parametric Drift-Diffusion Volatility Cone (Deterministic Baseline)',
      isBaseline: true,
      uncertaintyScore: 50,
      cone: [],
      scenarios: [],
    };
  }

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const lastTime = candles[candles.length - 1].time;
  const timeStepSeconds = candles.length > 1 ? candles[1].time - candles[0].time : 3600;

  // Calculate log returns volatility
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) /
    (logReturns.length - 1);
  const sigma = Math.sqrt(variance); // per-bar volatility

  const atr = calculateATR(candles, 14);
  const currentATR = atr[atr.length - 1] || currentPrice * 0.015;

  // Determine directional drift based on regime and moving averages
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const lastEma20 = ema20[ema20.length - 1] || currentPrice;
  const lastEma50 = ema50[ema50.length - 1] || currentPrice;

  let driftMultiplier = 0;
  if (regimeState.regime === 'TRENDING_BULL' || regimeState.regime === 'BREAKOUT') {
    driftMultiplier = 0.4;
  } else if (regimeState.regime === 'TRENDING_BEAR' || regimeState.regime === 'BREAKDOWN') {
    driftMultiplier = -0.4;
  } else if (regimeState.regime === 'ACCUMULATION') {
    driftMultiplier = 0.2;
  } else if (regimeState.regime === 'DISTRIBUTION') {
    driftMultiplier = -0.2;
  } else {
    driftMultiplier = (currentPrice - lastEma50) / (lastEma50 * 10);
  }

  const mu = meanReturn * 0.5 + (driftMultiplier * sigma);

  // Generate projection cone points
  const cone: ForecastConePoint[] = [];
  // Include origin point
  cone.push({
    time: lastTime,
    timestampStr: new Date(lastTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    upper95: currentPrice,
    upper68: currentPrice,
    median: currentPrice,
    lower68: currentPrice,
    lower95: currentPrice,
  });

  for (let t = 1; t <= horizonPeriods; t++) {
    const pointTime = lastTime + t * timeStepSeconds;
    const sqrtT = Math.sqrt(t);
    const projectedCenter = currentPrice * Math.exp(mu * t);

    // 1-sigma (68%) and 2-sigma (95%) confidence boundaries
    const upper68 = projectedCenter * Math.exp(1.0 * sigma * sqrtT);
    const lower68 = projectedCenter * Math.exp(-1.0 * sigma * sqrtT);
    const upper95 = projectedCenter * Math.exp(1.96 * sigma * sqrtT);
    const lower95 = projectedCenter * Math.exp(-1.96 * sigma * sqrtT);

    cone.push({
      time: pointTime,
      timestampStr: new Date(pointTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      upper95,
      upper68,
      median: projectedCenter,
      lower68,
      lower95,
    });
  }

  // Calculate Scenario Probabilities using log-normal probability boundaries
  let bullProb = 50;
  let bearProb = 30;
  let baseProb = 20;

  if (regimeState.regime === 'TRENDING_BULL') {
    bullProb = 58;
    bearProb = 24;
    baseProb = 18;
  } else if (regimeState.regime === 'BREAKOUT') {
    bullProb = 64;
    bearProb = 22;
    baseProb = 14;
  } else if (regimeState.regime === 'TRENDING_BEAR') {
    bullProb = 22;
    bearProb = 60;
    baseProb = 18;
  } else if (regimeState.regime === 'BREAKDOWN') {
    bullProb = 18;
    bearProb = 66;
    baseProb = 16;
  } else if (regimeState.regime === 'RANGE' || regimeState.regime === 'LOW_VOLATILITY') {
    bullProb = 32;
    bearProb = 28;
    baseProb = 40;
  }

  // Adjust for regime confidence
  const confFactor = (regimeState.confidence - 50) / 100; // e.g. +0.28
  if (driftMultiplier > 0) {
    bullProb = Math.round(bullProb + confFactor * 8);
    bearProb = Math.max(12, Math.round(bearProb - confFactor * 6));
  } else if (driftMultiplier < 0) {
    bearProb = Math.round(bearProb + confFactor * 8);
    bullProb = Math.max(12, Math.round(bullProb - confFactor * 6));
  }
  baseProb = Math.max(10, 100 - bullProb - bearProb);

  const finalConePoint = cone[cone.length - 1];
  const bullTarget = Math.round((finalConePoint.upper68 * 0.85 + finalConePoint.upper95 * 0.15) * 100) / 100;
  const bearTarget = Math.round((finalConePoint.lower68 * 0.85 + finalConePoint.lower95 * 0.15) * 100) / 100;
  const baseTarget = Math.round(finalConePoint.median * 100) / 100;

  const scenarios: ProbabilisticScenario[] = [
    {
      id: 'BULL',
      title: 'Bull Expansion Scenario',
      probability: bullProb,
      targetPrice: bullTarget,
      expectedMovePercent: Math.round(((bullTarget - currentPrice) / currentPrice) * 1000) / 10,
      horizon: `${horizonPeriods} bars`,
      rationale: `Continuation of ${regimeState.regime} with volume expansion targeting 1-sigma upper barrier.`,
      invalidationLevel: Math.round((currentPrice - currentATR * 1.5) * 100) / 100,
    },
    {
      id: 'BASE',
      title: 'Base Mean Reversion',
      probability: baseProb,
      targetPrice: baseTarget,
      expectedMovePercent: Math.round(((baseTarget - currentPrice) / currentPrice) * 1000) / 10,
      horizon: `${horizonPeriods} bars`,
      rationale: 'Drift-balanced path with absorption around dynamic VWAP/EMA anchors.',
      invalidationLevel: Math.round((currentPrice - currentATR * 2) * 100) / 100,
    },
    {
      id: 'BEAR',
      title: 'Bear Breakdown Scenario',
      probability: bearProb,
      targetPrice: bearTarget,
      expectedMovePercent: Math.round(((bearTarget - currentPrice) / currentPrice) * 1000) / 10,
      horizon: `${horizonPeriods} bars`,
      rationale: 'Loss of structural pivot support triggering stop cascade toward lower liquidity pocket.',
      invalidationLevel: Math.round((currentPrice + currentATR * 1.5) * 100) / 100,
    },
  ];

  // Uncertainty is related to volatility width & regime instability
  const uncertaintyScore = Math.min(
    95,
    Math.max(25, Math.round((sigma * Math.sqrt(horizonPeriods) * 100 * 3) + (100 - regimeState.confidence) * 0.3))
  );

  return {
    currentPrice,
    modelType: 'Parametric Drift-Diffusion Volatility Cone (Deterministic Baseline)',
    isBaseline: true,
    uncertaintyScore,
    cone,
    scenarios,
  };
}
