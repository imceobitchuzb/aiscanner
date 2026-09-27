import { Candle, Timeframe } from '../types';
import { QuantFeatureEngine, QuantFeatures } from './featureEngine';
import { DetailedMarketStructure, MarketStructureEngine } from './marketStructureEngine';
import { DetailedMTFAnalysis, MultiTimeframeEngine } from './multiTimeframeEngine';
import { MarketRegimeEngine } from './regimeEngine';
import { MarketRegimeState } from '../types';
import { AdaptiveWeightEngine, WeightProfile } from './weightProfiles';
import { ConflictReport, SignalConflictEngine } from './signalConflictEngine';
import { ContextAwareQualityEngine, ContextAwareQualityResult } from './contextAwareQualityEngine';
import { DynamicTradePlan, DynamicTradePlanEngine } from './dynamicTradePlanEngine';
import { PositionSizeResult, PositionSizingEngine } from './positionSizingEngine';
import {
  EvidenceFactor,
  FilterAblationConfig,
  FunnelStage,
  RejectionReasonCode,
  SetupState,
  SignalDirection,
  UnifiedSignalResult,
} from './signalDecisionEngine';
import { ForexSessionEngine, ForexSessionState } from './forexSessionEngine';
import { SignalAuditTrail } from './signalAuditTrail';
import { CryptoConfirmationEngine, CryptoConfirmationResult } from './cryptoConfirmationEngine';
import { ForexPipEngine } from './forexPipEngine';

export interface AdaptiveSignalResult extends UnifiedSignalResult {
  weightProfile: WeightProfile;
  conflictReport: ConflictReport;
  qualityBreakdown: ContextAwareQualityResult;
  positionSizing: PositionSizeResult;
  dynamicPlan: DynamicTradePlan;
  mtfConflictLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  forexSession?: ForexSessionState;
  forexSessionContext?: ForexSessionState;
  cryptoConfirmation?: {
    isApproved: boolean;
    verdict: string;
    isPullback: boolean;
    isLiquiditySweepRisk: boolean;
  };
  provenance: {
    source: string;
    timestamp: number;
    freshness: 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE';
    latencyMs: number;
    bid: number;
    ask: number;
    spread: number;
  };
}

