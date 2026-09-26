import { Candle, ForecastConePoint } from '../types';
import { QuantFeatureEngine, QuantFeatures } from './featureEngine';
import { DetailedMarketStructure, MarketStructureEngine } from './marketStructureEngine';
import { MarketRegimeEngine } from './regimeEngine';
import { MarketRegimeState } from '../types';

export interface HonestScenario {
  id: 'BULL' | 'BASE' | 'BEAR';
  title: string;
  scenarioScore: number; // 0 - 100 relative scenario score (honestly labeled, not statistical probability)
  targetPrice: number;
  expectedMovePercent: number;
  horizon: string;
  triggerConditions: string;
  invalidationLevel: number;
}

export interface HonestForecast {
  currentPrice: number;
  modelType: string;
  isCalibrated: boolean; // false until historical backtest dataset is integrated
  uncertaintyScore: number; // 0 - 100 based on cone expansion
  cone: ForecastConePoint[];
  scenarios: HonestScenario[];
  volatilityEstimateAnnualized: number;
}

export class ForecastEngine {
  /**
   * Generates a pure statistical forecast and scenario distribution.
   * Completely separated from entry/exit trade signals.
   */
  public static generate(
    candles: Candle[],
    horizonPeriods = 24,
    injectedFeatures?: QuantFeatures | null,
    injectedRegime?: MarketRegimeState | null,
    injectedStructure?: DetailedMarketStructure | null
  ): HonestForecast {
    if (!candles || candles.length < 20) {
      const p = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
      return {
        currentPrice: p,
        modelType: 'Geometric Brownian Diffusion Cone',
        isCalibrated: false,
        uncertaintyScore: 100,
        cone: [],
        scenarios: [],
        volatilityEstimateAnnualized: 0,
      };
    }

    const n = candles.length;
    const currentPrice = candles[n - 1].close;
    const lastTime = candles[n - 1].time;
    const timeStepSeconds = n > 1 ? Math.max(60, candles[1].time - candles[0].time) : 3600;

    const feat = injectedFeatures || QuantFeatureEngine.extractFeatures(candles);
    const struct = injectedStructure || MarketStructureEngine.analyze(candles);
    const regime = injectedRegime || MarketRegimeEngine.classify(candles, feat, struct);

    if (!feat) {
      return {
        currentPrice,
        modelType: 'Geometric Brownian Diffusion Cone',
        isCalibrated: false,
        uncertaintyScore: 100,
        cone: [],
        scenarios: [],
        volatilityEstimateAnnualized: 0,
      };
    }

    // 1. Calculate historical log returns standard deviation
    const logReturns: number[] = [];
    for (let i = 1; i < n; i++) {
      if (candles[i - 1].close > 0 && candles[i].close > 0) {
        logReturns.push(Math.log(candles[i].close / candles[i - 1].close));
      }
    }

    const meanLog = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance =
      logReturns.reduce((s, r) => s + Math.pow(r - meanLog, 2), 0) /
      (logReturns.length - 1);
    const sigma = Math.sqrt(variance); // per-bar volatility

    // 2. Drift calculation based strictly on slope and regime consensus
    let driftFactor = 0;
    if (regime.regime === 'TRENDING_BULL' || regime.regime === 'BREAKOUT') {
      driftFactor = Math.min(0.5, Math.max(0.1, feat.trendSlope * 0.15));
    } else if (regime.regime === 'TRENDING_BEAR' || regime.regime === 'BREAKDOWN') {
      driftFactor = -Math.min(0.5, Math.max(0.1, Math.abs(feat.trendSlope) * 0.15));
    } else {
      driftFactor = feat.trendSlope * 0.05;
    }

    const mu = meanLog * 0.5 + driftFactor * sigma;

    // 3. Volatility cone generation (68% 1-sigma and 95% 1.96-sigma)
    const cone: ForecastConePoint[] = [
      {
        time: lastTime,
        timestampStr: new Date(lastTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        upper95: currentPrice,
        upper68: currentPrice,
        median: currentPrice,
        lower68: currentPrice,
        lower95: currentPrice,
      },
    ];

    for (let t = 1; t <= horizonPeriods; t++) {
      const pointTime = lastTime + t * timeStepSeconds;
      const sqrtT = Math.sqrt(t);
      const projectedCenter = currentPrice * Math.exp(mu * t);

      const upper68 = projectedCenter * Math.exp(1.0 * sigma * sqrtT);
      const lower68 = projectedCenter * Math.exp(-1.0 * sigma * sqrtT);
      const upper95 = projectedCenter * Math.exp(1.96 * sigma * sqrtT);
      const lower95 = projectedCenter * Math.exp(-1.96 * sigma * sqrtT);

      cone.push({
        time: pointTime,
        timestampStr: new Date(pointTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        upper95: Math.round(upper95 * 10000) / 10000,
        upper68: Math.round(upper68 * 10000) / 10000,
        median: Math.round(projectedCenter * 10000) / 10000,
        lower68: Math.round(lower68 * 10000) / 10000,
        lower95: Math.round(lower95 * 10000) / 10000,
      });
    }

    // 4. Honest Scenarios (labeled scenarioScore, not statistical probability)
    const finalPoint = cone[cone.length - 1];
    let bullScore = 33;
    let bearScore = 33;
    let baseScore = 34;

    if (driftFactor > 0.1) {
      bullScore = Math.min(65, Math.round(45 + driftFactor * 40));
      bearScore = Math.max(15, Math.round(30 - driftFactor * 30));
      baseScore = 100 - bullScore - bearScore;
    } else if (driftFactor < -0.1) {
      bearScore = Math.min(65, Math.round(45 + Math.abs(driftFactor) * 40));
      bullScore = Math.max(15, Math.round(30 - Math.abs(driftFactor) * 30));
      baseScore = 100 - bullScore - bearScore;
    }

    const bullTarget = Math.round(finalPoint.upper68 * 10000) / 10000;
    const bearTarget = Math.round(finalPoint.lower68 * 10000) / 10000;
    const baseTarget = Math.round(finalPoint.median * 10000) / 10000;

    const scenarios: HonestScenario[] = [
      {
        id: 'BULL',
        title: 'Сценарий продолжения роста (Bull Expansion)',
        scenarioScore: bullScore,
        targetPrice: bullTarget,
        expectedMovePercent: Math.round(((bullTarget - currentPrice) / currentPrice) * 1000) / 10,
        horizon: `${horizonPeriods} баров`,
        triggerConditions: `Удержание выше EMA20 ($${feat.ema20.toFixed(2)}) с пробоем сопротивления $${struct.keyResistance}`,
        invalidationLevel: Math.round(struct.keySupport * 10000) / 10000,
      },
      {
        id: 'BASE',
        title: 'Базовый сценарий консолидации (Base Range Equilibrium)',
        scenarioScore: baseScore,
        targetPrice: baseTarget,
        expectedMovePercent: Math.round(((baseTarget - currentPrice) / currentPrice) * 1000) / 10,
        horizon: `${horizonPeriods} баров`,
        triggerConditions: 'Баланс спроса и предложения около медианы диффузии',
        invalidationLevel: Math.round((currentPrice - feat.atr14 * 2) * 10000) / 10000,
      },
      {
        id: 'BEAR',
        title: 'Сценарий нисходящей коррекции (Bear Breakdown)',
        scenarioScore: bearScore,
        targetPrice: bearTarget,
        expectedMovePercent: Math.round(((bearTarget - currentPrice) / currentPrice) * 1000) / 10,
        horizon: `${horizonPeriods} баров`,
        triggerConditions: `Пробой поддержки $${struct.keySupport} с закреплением ниже EMA50 ($${feat.ema50.toFixed(2)})`,
        invalidationLevel: Math.round(struct.keyResistance * 10000) / 10000,
      },
    ];

    const uncertaintyScore = Math.min(
      95,
      Math.max(15, Math.round(sigma * Math.sqrt(horizonPeriods) * 100 * 2.5 + (100 - regime.confidence) * 0.25))
    );

    return {
      currentPrice,
      modelType: 'Geometric Brownian Diffusion Cone',
      isCalibrated: false,
      uncertaintyScore,
      cone,
      scenarios,
      volatilityEstimateAnnualized: feat.realizedVolatility,
    };
  }
}
