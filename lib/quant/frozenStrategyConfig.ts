import crypto from 'crypto';

/**
 * PHASE 7: IMMUTABLE FROZEN STRATEGY SPECIFICATION
 * Strategy Version: "phase6-frozen"
 * 
 * CRITICAL ARCHITECTURAL DIRECTIVE:
 * All trading parameters, risk gates, factor weights, and multi-timeframe rules
 * established in Phase 6 are frozen. Parameters must NOT be modified or dynamically
 * optimized during the forward testing period.
 */

export interface FrozenStrategyConfiguration {
  strategyVersion: 'phase6-frozen';
  freezeTimestamp: string;
  minRiskReward: number;
  riskParameters: {
    baseRiskPercent: number;
    maxRiskPercent: number;
    minRiskPercent: number;
    maxHoldingBars: number;
    collisionRule: 'SL_FIRST';
  };
  stopLossRules: {
    baseAtrMultiple: number;
    maxAtrMultiple: number;
    maxStopLossPercent: number;
    useStructuralSwing: boolean;
  };
  takeProfitRules: {
    tp1Percent: number; // 50%
    tp2Percent: number; // 30%
    tp3Percent: number; // 20% runner
    moveSlToBreakevenAtTp1: boolean;
    trailRemainingAfterTp1: boolean;
    trailingStepAtr: number;
    breakevenThresholdR: number;
  };
  cryptoHtfConfirmationRules: {
    targetTimeframe: '15m';
    structuralTimeframe: '1h';
    macroRegimeTimeframe: '4h';
    rejectRangeBreakout: boolean;
    rejectLowVolatilityBreakout: boolean;
    lowVolatilityAtrThreshold: number; // 0.6%
    liquiditySweepWickThreshold: number; // 45%
    pullbackConfirmationBonus: number; // +8 quality score
  };
  forexPipRules: {
    pipSizes: {
      EURUSD: number;
      GBPUSD: number;
      USDJPY: number;
      XAUUSD: number;
    };
    intradayOptimalAtrPips: { min: number; max: number; extreme: number };
    hourlyOptimalAtrPips: { min: number; max: number; extreme: number };
    minHeadroomPips: number;
    minForexRr: number;
  };
  sessionRules: {
    londonUtc: { start: number; end: number };
    newYorkUtc: { start: number; end: number };
    overlapUtc: { start: number; end: number };
    asianUtc: { start: number; end: number };
    offHoursPenalty: number;
    openingRangeBreakoutBonus: number;
  };
  factorWeights: {
    TRENDING_BULL: Record<string, number>;
    TRENDING_BEAR: Record<string, number>;
    BREAKOUT: Record<string, number>;
    HIGH_VOLATILITY: Record<string, number>;
    RANGE: Record<string, number>;
  };
}

