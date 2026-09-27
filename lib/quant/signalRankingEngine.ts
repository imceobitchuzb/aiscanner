import { UnifiedSignalResult } from './signalDecisionEngine';

export interface RankedSignalItem {
  rank: number;
  symbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  setupState: string;
  setupQuality: number;
  riskRewardRatio: number;
  mtfAlignment: number;
  conflictSeverity: string;
  compositeScore: number;
  rankingRationale: string;
  signal: UnifiedSignalResult;
}

export class SignalRankingEngine {
  /**
   * Deterministically ranks detected market opportunities across assets.
   * Composite Rank Score = Quality(50%) + (R:R * 20)(25%) + MTFAlignment(25%) - ConflictPenalty.
   */
  public static rankSignals(signals: UnifiedSignalResult[]): RankedSignalItem[] {
    const scoredItems: {
      signal: UnifiedSignalResult;
      compositeScore: number;
      rankingRationale: string;
    }[] = [];

    for (const sig of signals) {
      if (sig.direction === 'NEUTRAL' || sig.setupState === 'NO_SETUP') {
        continue;
      }

      const quality = sig.setupQuality;
      const rr = sig.tradePlan ? sig.tradePlan.riskRewardRatio : 1.5;
      const mtfAlign = sig.mtf ? sig.mtf.alignmentScore : 50;

      // Conflict penalty
      let conflictPenalty = 0;
      if (sig.riskWarnings && sig.riskWarnings.length > 2) conflictPenalty += 10;
      if (sig.riskWarnings?.some((w) => w.toLowerCase().includes('макро') || w.toLowerCase().includes('macro'))) {
        conflictPenalty += 8;
      }

      const qualityPart = quality * 0.50;
      const rrPart = Math.min(100, rr * 25) * 0.25;
      const mtfPart = mtfAlign * 0.25;
      const compositeScore = Math.max(0, Math.min(100, Math.round(qualityPart + rrPart + mtfPart - conflictPenalty)));

      const rankingRationale = `Качество (${quality}/100) + R:R (${rr.toFixed(2)}) + MTF (${mtfAlign}%) - Штрафы (${conflictPenalty}) = Счёт ${compositeScore}`;

      scoredItems.push({
        signal: sig,
        compositeScore,
        rankingRationale,
      });
    }

    // Sort descending by compositeScore
    scoredItems.sort((a, b) => b.compositeScore - a.compositeScore);

    return scoredItems.map((item, idx) => ({
      rank: idx + 1,
      symbol: item.signal.symbol,
      timeframe: item.signal.timeframe,
      direction: item.signal.direction,
      setupState: item.signal.setupState,
      setupQuality: item.signal.setupQuality,
      riskRewardRatio: item.signal.tradePlan?.riskRewardRatio || 0,
      mtfAlignment: item.signal.mtf?.alignmentScore || 0,
      conflictSeverity: item.signal.riskWarnings?.length > 2 ? 'HIGH' : item.signal.riskWarnings?.length > 0 ? 'MEDIUM' : 'LOW',
      compositeScore: item.compositeScore,
      rankingRationale: item.rankingRationale,
      signal: item.signal,
    }));
  }
}
