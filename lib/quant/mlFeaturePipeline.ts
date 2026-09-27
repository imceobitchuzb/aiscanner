import { UnifiedSignalResult } from './signalDecisionEngine';
import { ContextAwareQualityResult } from './contextAwareQualityEngine';
import { ConflictReport } from './signalConflictEngine';
import { DynamicTradePlan } from './dynamicTradePlanEngine';

export interface MLTrainingSample {
  // Metadata & Versioning
  featureVersion: string; // 'v1'
  timestamp: number;
  asset: string;
  timeframe: string;

  // Regime
  regime: string;

  // Factor Scores (0-100)
  trendScore: number;
  structureScore: number;
  momentumScore: number;
  volumeScore: number;
  volatilityScore: number;
  mtfScore: number;
  liquidityScore: number;
  riskRewardScore: number;

  // Conflicts
  mtfConflict: string;
  structureConflict: string;
  momentumConflict: string;
  overallConflictLevel: string;

  // Trade Plan
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  setupQuality: number;

  // Historical Training Labels (Populated STRICTLY during historical review, never in live decision!)
  futureOutcome?: 'WIN' | 'LOSS' | 'TIMEOUT' | 'INVALIDATED';
  mfe?: number;
  mae?: number;
  durationBars?: number;
}

export class MLFeaturePipeline {
  public static readonly FEATURE_VERSION = 'v1';

  /**
   * Transforms a live or replayed evaluation into the standard ML feature vector.
   * `futureOutcome`, `mfe`, `mae`, `durationBars` are strictly omitted for live decisions.
   */
  public static extractFeatures(
    signal: UnifiedSignalResult,
    qualityResult?: ContextAwareQualityResult,
    conflictReport?: ConflictReport,
    tradePlan?: DynamicTradePlan
  ): MLTrainingSample {
    const qScores = qualityResult?.factorScores;

    const mtfConflict = conflictReport?.conflicts.find((c) => c.category === 'MTF')?.severity || 'NONE';
    const structConflict = conflictReport?.conflicts.find((c) => c.category === 'STRUCTURE')?.severity || 'NONE';
    const momConflict = conflictReport?.conflicts.find((c) => c.category === 'MOMENTUM')?.severity || 'NONE';

    return {
      featureVersion: this.FEATURE_VERSION,
      timestamp: signal.timestamp,
      asset: signal.symbol,
      timeframe: signal.timeframe,
      regime: signal.marketState?.regime || 'UNCERTAIN',
      trendScore: qScores?.trend.rawScore ?? 50,
      structureScore: qScores?.structure.rawScore ?? 50,
      momentumScore: qScores?.momentum.rawScore ?? 50,
      volumeScore: qScores?.volume.rawScore ?? 50,
      volatilityScore: qScores?.volatility.rawScore ?? 50,
      mtfScore: qScores?.mtf.rawScore ?? 50,
      liquidityScore: qScores?.liquidity.rawScore ?? 50,
      riskRewardScore: qScores?.riskReward.rawScore ?? 50,
      mtfConflict,
      structureConflict: structConflict,
      momentumConflict: momConflict,
      overallConflictLevel: conflictReport?.overallLevel || 'NONE',
      direction: signal.direction,
      entryPrice: tradePlan?.entryPrice ?? (signal.tradePlan?.entryPrice || 0),
      stopLoss: tradePlan?.stopLoss ?? (signal.tradePlan?.stopLoss || 0),
      takeProfit1: tradePlan?.takeProfit1 ?? (signal.tradePlan?.takeProfit1 || 0),
      takeProfit2: tradePlan?.takeProfit2 ?? (signal.tradePlan?.takeProfit2 || 0),
      riskRewardRatio: tradePlan?.riskRewardRatio ?? (signal.tradePlan?.riskRewardRatio || 0),
      setupQuality: signal.setupQuality,
    };
  }

  /**
   * Attaches historical training labels when replaying past trades.
   * Strictly separated from live signal generation.
   */
  public static attachLabels(
    sample: MLTrainingSample,
    outcome: 'WIN' | 'LOSS' | 'TIMEOUT' | 'INVALIDATED',
    mfe: number,
    mae: number,
    durationBars: number
  ): MLTrainingSample {
    return {
      ...sample,
      futureOutcome: outcome,
      mfe,
      mae,
      durationBars,
    };
  }

  public static attachHistoricalOutcome(
    sample: MLTrainingSample,
    outcome: 'WIN' | 'LOSS' | 'TIMEOUT' | 'INVALIDATED',
    mfe: number,
    mae: number,
    durationBars: number
  ): MLTrainingSample {
    return this.attachLabels(sample, outcome, mfe, mae, durationBars);
  }
}
