import { Candle, Timeframe } from '../types';
import { QuantFeatureEngine, QuantFeatures } from './featureEngine';
import { DetailedMarketStructure, MarketStructureEngine } from './marketStructureEngine';
import { DetailedMTFAnalysis, MultiTimeframeEngine } from './multiTimeframeEngine';
import { MarketRegimeEngine } from './regimeEngine';
import { MarketRegimeState } from '../types';

export type SetupState = 'NO_SETUP' | 'FORMING' | 'CONFIRMED' | 'ACTIVE' | 'INVALIDATED';

export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface EvidenceFactor {
  name: string;
  category: 'TREND' | 'STRUCTURE' | 'MOMENTUM' | 'MTF' | 'VOLATILITY' | 'VOLUME' | 'RISK';
  value: string | number;
  contribution: number; // positive or negative points
  reason: string;
}

export interface TradePlan {
  entryPrice: number;
  entryZone: [number, number];
  entryStrategy: 'BREAKOUT_LEVEL' | 'SUPPORT_RETEST' | 'RESISTANCE_RETEST' | 'VWAP_PULLBACK' | 'CURRENT_MARKET';
  stopLoss: number;
  stopLossDistance: number;
  stopLossPercent: number;
  stopLossAtrMultiple: number;
  takeProfit1: number;
  takeProfit2: number;
  tp1Distance: number;
  tp2Distance: number;
  riskRewardRatio: number;
  hasValidTarget: boolean;
}

export interface UnifiedSignalResult {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  direction: SignalDirection;
  setupState: SetupState;
  setupGrade: 'A+' | 'A' | 'B' | 'C' | 'NONE';
  setupQuality: number; // 0 - 100
  modelConfidence: number; // 0 - 100%
  tradePlan: TradePlan | null;
  evidence: EvidenceFactor[];
  riskWarnings: string[];
  invalidationCriteria: string[];
  marketState: {
    regime: string;
    regimeConfidence: number;
    trendSlope: number;
    atrPercent: number;
  };
  structure: {
    state: string;
    keySupport: number;
    keyResistance: number;
  };
  mtf: {
    alignmentScore: number;
    dominantBias: string;
  };
  rejectionReason?: string;
}