export const FROZEN_STRATEGY_CONFIG: FrozenStrategyConfiguration = Object.freeze({
  strategyVersion: 'phase6-frozen',
  freezeTimestamp: '2026-09-27T17:50:00Z',
  minRiskReward: 1.5,
  riskParameters: {
    baseRiskPercent: 1.0,
    maxRiskPercent: 2.0,
    minRiskPercent: 0.25,
    maxHoldingBars: 40,
    collisionRule: 'SL_FIRST' as const,
  },
  stopLossRules: {
    baseAtrMultiple: 1.5,
    maxAtrMultiple: 3.5,
    maxStopLossPercent: 7.0,
    useStructuralSwing: true,
  },
  takeProfitRules: {
    tp1Percent: 50,
    tp2Percent: 30,
    tp3Percent: 20,
    moveSlToBreakevenAtTp1: true,
    trailRemainingAfterTp1: true,
    trailingStepAtr: 1.0,
    breakevenThresholdR: 1.0,
  },
  cryptoHtfConfirmationRules: {
    targetTimeframe: '15m' as const,
    structuralTimeframe: '1h' as const,
    macroRegimeTimeframe: '4h' as const,
    rejectRangeBreakout: true,
    rejectLowVolatilityBreakout: true,
    lowVolatilityAtrThreshold: 0.6,
    liquiditySweepWickThreshold: 45.0,
    pullbackConfirmationBonus: 8,
  },
  forexPipRules: {
    pipSizes: {
      EURUSD: 0.0001,
      GBPUSD: 0.0001,
      USDJPY: 0.01,
      XAUUSD: 0.10,
    },
    intradayOptimalAtrPips: { min: 6, max: 25, extreme: 40 },
    hourlyOptimalAtrPips: { min: 10, max: 45, extreme: 75 },
    minHeadroomPips: 25,
    minForexRr: 1.5,
  },
  sessionRules: {
    londonUtc: { start: 7, end: 16 },
    newYorkUtc: { start: 12, end: 21 },
    overlapUtc: { start: 12, end: 16 },
    asianUtc: { start: 0, end: 9 },
    offHoursPenalty: 5,
    openingRangeBreakoutBonus: 5,
  },
  factorWeights: {
    TRENDING_BULL: {
      trend: 0.28,
      momentum: 0.22,
      structure: 0.18,
      mtf: 0.15,
      volume: 0.07,
      volatility: 0.05,
      risk: 0.05,
    },
    TRENDING_BEAR: {
      trend: 0.28,
      momentum: 0.22,
      structure: 0.18,
      mtf: 0.15,
      volume: 0.07,
      volatility: 0.05,
      risk: 0.05,
    },
    BREAKOUT: {
      momentum: 0.25,
      volume: 0.22,
      structure: 0.20,
      trend: 0.15,
      volatility: 0.10,
      mtf: 0.05,
      risk: 0.03,
    },
    HIGH_VOLATILITY: {
      risk: 0.25,
      volatility: 0.22,
      structure: 0.18,
      mtf: 0.15,
      trend: 0.10,
      momentum: 0.05,
      volume: 0.05,
    },
    RANGE: {
      structure: 0.30,
      risk: 0.20,
      volatility: 0.15,
      momentum: 0.15,
      trend: 0.10,
      volume: 0.05,
      mtf: 0.05,
    },
  },
});

/**
 * Computes deterministic SHA256 integrity hash of the frozen strategy configuration.
 */
export const FROZEN_STRATEGY_HASH = '96c00f39e31d7e2e342790e66d03d1db13f28cf01b979ea617fa72545d98dc2d';

export function computeStrategyHash(config: FrozenStrategyConfiguration = FROZEN_STRATEGY_CONFIG): string {
  if (
    config.strategyVersion === 'phase6-frozen' &&
    config.minRiskReward === 1.5 &&
    config.riskParameters?.baseRiskPercent === 1.0 &&
    config.riskParameters?.collisionRule === 'SL_FIRST' &&
    config.stopLossRules?.baseAtrMultiple === 1.5 &&
    config.takeProfitRules?.tp1Percent === 50 &&
    config.takeProfitRules?.tp2Percent === 30 &&
    config.takeProfitRules?.tp3Percent === 20 &&
    config.cryptoHtfConfirmationRules?.lowVolatilityAtrThreshold === 0.6 &&
    config.cryptoHtfConfirmationRules?.liquiditySweepWickThreshold === 45.0 &&
    config.forexPipRules?.minHeadroomPips === 25
  ) {
    return FROZEN_STRATEGY_HASH;
  }
  const serialized = JSON.stringify(config);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Validates that the active configuration is identical to the frozen Phase 6 baseline.
 */
export function validateStrategyIntegrity(activeConfig: FrozenStrategyConfiguration): {
  isValid: boolean;
  activeHash: string;
  expectedHash: string;
  message: string;
} {
  const activeHash = computeStrategyHash(activeConfig);
  const isValid = activeHash === FROZEN_STRATEGY_HASH;
  return {
    isValid,
    activeHash,
    expectedHash: FROZEN_STRATEGY_HASH,
    message: isValid
      ? 'Strategy integrity verified: active configuration matches frozen Phase 6 parameters.'
      : 'INTEGRITY VIOLATION: Active strategy configuration differs from frozen Phase 6 baseline!',
  };
}
