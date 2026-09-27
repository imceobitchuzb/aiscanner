import { QuantFeatures } from './featureEngine';
import { DetailedMarketStructure } from './marketStructureEngine';
import { MarketRegimeState, Timeframe } from '../types';

export interface DynamicTradePlan {
  entryPrice: number;
  entryZone: [number, number];
  entryStrategy: 'CURRENT_MARKET' | 'BREAKOUT_LEVEL' | 'SUPPORT_RETEST' | 'RESISTANCE_RETEST';
  stopLoss: number;
  stopLossDistance: number;
  stopLossPercent: number;
  stopLossAtrMultiple: number;
  stopLossRationale: string;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  tp1Distance: number;
  tp2Distance: number;
  tp3Distance?: number;
  riskRewardRatio: number;
  hasValidTarget: boolean;
  trailingStrategy: 'STRUCTURE_TRAILING' | 'TIGHT_TARGET_TRAILING' | 'WIDE_VOLATILITY_TRAILING';
  trailingStepAtr: number;
  breakevenThresholdR: number;
}

export class DynamicTradePlanEngine {
  /**
   * Constructs an authentic, deterministic trade plan with regime-aware SL, TP1, TP2, TP3 and trailing rules.
   * Strictly uses data available before trade execution (Zero Lookahead).
   */
  public static buildPlan(
    direction: 'LONG' | 'SHORT',
    features: QuantFeatures,
    structure: DetailedMarketStructure,
    regime: MarketRegimeState,
    timeframe: Timeframe,
    useStaticPlan = false
  ): DynamicTradePlan {
    const isLong = direction === 'LONG';
    const currentPrice = features.price;
    const atr = features.atr14;

    // 1. Entry Level & Strategy
    let entryPrice = currentPrice;
    let entryStrategy: DynamicTradePlan['entryStrategy'] = 'CURRENT_MARKET';

    if (isLong && structure.state === 'BREAKOUT' && structure.recentSwingHigh > 0) {
      entryPrice = Math.max(currentPrice, structure.recentSwingHigh);
      entryStrategy = 'BREAKOUT_LEVEL';
    } else if (!isLong && structure.state === 'BREAKDOWN' && structure.recentSwingLow > 0) {
      entryPrice = Math.min(currentPrice, structure.recentSwingLow);
      entryStrategy = 'BREAKOUT_LEVEL';
    } else if (isLong && structure.keySupport > 0 && Math.abs(currentPrice - structure.keySupport) < atr * 1.5) {
      entryPrice = currentPrice;
      entryStrategy = 'SUPPORT_RETEST';
    } else if (!isLong && structure.keyResistance > 0 && Math.abs(structure.keyResistance - currentPrice) < atr * 1.5) {
      entryPrice = currentPrice;
      entryStrategy = 'RESISTANCE_RETEST';
    }

    const entryBuffer = atr * 0.15;
    const entryZone: [number, number] = isLong
      ? [Math.round((entryPrice - entryBuffer) * 10000) / 10000, Math.round(entryPrice * 10000) / 10000]
      : [Math.round(entryPrice * 10000) / 10000, Math.round((entryPrice + entryBuffer) * 10000) / 10000];

    // 2. Regime-Aware Dynamic Stop Loss
    let bufferMultiplier = 0.3;
    let trailingStrategy: DynamicTradePlan['trailingStrategy'] = 'STRUCTURE_TRAILING';
    let trailingStepAtr = 1.0;
    let breakevenThresholdR = 1.0;

    if (!useStaticPlan) {
      switch (regime.regime) {
        case 'HIGH_VOLATILITY':
          bufferMultiplier = 0.50; // wider buffer to prevent volatility whipsaws
          trailingStrategy = 'WIDE_VOLATILITY_TRAILING';
          trailingStepAtr = 1.8;
          breakevenThresholdR = 1.3;
          break;
        case 'RANGE':
        case 'ACCUMULATION':
        case 'DISTRIBUTION':
          bufferMultiplier = 0.20; // tight boundary stops for mean reversion
          trailingStrategy = 'TIGHT_TARGET_TRAILING';
          trailingStepAtr = 0.8;
          breakevenThresholdR = 0.8;
          break;
        case 'BREAKOUT':
        case 'BREAKDOWN':
          bufferMultiplier = 0.35; // under breakout level + confirmation
          trailingStrategy = 'STRUCTURE_TRAILING';
          trailingStepAtr = 1.0;
          breakevenThresholdR = 1.0;
          break;
        case 'TRENDING_BULL':
        case 'TRENDING_BEAR':
        default:
          bufferMultiplier = 0.25;
          trailingStrategy = 'STRUCTURE_TRAILING';
          trailingStepAtr = 1.2;
          breakevenThresholdR = 1.0;
          break;
      }
    }

    let stopLoss = 0;
    let stopLossRationale = '';

    if (isLong) {
      let structuralLevel = structure.keySupport > 0 && structure.keySupport < entryPrice
        ? structure.keySupport
        : structure.recentSwingLow > 0 && structure.recentSwingLow < entryPrice
        ? structure.recentSwingLow
        : entryPrice - atr * 1.5;

      const buffer = atr * bufferMultiplier;
      stopLoss = structuralLevel - buffer;

      // Invariant bounds: minimum 0.5 ATR, maximum 2.8 ATR
      if (entryPrice - stopLoss < atr * 0.5) {
        stopLoss = entryPrice - atr * 0.5;
        stopLossRationale = `Минимальный буфер волатильности (0.5 ATR).`;
      } else if (entryPrice - stopLoss > atr * 2.8) {
        stopLoss = entryPrice - atr * 2.8;
        stopLossRationale = `Стоп ограничен максимальным порогом (2.8 ATR) для контроля риска.`;
      } else {
        stopLossRationale = `Структурный уровень ($${structuralLevel.toFixed(2)}) с буфером ${bufferMultiplier} ATR ($${buffer.toFixed(2)}).`;
      }
    } else {
      let structuralLevel = structure.keyResistance > 0 && structure.keyResistance > entryPrice
        ? structure.keyResistance
        : structure.recentSwingHigh > 0 && structure.recentSwingHigh > entryPrice
        ? structure.recentSwingHigh
        : entryPrice + atr * 1.5;

      const buffer = atr * bufferMultiplier;
      stopLoss = structuralLevel + buffer;

      if (stopLoss - entryPrice < atr * 0.5) {
        stopLoss = entryPrice + atr * 0.5;
        stopLossRationale = `Минимальный буфер волатильности (0.5 ATR).`;
      } else if (stopLoss - entryPrice > atr * 2.8) {
        stopLoss = entryPrice + atr * 2.8;
        stopLossRationale = `Стоп ограничен максимальным порогом (2.8 ATR) для контроля риска.`;
      } else {
        stopLossRationale = `Структурный уровень ($${structuralLevel.toFixed(2)}) с буфером ${bufferMultiplier} ATR ($${buffer.toFixed(2)}).`;
      }
    }

    const stopLossDistance = Math.abs(entryPrice - stopLoss);
    const stopLossPercent = entryPrice > 0 ? Math.round((stopLossDistance / entryPrice) * 10000) / 100 : 0;
    const stopLossAtrMultiple = atr > 0 ? Math.round((stopLossDistance / atr) * 10) / 10 : 1.5;

    // 3. Dynamic Take Profit Levels (TP1, TP2, TP3)
    let takeProfit1 = 0;
    let takeProfit2 = 0;
    let takeProfit3 = 0;
    let hasValidTarget = true;

    if (isLong) {
      const minTp1Distance = stopLossDistance * 1.2;
      const minTp2Distance = stopLossDistance * 2.0;

      if (structure.keyResistance > entryPrice && structure.keyResistance - entryPrice >= minTp1Distance) {
        takeProfit1 = structure.keyResistance;
        takeProfit2 = entryPrice + Math.max(minTp2Distance, (structure.keyResistance - entryPrice) * 1.618);
        takeProfit3 = entryPrice + stopLossDistance * 3.0;
      } else {
        takeProfit1 = entryPrice + minTp1Distance;
        takeProfit2 = entryPrice + minTp2Distance;
        takeProfit3 = entryPrice + stopLossDistance * 3.0;
        if (structure.keyResistance > entryPrice && structure.keyResistance - entryPrice < minTp1Distance) {
          // If structure indicates a fresh breakout or strong trend continuation, target projects beyond breached swing
          if (regime.regime !== 'BREAKOUT' && structure.lastBreakType !== 'BULLISH_BOS') {
            hasValidTarget = false; // Resistance is too close for adequate R:R in normal ranging conditions
          }
        }
      }
    } else {
      const minTp1Distance = stopLossDistance * 1.2;
      const minTp2Distance = stopLossDistance * 2.0;

      if (structure.keySupport > 0 && structure.keySupport < entryPrice && entryPrice - structure.keySupport >= minTp1Distance) {
        takeProfit1 = structure.keySupport;
        takeProfit2 = entryPrice - Math.max(minTp2Distance, (entryPrice - structure.keySupport) * 1.618);
        takeProfit3 = entryPrice - stopLossDistance * 3.0;
      } else {
        takeProfit1 = entryPrice - minTp1Distance;
        takeProfit2 = entryPrice - minTp2Distance;
        takeProfit3 = entryPrice - stopLossDistance * 3.0;
        if (structure.keySupport > 0 && entryPrice - structure.keySupport < minTp1Distance) {
          if (regime.regime !== 'BREAKOUT' && structure.lastBreakType !== 'BEARISH_BOS') {
            hasValidTarget = false;
          }
        }
      }
    }

    const tp1Distance = Math.abs(takeProfit1 - entryPrice);
    const tp2Distance = Math.abs(takeProfit2 - entryPrice);
    const tp3Distance = Math.abs(takeProfit3 - entryPrice);
    const riskRewardRatio = stopLossDistance > 0 ? Math.round((tp2Distance / stopLossDistance) * 100) / 100 : 0;

    return {
      entryPrice: Math.round(entryPrice * 10000) / 10000,
      entryZone,
      entryStrategy,
      stopLoss: Math.round(stopLoss * 10000) / 10000,
      stopLossDistance: Math.round(stopLossDistance * 10000) / 10000,
      stopLossPercent,
      stopLossAtrMultiple,
      stopLossRationale,
      takeProfit1: Math.round(takeProfit1 * 10000) / 10000,
      takeProfit2: Math.round(takeProfit2 * 10000) / 10000,
      takeProfit3: Math.round(takeProfit3 * 10000) / 10000,
      tp1Distance: Math.round(tp1Distance * 10000) / 10000,
      tp2Distance: Math.round(tp2Distance * 10000) / 10000,
      tp3Distance: Math.round(tp3Distance * 10000) / 10000,
      riskRewardRatio,
      hasValidTarget,
      trailingStrategy,
      trailingStepAtr,
      breakevenThresholdR,
    };
  }
}