export class SignalDecisionEngine {
  /**
   * Deterministic institutional signal pipeline:
   * MARKET DATA -> FEATURES -> STRUCTURE -> REGIME -> MTF -> SETUP DETECTION -> RISK CHECK -> DECISION
   */
  public static evaluate(
    candles: Candle[],
    symbol = 'BTCUSDT',
    timeframe: Timeframe = '1h',
    isMarketOpen = true,
    isDataLive = true,
    minRiskRewardThreshold = 1.5
  ): UnifiedSignalResult {
    const timestamp = Date.now();
    const id = `sig-${symbol}-${timeframe}-${timestamp}`;

    // Gate 1: Insufficient history
    if (!candles || candles.length < 30) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Недостаточно исторических свечей (минимум 30) для статистического анализа.',
        candles
      );
    }

    // Gate 2: Data stale or market closed
    if (!isDataLive) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Данные котировок не обновляются или находятся в статусе OFFLINE. Торговые сигналы заблокированы.',
        candles
      );
    }

    // 1. Calculate features
    const features = QuantFeatureEngine.extractFeatures(candles);
    if (!features) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Ошибка извлечения количественных признаков.',
        candles
      );
    }

    // 2. Analyze market structure
    const structure = MarketStructureEngine.analyze(candles);

    // 3. Classify market regime
    const regime = MarketRegimeEngine.classify(candles, features, structure);

    // 4. Multi-Timeframe Alignment
    const mtf = MultiTimeframeEngine.analyze(candles, timeframe);

    // Gate 3: Extreme Volatility filter
    if (features.atrPercent > 5.5) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        `Экстремальная волатильность (ATR ${features.atrPercent.toFixed(2)}% > 5.5%). Повышенный риск каскадных ликвидаций.`,
        candles, features, structure, regime, mtf
      );
    }

    // 5. Evaluate Long and Short Setups via distinct symmetric models
    const longEvaluation = this.evaluateLongSetup(features, structure, regime, mtf);
    const shortEvaluation = this.evaluateShortSetup(features, structure, regime, mtf);

    // Pick candidate based on validated score
    let candidateDirection: SignalDirection = 'NEUTRAL';
    let candidateQuality = 0;
    let candidateEvidence: EvidenceFactor[] = [];
    let candidateState: SetupState = 'NO_SETUP';

    if (longEvaluation.isValid && longEvaluation.quality >= 60 && longEvaluation.quality > shortEvaluation.quality) {
      candidateDirection = 'LONG';
      candidateQuality = longEvaluation.quality;
      candidateEvidence = longEvaluation.evidence;
      candidateState = longEvaluation.state;
    } else if (shortEvaluation.isValid && shortEvaluation.quality >= 60 && shortEvaluation.quality > longEvaluation.quality) {
      candidateDirection = 'SHORT';
      candidateQuality = shortEvaluation.quality;
      candidateEvidence = shortEvaluation.evidence;
      candidateState = shortEvaluation.state;
    } else {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Рынок находится в фазе бокового накопления / отсутствуют подтверждённые условия входа.',
        candles, features, structure, regime, mtf,
        [...longEvaluation.evidence, ...shortEvaluation.evidence]
      );
    }

    // 6. Construct structural trade plan (Entry, SL, TP, R:R)
    const tradePlan = this.buildTradePlan(
      candidateDirection,
      features,
      structure,
      timeframe
    );

    // Gate 4: Risk / Reward Filter
    if (!tradePlan.hasValidTarget || tradePlan.riskRewardRatio < minRiskRewardThreshold) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        `Неприемлемый коэффициент риск/прибыль (R:R ${tradePlan.riskRewardRatio.toFixed(2)} < ${minRiskRewardThreshold.toFixed(1)}). Ближайшая преграда расположена слишком близко.`,
        candles, features, structure, regime, mtf,
        candidateEvidence
      );
    }

    // Gate 5: Stop loss distance check
    if (tradePlan.stopLossAtrMultiple > 3.5 || tradePlan.stopLossPercent > 7.0) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        `Слишком широкий стоп-лосс (${tradePlan.stopLossPercent.toFixed(2)}% / ${tradePlan.stopLossAtrMultiple.toFixed(1)} ATR). Защита позиции экономически нецелесообразна.`,
        candles, features, structure, regime, mtf,
        candidateEvidence
      );
    }

    // 7. Calculate Model Confidence
    // Based on indicator consensus: MTF alignment, regime confidence, and ADX strength
    const modelConfidence = Math.min(
      94,
      Math.round(
        (mtf.alignmentScore * 0.40) +
        (regime.confidence * 0.35) +
        (Math.min(40, features.adx.adx14) / 40 * 25)
      )
    );

    // Setup Grade
    let setupGrade: 'A+' | 'A' | 'B' | 'C' = 'C';
    if (candidateQuality >= 85 && tradePlan.riskRewardRatio >= 2.2) setupGrade = 'A+';
    else if (candidateQuality >= 75 && tradePlan.riskRewardRatio >= 1.8) setupGrade = 'A';
    else if (candidateQuality >= 65 && tradePlan.riskRewardRatio >= 1.5) setupGrade = 'B';

    // Warnings and Invalidation
    const riskWarnings: string[] = [];
    if (features.atrPercent > 2.5) {
      riskWarnings.push(`Повышенная волатильность (${features.atrPercent.toFixed(2)}% ATR): снизьте рабочий размер позиции.`);
    }
    if (mtf.conflicts.length > 0) {
      riskWarnings.push(mtf.conflicts[0]);
    }
    if (structure.distanceToResistancePct < 1.0 && candidateDirection === 'LONG') {
      riskWarnings.push(`Сопротивление расположено близко (${structure.distanceToResistancePct.toFixed(2)}% от входа).`);
    }

    const invalidationCriteria: string[] = [
      candidateDirection === 'LONG'
        ? `Закрытие свечи ${timeframe} ниже опорного уровня $${tradePlan.stopLoss}`
        : `Закрытие свечи ${timeframe} выше барьера сопротивления $${tradePlan.stopLoss}`,
      `Резкая смена рыночного режима на ${candidateDirection === 'LONG' ? 'TRENDING_BEAR' : 'TRENDING_BULL'}`,
    ];

    return {
      id,
      symbol,
      timeframe,
      timestamp,
      direction: candidateDirection,
      setupState: candidateState,
      setupGrade,
      setupQuality: candidateQuality,
      modelConfidence,
      tradePlan,
      evidence: candidateEvidence,
      riskWarnings,
      invalidationCriteria,
      marketState: {
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        trendSlope: features.trendSlope,
        atrPercent: features.atrPercent,
      },
      structure: {
        state: structure.state,
        keySupport: structure.keySupport,
        keyResistance: structure.keyResistance,
      },
      mtf: {
        alignmentScore: mtf.alignmentScore,
        dominantBias: mtf.dominantBias,
      },
    };
  }

  /**
   * Dedicated Long Setup Evaluation
   */
  private static evaluateLongSetup(
    feat: QuantFeatures,
    struct: DetailedMarketStructure,
    regime: MarketRegimeState,
    mtf: DetailedMTFAnalysis
  ): { isValid: boolean; quality: number; state: SetupState; evidence: EvidenceFactor[] } {
    const evidence: EvidenceFactor[] = [];
    let score = 0;

    // 1. Trend Factor (max 22)
    if (feat.price > feat.ema20 && feat.ema20 > feat.ema50 && feat.trendSlope > 0) {
      score += 22;
      evidence.push({
        name: 'Бычий тренд EMA',
        category: 'TREND',
        value: `+${feat.trendSlope.toFixed(2)}%/бар`,
        contribution: 22,
        reason: 'Цена выше EMA20, восходящий наклон скользящих средних подтверждает спрос.',
      });
    } else if (feat.price > feat.ema20) {
      score += 12;
      evidence.push({
        name: 'Удержание EMA20',
        category: 'TREND',
        value: `$${feat.ema20.toFixed(2)}`,
        contribution: 12,
        reason: 'Цена удерживается выше краткосрочной экспоненциальной средней.',
      });
    }

    // 2. Structure Factor (max 22)
    if (struct.state === 'BREAKOUT') {
      score += 22;
      evidence.push({
        name: 'Структурный пробой вверх (BOS)',
        category: 'STRUCTURE',
        value: `Выше $${struct.recentSwingHigh}`,
        contribution: 22,
        reason: 'Импульсный пробой локального максимума с обновлением рыночной структуры.',
      });
    } else if (struct.state === 'BULLISH_STRUCTURE') {
      score += 18;
      evidence.push({
        name: 'Восходящая структура (HH/HL)',
        category: 'STRUCTURE',
        value: 'Повышающиеся экстремумы',
        contribution: 18,
        reason: 'Формирование серии Higher Highs и Higher Lows.',
      });
    }

    // 3. Momentum Factor (max 18)
    if (feat.rsi14 >= 52 && feat.rsi14 <= 68 && feat.macd.histogram > 0) {
      score += 18;
      evidence.push({
        name: 'Бычий импульс RSI & MACD',
        category: 'MOMENTUM',
        value: `RSI: ${feat.rsi14}, Hist: +${feat.macd.histogram}`,
        contribution: 18,
        reason: 'Здоровый восходящий импульс без признаков истощения или перекупленности.',
      });
    } else if (feat.rsi14 > 48 && feat.adx.plusDI > feat.adx.minusDI) {
      score += 10;
      evidence.push({
        name: 'Положительный направленный индекс',
        category: 'MOMENTUM',
        value: `+DI: ${feat.adx.plusDI} > -DI: ${feat.adx.minusDI}`,
        contribution: 10,
        reason: 'Преобладание покупателей над продавцами в направленном движении.',
      });
    }

    // 4. MTF Alignment Factor (max 18)
    if (mtf.dominantBias === 'BULLISH' && mtf.alignmentScore >= 70) {
      const contrib = Math.round((mtf.alignmentScore / 100) * 18);
      score += contrib;
      evidence.push({
        name: 'Синхронизация таймфреймов',
        category: 'MTF',
        value: `${mtf.alignmentScore}%`,
        contribution: contrib,
        reason: 'Старшие и рабочие таймфреймы синхронно указывают на покупки.',
      });
    }

    // 5. Volume Factor (max 12)
    if (feat.volumeRatio >= 1.2) {
      score += 12;
      evidence.push({
        name: 'Всплеск институционального объёма',
        category: 'VOLUME',
        value: `${feat.volumeRatio.toFixed(1)}x`,
        contribution: 12,
        reason: 'Объём текущей свечи существенно превышает 20-периодное среднее значение.',
      });
    }

    // 6. Risk Penalties (0 to -15)
    if (feat.rsi14 > 74) {
      score -= 8;
      evidence.push({
        name: 'Штраф: Риск перекупленности',
        category: 'RISK',
        value: `RSI: ${feat.rsi14}`,
        contribution: -8,
        reason: 'Осциллятор в зоне экстремума: повышен риск глубокой коррекции.',
      });
    }
    if (struct.distanceToResistancePct < 0.6) {
      score -= 7;
      evidence.push({
        name: 'Штраф: Вход в сопротивление',
        category: 'RISK',
        value: `${struct.distanceToResistancePct.toFixed(2)}% до уровня`,
        contribution: -7,
        reason: 'Покупка непосредственно под подтверждённым уровнем сопротивления.',
      });
    }

    const quality = Math.max(0, Math.min(100, score));
    const isValid = quality >= 60 && (struct.state === 'BULLISH_STRUCTURE' || struct.state === 'BREAKOUT' || regime.regime === 'TRENDING_BULL');
    const state: SetupState = struct.state === 'BREAKOUT' ? 'ACTIVE' : quality >= 75 ? 'CONFIRMED' : 'FORMING';

    return { isValid, quality, state, evidence };
  }

  /**
   * Dedicated Short Setup Evaluation (NOT simple inverted long!)
   */
  private static evaluateShortSetup(
    feat: QuantFeatures,
    struct: DetailedMarketStructure,
    regime: MarketRegimeState,
    mtf: DetailedMTFAnalysis
  ): { isValid: boolean; quality: number; state: SetupState; evidence: EvidenceFactor[] } {
    const evidence: EvidenceFactor[] = [];
    let score = 0;

    // 1. Trend Factor (max 22)
    if (feat.price < feat.ema20 && feat.ema20 < feat.ema50 && feat.trendSlope < 0) {
      score += 22;
      evidence.push({
        name: 'Медвежий тренд EMA',
        category: 'TREND',
        value: `${feat.trendSlope.toFixed(2)}%/бар`,
        contribution: 22,
        reason: 'Цена ниже EMA20, нисходящий веер скользящих средних подтверждает давление продавцов.',
      });
    } else if (feat.price < feat.ema20) {
      score += 12;
      evidence.push({
        name: 'Слабость под EMA20',
        category: 'TREND',
        value: `$${feat.ema20.toFixed(2)}`,
        contribution: 12,
        reason: 'Цена не может закрепиться выше скользящей средней.',
      });
    }

    // 2. Structure Factor (max 22)
    if (struct.state === 'BREAKDOWN') {
      score += 22;
      evidence.push({
        name: 'Структурный пробой вниз (Bearish BOS)',
        category: 'STRUCTURE',
        value: `Ниже $${struct.recentSwingLow}`,
        contribution: 22,
        reason: 'Импульсный пробой локального минимума с выходом из диапазона вниз.',
      });
    } else if (struct.state === 'BEARISH_STRUCTURE') {
      score += 18;
      evidence.push({
        name: 'Нисходящая структура (LH/LL)',
        category: 'STRUCTURE',
        value: 'Понижающиеся экстремумы',
        contribution: 18,
        reason: 'Формирование серии Lower Highs и Lower Lows.',
      });
    }

    // 3. Momentum Factor (max 18)
    if (feat.rsi14 <= 48 && feat.rsi14 >= 32 && feat.macd.histogram < 0) {
      score += 18;
      evidence.push({
        name: 'Медвежий импульс RSI & MACD',
        category: 'MOMENTUM',
        value: `RSI: ${feat.rsi14}, Hist: ${feat.macd.histogram}`,
        contribution: 18,
        reason: 'Импульсное ускорение продавцов без входа в зону критической перепроданности.',
      });
    } else if (feat.rsi14 < 52 && feat.adx.minusDI > feat.adx.plusDI) {
      score += 10;
      evidence.push({
        name: 'Отрицательный направленный индекс',
        category: 'MOMENTUM',
        value: `-DI: ${feat.adx.minusDI} > +DI: ${feat.adx.plusDI}`,
        contribution: 10,
        reason: 'Преобладание продавцов в направленном движении ADX.',
      });
    }

    // 4. MTF Alignment Factor (max 18)
    if (mtf.dominantBias === 'BEARISH' && mtf.alignmentScore >= 70) {
      const contrib = Math.round((mtf.alignmentScore / 100) * 18);
      score += contrib;
      evidence.push({
        name: 'Синхронизация таймфреймов',
        category: 'MTF',
        value: `${mtf.alignmentScore}%`,
        contribution: contrib,
        reason: 'Старшие таймфреймы синхронно подтверждают нисходящее давление.',
      });
    }

    // 5. Volume Factor (max 12)
    if (feat.volumeRatio >= 1.2 && feat.returns < 0) {
      score += 12;
      evidence.push({
        name: 'Всплеск объёма на продажах',
        category: 'VOLUME',
        value: `${feat.volumeRatio.toFixed(1)}x`,
        contribution: 12,
        reason: 'Нисходящее движение сопровождается притоком объёма.',
      });
    }

    // 6. Risk Penalties (0 to -15)
    if (feat.rsi14 < 26) {
      score -= 8;
      evidence.push({
        name: 'Штраф: Риск перепроданности',
        category: 'RISK',
        value: `RSI: ${feat.rsi14}`,
        contribution: -8,
        reason: 'Осциллятор в зоне экстремальной перепроданности: риск резкого шорт-сквиза.',
      });
    }
    if (struct.distanceToSupportPct < 0.6) {
      score -= 7;
      evidence.push({
        name: 'Штраф: Продажа в поддержку',
        category: 'RISK',
        value: `${struct.distanceToSupportPct.toFixed(2)}% до уровня`,
        contribution: -7,
        reason: 'Вход в позицию вблизи ключевой зоны покупателей.',
      });
    }

    const quality = Math.max(0, Math.min(100, score));
    const isValid = quality >= 60 && (struct.state === 'BEARISH_STRUCTURE' || struct.state === 'BREAKDOWN' || regime.regime === 'TRENDING_BEAR');
    const state: SetupState = struct.state === 'BREAKDOWN' ? 'ACTIVE' : quality >= 75 ? 'CONFIRMED' : 'FORMING';

    return { isValid, quality, state, evidence };
  }

  /**
   * Constructs an authentic, structure-derived Trade Plan.
   */
  private static buildTradePlan(
    direction: SignalDirection,
    feat: QuantFeatures,
    struct: DetailedMarketStructure,
    timeframe: Timeframe
  ): TradePlan {
    const isLong = direction === 'LONG';
    const currentPrice = feat.price;
    const atr = feat.atr14;

    // 1. Entry price and zone
    let entryPrice = currentPrice;
    let entryStrategy: TradePlan['entryStrategy'] = 'CURRENT_MARKET';

    if (isLong && struct.state === 'BREAKOUT' && struct.recentSwingHigh > 0) {
      entryPrice = Math.max(currentPrice, struct.recentSwingHigh);
      entryStrategy = 'BREAKOUT_LEVEL';
    } else if (!isLong && struct.state === 'BREAKDOWN' && struct.recentSwingLow > 0) {
      entryPrice = Math.min(currentPrice, struct.recentSwingLow);
      entryStrategy = 'BREAKOUT_LEVEL';
    } else if (isLong && struct.keySupport > 0 && Math.abs(currentPrice - struct.keySupport) < atr * 1.5) {
      entryPrice = currentPrice;
      entryStrategy = 'SUPPORT_RETEST';
    } else if (!isLong && struct.keyResistance > 0 && Math.abs(struct.keyResistance - currentPrice) < atr * 1.5) {
      entryPrice = currentPrice;
      entryStrategy = 'RESISTANCE_RETEST';
    }

    const entryBuffer = atr * 0.15;
    const entryZone: [number, number] = isLong
      ? [Math.round((entryPrice - entryBuffer) * 10000) / 10000, Math.round(entryPrice * 10000) / 10000]
      : [Math.round(entryPrice * 10000) / 10000, Math.round((entryPrice + entryBuffer) * 10000) / 10000];

    // 2. Stop Loss (structural swing + ATR buffer, capped at 2.5 ATR)
    let stopLoss = 0;
    if (isLong) {
      let structuralStop = struct.keySupport > 0 && struct.keySupport < entryPrice
        ? struct.keySupport - atr * 0.3
        : entryPrice - atr * 1.5;
      if (entryPrice - structuralStop > atr * 2.5) {
        structuralStop = entryPrice - atr * 2.0;
      }
      stopLoss = Math.round(structuralStop * 10000) / 10000;
    } else {
      let structuralStop = struct.keyResistance > 0 && struct.keyResistance > entryPrice
        ? struct.keyResistance + atr * 0.3
        : entryPrice + atr * 1.5;
      if (structuralStop - entryPrice > atr * 2.5) {
        structuralStop = entryPrice + atr * 2.0;
      }
      stopLoss = Math.round(structuralStop * 10000) / 10000;
    }

    const stopLossDistance = Math.abs(entryPrice - stopLoss);
    const stopLossPercent = entryPrice > 0 ? Math.round((stopLossDistance / entryPrice) * 10000) / 100 : 0;
    const stopLossAtrMultiple = atr > 0 ? Math.round((stopLossDistance / atr) * 10) / 10 : 1.5;

    // 3. Take Profit 1 & Take Profit 2 based on structure and minimum R:R
    let takeProfit1 = 0;
    let takeProfit2 = 0;
    let hasValidTarget = false;

    if (isLong) {
      // Nearest resistance or 1.5R minimum
      const target1 = struct.keyResistance > entryPrice + stopLossDistance * 1.2
        ? struct.keyResistance
        : entryPrice + stopLossDistance * 1.6;

      const target2 = entryPrice + stopLossDistance * 2.8;

      takeProfit1 = Math.round(target1 * 10000) / 10000;
      takeProfit2 = Math.round(target2 * 10000) / 10000;
      hasValidTarget = takeProfit1 > entryPrice;
    } else {
      // Nearest support or 1.5R minimum
      const target1 = struct.keySupport > 0 && struct.keySupport < entryPrice - stopLossDistance * 1.2
        ? struct.keySupport
        : entryPrice - stopLossDistance * 1.6;

      const target2 = entryPrice - stopLossDistance * 2.8;

      takeProfit1 = Math.round(target1 * 10000) / 10000;
      takeProfit2 = Math.round(target2 * 10000) / 10000;
      hasValidTarget = takeProfit1 < entryPrice;
    }

    const tp1Distance = Math.abs(takeProfit1 - entryPrice);
    const tp2Distance = Math.abs(takeProfit2 - entryPrice);
    const riskRewardRatio = stopLossDistance > 0 ? Math.round((tp2Distance / stopLossDistance) * 100) / 100 : 0;

    return {
      entryPrice: Math.round(entryPrice * 10000) / 10000,
      entryZone,
      entryStrategy,
      stopLoss,
      stopLossDistance: Math.round(stopLossDistance * 10000) / 10000,
      stopLossPercent,
      stopLossAtrMultiple,
      takeProfit1,
      takeProfit2,
      tp1Distance: Math.round(tp1Distance * 10000) / 10000,
      tp2Distance: Math.round(tp2Distance * 10000) / 10000,
      riskRewardRatio,
      hasValidTarget,
    };
  }

  private static createNoSetupResult(
    id: string,
    symbol: string,
    timeframe: Timeframe,
    timestamp: number,
    rejectionReason: string,
    candles?: Candle[],
    features?: QuantFeatures,
    structure?: DetailedMarketStructure,
    regime?: MarketRegimeState,
    mtf?: DetailedMTFAnalysis,
    evidence: EvidenceFactor[] = []
  ): UnifiedSignalResult {
    const p = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;

    return {
      id,
      symbol,
      timeframe,
      timestamp,
      direction: 'NEUTRAL',
      setupState: 'NO_SETUP',
      setupGrade: 'NONE',
      setupQuality: 0,
      modelConfidence: 0,
      tradePlan: null,
      evidence,
      riskWarnings: [rejectionReason],
      invalidationCriteria: ['Рыночные условия не удовлетворяют критериям направленного преимущества.'],
      marketState: {
        regime: regime?.regime || 'UNCERTAIN',
        regimeConfidence: regime?.confidence || 0,
        trendSlope: features?.trendSlope || 0,
        atrPercent: features?.atrPercent || 0,
      },
      structure: {
        state: structure?.state || 'UNCERTAIN',
        keySupport: structure?.keySupport || p,
        keyResistance: structure?.keyResistance || p,
      },
      mtf: {
        alignmentScore: mtf?.alignmentScore || 0,
        dominantBias: mtf?.dominantBias || 'NEUTRAL',
      },
      rejectionReason,
    };
  }
}