export class AdaptiveSignalEngine {
  /**
   * Deterministic Adaptive Institutional Signal Pipeline:
   * 1. Data Provenance & Invariants Check
   * 2. Quantitative Features Extraction
   * 3. Market Structure & Swing Detection
   * 4. Market Regime Classification
   * 5. Hierarchical Multi-Timeframe Alignment
   * 6. Dynamic Factor Weighting per Regime
   * 7. Cross-Dimensional Conflict Detection
   * 8. Context-Aware Quality Scoring (0-100)
   * 9. Opportunity State Classification (NO_SETUP, FORMING, WATCH, CONFIRMED, ACTIVE)
   * 10. Dynamic SL, TP1-3 & Position Sizing
   */
  public static evaluate(
    candles: Candle[],
    symbol = 'BTCUSDT',
    timeframe: Timeframe = '1h',
    isMarketOpen = true,
    isDataLive = true,
    minRiskRewardThreshold = 1.5,
    ablation?: FilterAblationConfig
  ): AdaptiveSignalResult {
    const timestamp = Date.now();
    const id = `asig-${symbol}-${timeframe}-${timestamp}`;

    // Provenance metadata
    const lastPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
    const spreadEst = Math.round(lastPrice * 0.0002 * 10000) / 10000;
    const provenance = {
      source: symbol.includes('USDT') ? 'Binance Spot' : symbol.includes('XAU') ? 'LBMA / COMEX' : 'Interbank FX',
      timestamp,
      freshness: isDataLive ? 'LIVE' as const : 'STALE' as const,
      latencyMs: isDataLive ? 18 : 3400,
      bid: Math.round((lastPrice - spreadEst / 2) * 10000) / 10000,
      ask: Math.round((lastPrice + spreadEst / 2) * 10000) / 10000,
      spread: spreadEst,
    };

    // Gate 1: Insufficient history
    if (!candles || candles.length < 30) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Недостаточно исторических свечей (минимум 30) для статистического анализа.',
        'INSUFFICIENT_DATA',
        'POTENTIAL',
        candles,
        provenance
      );
    }

    // Gate 2: Data stale or market closed
    if (!isDataLive) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Данные котировок не обновляются или находятся в статусе OFFLINE. Торговые сигналы заблокированы.',
        'STALE_DATA',
        'POTENTIAL',
        candles,
        provenance
      );
    }

    if (!isMarketOpen) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Рынок закрыт (вне торговых часов биржи). Сигналы заблокированы.',
        'MARKET_CLOSED',
        'POTENTIAL',
        candles,
        provenance
      );
    }

    // 1. Extract Quantitative Features
    const features = QuantFeatureEngine.extractFeatures(candles);
    if (!features) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Ошибка извлечения количественных признаков.',
        'OTHER',
        'POTENTIAL',
        candles,
        provenance
      );
    }

    // 2. Analyze Market Structure
    const structure = MarketStructureEngine.analyze(candles);

    // 3. Classify Market Regime
    const regime = MarketRegimeEngine.classify(candles, features, structure);

    // 4. Multi-Timeframe Alignment
    const mtf = MultiTimeframeEngine.analyze(candles, timeframe);

    // Gate 3: Extreme Volatility Filter
    if (!ablation?.skipVolatilityFilter && features.atrPercent > 5.5) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        `Экстремальная волатильность (ATR ${features.atrPercent.toFixed(2)}% > 5.5%). Повышенный риск каскадных ликвидаций.`,
        'HIGH_VOLATILITY',
        'REGIME_PASSED',
        candles,
        provenance,
        features, structure, regime, mtf
      );
    }

    // 5. Select Dynamic Factor Weight Profile based on Regime
    const weightProfile = AdaptiveWeightEngine.getProfile(regime.regime, ablation?.useStaticWeights);

    // 6. Directional candidate hypothesis (Long vs Short)
    const longBias = features.price > features.ema20 && features.trendSlope >= -0.05;
    const shortBias = features.price < features.ema20 && features.trendSlope <= 0.05;

    let candidateDirection: SignalDirection = 'NEUTRAL';
    if (longBias && !shortBias) candidateDirection = 'LONG';
    else if (shortBias && !longBias) candidateDirection = 'SHORT';
    else if (features.trendSlope > 0) candidateDirection = 'LONG';
    else if (features.trendSlope < 0) candidateDirection = 'SHORT';

    // 6b. Crypto 15m Higher-Timeframe Structural Confirmation & Liquidity Sweep Gating (Phase 6)
    const cryptoValidation = CryptoConfirmationEngine.validateShortTimeframeCrypto(
      candles,
      candidateDirection === 'SHORT' ? 'SHORT' : 'LONG',
      structure,
      regime,
      features,
      symbol,
      timeframe
    );

    if (!cryptoValidation.isApproved) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        cryptoValidation.reason,
        cryptoValidation.verdict as RejectionReasonCode,
        'STRUCTURE_PASSED',
        candles,
        provenance,
        features, structure, regime, mtf,
        undefined,
        weightProfile
      );
    }

    // 7. Dynamic Trade Plan (calculates structural SL, TP1, TP2, TP3 & R:R)
    const tradePlan = DynamicTradePlanEngine.buildPlan(
      candidateDirection === 'SHORT' ? 'SHORT' : 'LONG',
      features,
      structure,
      regime,
      timeframe,
      ablation?.useStaticSl
    );

    // 8. Cross-Dimensional Conflict Engine
    const conflictReport = SignalConflictEngine.evaluateConflicts(
      candidateDirection,
      features,
      structure,
      regime,
      mtf,
      timeframe,
      tradePlan.riskRewardRatio
    );

    // 9. Context-Aware Quality Scoring (0-100)
    const qualityResult = ContextAwareQualityEngine.evaluateQuality(
      candidateDirection === 'SHORT' ? 'SHORT' : 'LONG',
      features,
      structure,
      regime,
      mtf,
      timeframe,
      tradePlan.riskRewardRatio,
      weightProfile,
      conflictReport,
      symbol
    );

    if (cryptoValidation.isPullback) {
      qualityResult.overallQuality = Math.min(100, qualityResult.overallQuality + 8);
      qualityResult.dominantStrengths.push('VALIDATED_PULLBACK: подтверждённый откат в направлении 1h тренда.');
    }

    // 9b. Forex Session Context Integration (London/NY, Opening Range)
    const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || (symbol.includes('USD') && !symbol.includes('USDT') && !symbol.includes('XAU'));
    const forexSession = isForex ? ForexSessionEngine.analyzeSession(candles, symbol, timeframe) : undefined;

    if (forexSession) {
      if (forexSession.openingRangeBreakout === 'BULLISH' && candidateDirection === 'LONG') {
        qualityResult.overallQuality = Math.min(100, qualityResult.overallQuality + 5);
      } else if (forexSession.openingRangeBreakout === 'BEARISH' && candidateDirection === 'SHORT') {
        qualityResult.overallQuality = Math.min(100, qualityResult.overallQuality + 5);
      } else if (forexSession.activeSessions.includes('OFF_HOURS')) {
        conflictReport.conflicts.push({
          category: 'LIQUIDITY',
          severity: 'LOW',
          title: 'Внебиржевые часы Forex (Off-Hours)',
          description: 'Сессия после закрытия Нью-Йорка: пониженная межбанковская ликвидность.',
          mitigation: 'Снизить размер лота и избегать рыночных ордеров.',
          qualityPenalty: 5,
        });
        conflictReport.totalQualityPenalty += 5;
        qualityResult.overallQuality = Math.max(0, qualityResult.overallQuality - 5);
      }
    }

    // Gate 4: Risk / Reward Filter
    let hasAdequateRr = tradePlan.hasValidTarget && tradePlan.riskRewardRatio >= minRiskRewardThreshold;
    if (ForexPipEngine.isForexPair(symbol)) {
      const openHeadroom = tradePlan.stopLossDistance * 2.0;
      const isBreaching = candidateDirection === 'LONG'
        ? structure.lastBreakType === 'BULLISH_BOS' || features.price >= structure.keyResistance
        : structure.lastBreakType === 'BEARISH_BOS' || features.price <= structure.keySupport;

      const headroomPrice = candidateDirection === 'LONG'
        ? (!isBreaching && structure.keyResistance > features.price ? structure.keyResistance - features.price : openHeadroom)
        : (!isBreaching && features.price > structure.keySupport ? features.price - structure.keySupport : openHeadroom);

      const fxAssessment = ForexPipEngine.evaluateForexHeadroom(symbol, headroomPrice, tradePlan.stopLossDistance, minRiskRewardThreshold);
      hasAdequateRr = fxAssessment.hasValidRr;
    }

    if (!ablation?.skipRiskRewardFilter && !hasAdequateRr) {
      const rejectionReason = !tradePlan.hasValidTarget
        ? `Ближайший уровень сопротивления/поддержки расположен слишком близко к точке входа для достижения ${minRiskRewardThreshold.toFixed(1)}R.`
        : `Неприемлемый коэффициент риск/прибыль (R:R ${tradePlan.riskRewardRatio.toFixed(2)} < ${minRiskRewardThreshold.toFixed(1)}). Ближайшая преграда расположена слишком близко.`;

      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        rejectionReason,
        'BAD_RR',
        'MTF_PASSED',
        candles,
        provenance,
        features, structure, regime, mtf,
        conflictReport,
        weightProfile,
        qualityResult,
        tradePlan
      );
    }

    // Gate 5: Stop loss distance check
    if (tradePlan.stopLossAtrMultiple > 3.5 || tradePlan.stopLossPercent > 7.0) {
      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        `Слишком широкий стоп-лосс (${tradePlan.stopLossPercent.toFixed(2)}% / ${tradePlan.stopLossAtrMultiple.toFixed(1)} ATR). Защита позиции экономически нецелесообразна.`,
        'STOP_TOO_FAR',
        'RISK_PASSED',
        candles,
        provenance,
        features, structure, regime, mtf,
        conflictReport,
        weightProfile,
        qualityResult,
        tradePlan
      );
    }

    // 10. Position Sizing
    const positionSizing = PositionSizingEngine.calculateSize(
      tradePlan.entryPrice,
      tradePlan.stopLoss,
      qualityResult.overallQuality,
      conflictReport.overallLevel,
      regime.regime,
      { accountBalance: 10000, baseRiskPercent: 1.0 }
    );

    // 11. Market Opportunity State Classification
    let setupState: SetupState = 'NO_SETUP';
    let setupGrade: UnifiedSignalResult['setupGrade'] = 'NONE';
    let funnelStageReached: FunnelStage = 'POTENTIAL';

    if (qualityResult.overallQuality >= 75) {
      setupGrade = 'A+';
      setupState = structure.state === 'BREAKOUT' || structure.state === 'BREAKDOWN' ? 'ACTIVE' : 'CONFIRMED';
      funnelStageReached = 'FINAL_SIGNAL';
    } else if (qualityResult.overallQuality >= 65) {
      setupGrade = 'A';
      setupState = 'CONFIRMED';
      funnelStageReached = 'FINAL_SIGNAL';
    } else if (qualityResult.overallQuality >= 50) {
      setupGrade = 'B';
      setupState = 'WATCH'; // Conditions forming, monitoring for confirmed breakout
      funnelStageReached = 'RISK_PASSED';
    } else {
      setupGrade = 'NONE';
      setupState = 'NO_SETUP';
      funnelStageReached = 'STRUCTURE_PASSED';
    }

    // If quality is below 50 or major structure missing, reject cleanly
    if (setupState === 'NO_SETUP') {
      const rejCode: RejectionReasonCode = structure.state === 'UNCERTAIN' || structure.state === 'RANGE'
        ? 'WEAK_STRUCTURE'
        : conflictReport.overallLevel === 'HIGH'
        ? 'MTF_CONFLICT'
        : 'WEAK_MOMENTUM';

      return this.createNoSetupResult(
        id, symbol, timeframe, timestamp,
        'Рынок находится в фазе бокового накопления / отсутствуют подтверждённые условия направленного входа.',
        rejCode,
        funnelStageReached,
        candles,
        provenance,
        features, structure, regime, mtf,
        conflictReport,
        weightProfile,
        qualityResult,
        tradePlan
      );
    }

    // Evidence factors
    const evidence: EvidenceFactor[] = Object.values(qualityResult.factorScores).map((item) => ({
      name: item.name,
      category: item.category === 'trend' ? 'TREND' : item.category === 'structure' ? 'STRUCTURE' : item.category === 'momentum' ? 'MOMENTUM' : item.category === 'mtf' ? 'MTF' : item.category === 'volume' ? 'VOLUME' : item.category === 'volatility' ? 'VOLATILITY' : 'RISK',
      value: `${item.rawScore}/100`,
      contribution: item.weightedContribution,
      reason: item.explanation,
    }));

    // Invalidation criteria & explanations
    const invalidationPrice = tradePlan.stopLoss;
    const invalidationReason = `Нарушение структуры: закрытие свечи ниже ${invalidationPrice.toFixed(2)} отменяет сценарий.`;
    const whyThisSignal = qualityResult.dominantStrengths.map((str) => {
      const [name, score] = str.split('(');
      return {
        factor: name.trim(),
        score: parseInt(score, 10) || 75,
        description: str,
      };
    });

    const riskWarnings = conflictReport.conflicts.map((c) => `[${c.severity}] ${c.title}: ${c.description} (${c.mitigation})`);

    // Standardized trade plan for backward compatibility
    const compatTradePlan: UnifiedSignalResult['tradePlan'] = {
      entryPrice: tradePlan.entryPrice,
      entryZone: tradePlan.entryZone,
      entryStrategy: tradePlan.entryStrategy,
      stopLoss: tradePlan.stopLoss,
      stopLossDistance: tradePlan.stopLossDistance,
      stopLossPercent: tradePlan.stopLossPercent,
      stopLossAtrMultiple: tradePlan.stopLossAtrMultiple,
      takeProfit1: tradePlan.takeProfit1,
      takeProfit2: tradePlan.takeProfit2,
      tp1Distance: tradePlan.tp1Distance,
      tp2Distance: tradePlan.tp2Distance,
      riskRewardRatio: tradePlan.riskRewardRatio,
      hasValidTarget: tradePlan.hasValidTarget,
    };

    const result: AdaptiveSignalResult = {
      id,
      symbol,
      timeframe,
      timestamp,
      direction: candidateDirection,
      setupState,
      setupGrade,
      setupQuality: qualityResult.overallQuality,
      modelConfidence: Math.min(100, Math.round(qualityResult.overallQuality * 0.9 + regime.confidence * 0.1)),
      tradePlan: compatTradePlan,
      evidence,
      riskWarnings,
      invalidationCriteria: [invalidationReason],
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
      funnelStageReached,
      whyThisSignal,
      invalidationPrice,
      invalidationReason,
      weightProfile,
      conflictReport,
      qualityBreakdown: qualityResult,
      positionSizing,
      dynamicPlan: tradePlan,
      mtfConflictLevel: conflictReport.conflicts.find((c) => c.category === 'MTF')?.severity || 'NONE',
      forexSession,
      forexSessionContext: forexSession,
      cryptoConfirmation: {
        isApproved: cryptoValidation.isApproved,
        verdict: cryptoValidation.verdict,
        isPullback: cryptoValidation.isPullback,
        isLiquiditySweepRisk: cryptoValidation.isLiquiditySweepRisk,
      },
      provenance,
    };

    SignalAuditTrail.logDecision({
      id,
      timestamp,
      symbol,
      asset: symbol,
      timeframe,
      regime: regime.regime,
      htfStructure: `${cryptoValidation.structure1h.state} / ${cryptoValidation.structure4h.state}`,
      session: forexSession?.activeSession,
      setupState,
      direction: candidateDirection,
      directionalBias: candidateDirection,
      setupQuality: qualityResult.overallQuality,
      rankScore: Math.round(qualityResult.overallQuality * 0.5 + Math.min(100, tradePlan.riskRewardRatio * 25) * 0.25 + mtf.alignmentScore * 0.25 - conflictReport.totalQualityPenalty),
      mtfAlignment: mtf.alignmentScore,
      conflictLevel: conflictReport.overallLevel,
      conflictPenalty: conflictReport.totalQualityPenalty,
      volatilityState: (features?.atrPercent ?? 0) > 3.0 ? 'HIGH' : (features?.atrPercent ?? 0) < 0.8 ? 'LOW' : 'NORMAL',
      volatility: (features?.atrPercent ?? 0) > 3.0 ? 'HIGH' : (features?.atrPercent ?? 0) < 0.8 ? 'LOW' : 'NORMAL',
      liquiditySweepRisk: cryptoValidation.isLiquiditySweepRisk,
      factorScores: {
        trend: qualityResult.factorScores.trend.rawScore,
        structure: qualityResult.factorScores.structure.rawScore,
        momentum: qualityResult.factorScores.momentum.rawScore,
        volume: qualityResult.factorScores.volume.rawScore,
        volatility: qualityResult.factorScores.volatility.rawScore,
        mtf: qualityResult.factorScores.mtf.rawScore,
        riskReward: qualityResult.factorScores.riskReward.rawScore,
      },
      entryPrice: tradePlan.entryPrice,
      entry: tradePlan.entryPrice,
      stopLoss: tradePlan.stopLoss,
      sl: tradePlan.stopLoss,
      takeProfit1: tradePlan.takeProfit1,
      tp1: tradePlan.takeProfit1,
      takeProfit2: tradePlan.takeProfit2,
      tp2: tradePlan.takeProfit2,
      takeProfit3: tradePlan.takeProfit3 || 0,
      tp3: tradePlan.takeProfit3 || 0,
      riskRewardRatio: tradePlan.riskRewardRatio,
      riskMultiplier: positionSizing.actualRiskPercent,
      finalDecision: setupState === 'CONFIRMED' || setupState === 'ACTIVE' ? 'EXECUTE' : setupState === 'WATCH' ? 'WATCH' : 'REJECT',
      provenance: {
        source: provenance.source,
        freshness: provenance.freshness,
      },
    });

    return result;
  }

  private static createNoSetupResult(
    id: string,
    symbol: string,
    timeframe: Timeframe,
    timestamp: number,
    rejectionReason: string,
    rejectionCode: RejectionReasonCode = 'OTHER',
    funnelStageReached: FunnelStage = 'POTENTIAL',
    candles?: Candle[],
    provenance?: AdaptiveSignalResult['provenance'],
    features?: QuantFeatures,
    structure?: DetailedMarketStructure,
    regime?: MarketRegimeState,
    mtf?: DetailedMTFAnalysis,
    conflictReport?: ConflictReport,
    weightProfile?: WeightProfile,
    qualityResult?: ContextAwareQualityResult,
    dynamicPlan?: DynamicTradePlan
  ): AdaptiveSignalResult {
    const p = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
    const defaultProfile = weightProfile || AdaptiveWeightEngine.getProfile(regime?.regime || 'UNCERTAIN');
    const defaultConflicts: ConflictReport = conflictReport || {
      overallLevel: 'NONE',
      totalConflicts: 0,
      conflicts: [],
      totalQualityPenalty: 0,
    };
    const defaultProvenance = provenance || {
      source: 'Internal Engine',
      timestamp,
      freshness: 'LIVE' as const,
      latencyMs: 10,
      bid: p,
      ask: p,
      spread: 0,
    };

    const emptyTradePlan: DynamicTradePlan = dynamicPlan || {
      entryPrice: p,
      entryZone: [p, p],
      entryStrategy: 'CURRENT_MARKET',
      stopLoss: p * 0.98,
      stopLossDistance: p * 0.02,
      stopLossPercent: 2.0,
      stopLossAtrMultiple: 1.5,
      stopLossRationale: 'Базовый стоп-лосс',
      takeProfit1: p * 1.03,
      takeProfit2: p * 1.05,
      tp1Distance: p * 0.03,
      tp2Distance: p * 0.05,
      riskRewardRatio: 1.5,
      hasValidTarget: false,
      trailingStrategy: 'STRUCTURE_TRAILING',
      trailingStepAtr: 1.0,
      breakevenThresholdR: 1.0,
    };

    const emptyQuality: ContextAwareQualityResult = qualityResult || {
      overallQuality: 0,
      baseScore: 0,
      penalties: 0,
      factorScores: {
        trend: { name: 'Трендовая структура', category: 'trend', rawScore: 0, weight: 20, weightedContribution: 0, explanation: rejectionReason },
        structure: { name: 'Фрактальные уровни', category: 'structure', rawScore: 0, weight: 20, weightedContribution: 0, explanation: rejectionReason },
        momentum: { name: 'Импульс осцилляторов', category: 'momentum', rawScore: 0, weight: 20, weightedContribution: 0, explanation: rejectionReason },
        volume: { name: 'Институциональный объём', category: 'volume', rawScore: 0, weight: 10, weightedContribution: 0, explanation: rejectionReason },
        volatility: { name: 'Режим волатильности', category: 'volatility', rawScore: 0, weight: 10, weightedContribution: 0, explanation: rejectionReason },
        mtf: { name: 'Мульти-таймфрейм (MTF)', category: 'mtf', rawScore: 0, weight: 10, weightedContribution: 0, explanation: rejectionReason },
        supportResistance: { name: 'Запас хода до S/R', category: 'supportResistance', rawScore: 0, weight: 10, weightedContribution: 0, explanation: rejectionReason },
        liquidity: { name: 'Качество ликвидности', category: 'liquidity', rawScore: 0, weight: 0, weightedContribution: 0, explanation: rejectionReason },
        riskReward: { name: 'Профиль риск/прибыль', category: 'riskReward', rawScore: 0, weight: 0, weightedContribution: 0, explanation: rejectionReason },
      },
      dominantStrengths: [],
      vulnerabilities: [rejectionReason],
      summaryExplanation: rejectionReason,
    };

    const emptySizing: PositionSizeResult = {
      units: 0,
      notionalUsd: 0,
      riskUsd: 0,
      actualRiskPercent: 0,
      effectiveLeverage: 0,
      qualityMultiplier: 0,
      conflictMultiplier: 0,
      regimeMultiplier: 0,
      explanation: 'Сетап отсутствует, позиция не открывается.',
    };

    const isForex = symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('USD') || symbol.includes('JPY');
    const forexSession = isForex ? ForexSessionEngine.analyzeSession(candles || [], symbol, timeframe) : undefined;

    const noSetupResult: AdaptiveSignalResult = {
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
      evidence: [],
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
      rejectionCode,
      rejectionReasonCode: rejectionCode,
      funnelStageReached,
      whyThisSignal: [],
      weightProfile: defaultProfile,
      conflictReport: defaultConflicts,
      qualityBreakdown: emptyQuality,
      positionSizing: emptySizing,
      dynamicPlan: emptyTradePlan,
      mtfConflictLevel: 'NONE',
      forexSession,
      forexSessionContext: forexSession,
      provenance: defaultProvenance,
    };

    SignalAuditTrail.logDecision({
      id,
      timestamp,
      symbol,
      timeframe,
      regime: regime?.regime || 'UNCERTAIN',
      setupState: 'NO_SETUP',
      direction: 'NEUTRAL',
      setupQuality: 0,
      rankScore: 0,
      mtfAlignment: mtf?.alignmentScore || 0,
      conflictLevel: defaultConflicts.overallLevel,
      conflictPenalty: defaultConflicts.totalQualityPenalty,
      volatilityState: (features?.atrPercent ?? 0) > 3.0 ? 'HIGH' : 'NORMAL',
      factorScores: {},
      entryPrice: p,
      stopLoss: emptyTradePlan.stopLoss,
      takeProfit1: emptyTradePlan.takeProfit1,
      takeProfit2: emptyTradePlan.takeProfit2,
      takeProfit3: emptyTradePlan.takeProfit3 || emptyTradePlan.takeProfit2 * 1.02,
      riskMultiplier: 0,
      finalDecision: 'REJECT',
      rejectionReason,
      rejectionCode,
      provenance: {
        source: defaultProvenance.source,
        freshness: defaultProvenance.freshness,
      },
    });

    return noSetupResult;
  }
}
