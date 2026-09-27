import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Candle } from '../lib/market/types';
import { AdaptiveWeightEngine } from '../lib/quant/weightProfiles';
import { SignalConflictEngine } from '../lib/quant/signalConflictEngine';
import { ContextAwareQualityEngine } from '../lib/quant/contextAwareQualityEngine';
import { DynamicTradePlanEngine } from '../lib/quant/dynamicTradePlanEngine';
import { PositionSizingEngine } from '../lib/quant/positionSizingEngine';
import { SignalRankingEngine } from '../lib/quant/signalRankingEngine';
import { AlertEngine } from '../lib/quant/alertEngine';
import { MLFeaturePipeline } from '../lib/quant/mlFeaturePipeline';
import { AdaptiveSignalEngine } from '../lib/quant/adaptiveSignalEngine';
import { HistoricalReplayEngine } from '../lib/quant/historicalReplayEngine';
import { FilterAblationEngine } from '../lib/quant/filterAblationEngine';

function generateCandles(count: number, trend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'UP', intervalSeconds = 3600): Candle[] {
  const candles: Candle[] = [];
  let price = 50000;
  const start = 1700000000;

  for (let i = 0; i < count; i++) {
    let step = 0;
    let isUp = false;
    if (trend === 'UP') {
      const cycle = i % 10;
      isUp = cycle < 7;
      step = isUp ? 120 + (i % 3) * 20 : -70 - (i % 2) * 15;
    } else if (trend === 'DOWN') {
      const cycle = i % 10;
      step = cycle < 7 ? -120 - (i % 3) * 20 : 70 + (i % 2) * 15;
    } else {
      step = (i % 2 === 0 ? 1 : -1) * (30 + (i % 4) * 10);
    }

    const open = price;
    const close = price + step;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;

    candles.push({
      time: start + i * intervalSeconds,
      open,
      high,
      low,
      close,
      volume: isUp ? 8000 + i * 50 : 3500,
    });
    price = close;
  }
  return candles;
}

describe('Phase 5A: Adaptive Context-Aware Signal Architecture Test Suite', () => {

  it('1. AdaptiveWeightEngine: selects dynamic factor weight profiles based on market regime', () => {
    const bullProfile = AdaptiveWeightEngine.getProfile('TRENDING_BULL');
    assert.equal(bullProfile.profileName, 'TRENDING_BULL_PROFILE');
    assert.ok(bullProfile.weights.trend >= 0.20, 'Bull trend profile must heavily weight trend factor');

    const rangeProfile = AdaptiveWeightEngine.getProfile('RANGE');
    assert.equal(rangeProfile.profileName, 'RANGE_PROFILE');
    assert.ok(rangeProfile.weights.structure >= 0.20, 'Range profile must prioritize structure factor');
    assert.ok(rangeProfile.weights.trend < bullProfile.weights.trend, 'Range profile reduces trend weight vs trending profile');

    const highVolProfile = AdaptiveWeightEngine.getProfile('HIGH_VOLATILITY');
    assert.ok(highVolProfile.weights.volatility >= 0.15, 'High volatility profile weights volatility factor heavily');

    // Static weights fallback check
    const staticProfile = AdaptiveWeightEngine.getProfile('TRENDING_BULL', true);
    assert.equal(staticProfile.profileName, 'STATIC_WEIGHTS_FALLBACK');
  });

  it('2. SignalConflictEngine: identifies cross-dimensional market conflicts and assigns severities', () => {
    const candles = generateCandles(60, 'UP');
    const signal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h');

    assert.ok(signal.conflictReport !== undefined);
    assert.ok(['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(signal.conflictReport.overallLevel));
    assert.ok(Array.isArray(signal.conflictReport.conflicts));
    assert.ok(typeof signal.conflictReport.totalQualityPenalty === 'number');
  });

  it('3. ContextAwareQualityEngine: scores 9 normalized factors (0-100) with human explanations', () => {
    const candles = generateCandles(60, 'UP');
    const signal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h');

    const q = signal.qualityBreakdown;
    assert.ok(q !== undefined);
    assert.ok(q.overallQuality >= 0 && q.overallQuality <= 100);

    const fScores = q.factorScores;
    const requiredFactors = ['trend', 'structure', 'momentum', 'volume', 'volatility', 'mtf', 'liquidity', 'riskReward'];
    for (const factor of requiredFactors) {
      assert.ok(fScores[factor] !== undefined, `Factor ${factor} must be present`);
      assert.ok(fScores[factor].rawScore >= 0 && fScores[factor].rawScore <= 100);
      assert.ok(typeof fScores[factor].explanation === 'string' && fScores[factor].explanation.length > 0);
    }
  });

  it('4. DynamicTradePlanEngine: structural SL, TP1-3, and regime-dependent trailing logic', () => {
    const candles = generateCandles(60, 'UP');
    const signal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h');

    const plan = signal.dynamicPlan;
    assert.ok(plan !== undefined);
    assert.ok(plan.entryPrice > 0);
    assert.ok(plan.stopLoss > 0);
    assert.ok(plan.takeProfit1 > 0);
    assert.ok(plan.takeProfit2 > 0);
    assert.ok(plan.takeProfit3 > 0);
    assert.ok(plan.riskRewardRatio > 0);
    assert.ok(['STRUCTURE_TRAILING', 'TIGHT_TARGET_TRAILING', 'WIDE_VOLATILITY_TRAILING'].includes(plan.trailingStrategy));
    assert.ok(plan.trailingStepAtr >= 1.0);
    assert.ok(plan.breakevenThresholdR >= 1.0);
  });

  it('5. PositionSizingEngine: sizes positions using quality, conflict severity and regime modifiers', () => {
    const highQualityNoConflict = PositionSizingEngine.calculateSize(
      50000, 48000, 85, 'NONE', 'TRENDING_BULL', { accountBalance: 10000, baseRiskPercent: 1.0 }
    );
    assert.equal(highQualityNoConflict.qualityMultiplier, 1.0);
    assert.equal(highQualityNoConflict.conflictMultiplier, 1.0);
    assert.equal(highQualityNoConflict.regimeMultiplier, 1.0);
    assert.equal(highQualityNoConflict.actualRiskPercent, 1.0);

    const lowQualityHighConflict = PositionSizingEngine.calculateSize(
      50000, 48000, 55, 'HIGH', 'HIGH_VOLATILITY', { accountBalance: 10000, baseRiskPercent: 1.0 }
    );
    assert.ok(lowQualityHighConflict.qualityMultiplier <= 0.75);
    assert.ok(lowQualityHighConflict.conflictMultiplier <= 0.50);
    assert.ok(lowQualityHighConflict.regimeMultiplier <= 0.60);
    assert.ok(lowQualityHighConflict.actualRiskPercent < highQualityNoConflict.actualRiskPercent);
  });

  it('6. Market Opportunity States: WATCH state distinguishes pending setups from CONFIRMED', () => {
    const candles = generateCandles(60, 'UP');
    const signal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h');

    assert.ok(['NO_SETUP', 'FORMING', 'WATCH', 'CONFIRMED', 'ACTIVE', 'INVALIDATED'].includes(signal.setupState));
    if (signal.setupQuality >= 65) {
      assert.ok(signal.setupState === 'CONFIRMED' || signal.setupState === 'ACTIVE');
    } else if (signal.setupQuality >= 50) {
      assert.equal(signal.setupState, 'WATCH');
    }
  });

  it('7. SignalRankingEngine: ranks concurrent market opportunities deterministically', () => {
    const candlesUp = generateCandles(60, 'UP');
    const candlesDown = generateCandles(60, 'DOWN');

    const sigUp = AdaptiveSignalEngine.evaluate(candlesUp, 'BTCUSDT', '1h');
    const sigDown = AdaptiveSignalEngine.evaluate(candlesDown, 'ETHUSDT', '1h');

    const ranked = SignalRankingEngine.rankSignals([sigUp, sigDown]);
    assert.ok(Array.isArray(ranked));
    for (let i = 0; i < ranked.length; i++) {
      assert.equal(ranked[i].rank, i + 1);
      assert.ok(ranked[i].compositeScore >= 0 && ranked[i].compositeScore <= 100);
      assert.ok(typeof ranked[i].rankingRationale === 'string');
      if (i > 0) {
        assert.ok(ranked[i - 1].compositeScore >= ranked[i].compositeScore, 'Ranking must be descending by compositeScore');
      }
    }
  });

  it('8. AlertEngine: creates timestamped alerts and maintains bounded in-memory buffer', () => {
    AlertEngine.clearAlerts();
    const alert = AlertEngine.createAlert('WATCH_CREATED', 'BTCUSDT', '1h', 'LONG', 50000, 60);

    assert.ok(alert.id.startsWith('alt-BTCUSDT-WATCH_CREATED'));
    assert.equal(alert.eventType, 'WATCH_CREATED');
    assert.equal(alert.asset, 'BTCUSDT');
    assert.equal(alert.quality, 60);

    const log = AlertEngine.getAlerts();
    assert.equal(log.length, 1);
    assert.equal(log[0].id, alert.id);
  });

  it('9. MLFeaturePipeline: extracts v1 feature vector with zero future outcome leakage in live evaluation', () => {
    const candles = generateCandles(60, 'UP');
    const signal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h');

    const sample = MLFeaturePipeline.extractFeatures(
      signal,
      signal.qualityBreakdown,
      signal.conflictReport,
      signal.dynamicPlan
    );

    assert.equal(sample.featureVersion, 'v1');
    assert.equal(sample.asset, 'BTCUSDT');
    assert.equal(sample.futureOutcome, undefined, 'Live sample must NEVER contain futureOutcome');
    assert.equal(sample.mfe, undefined, 'Live sample must NEVER contain future MFE');

    // Attach historical outcome strictly for offline training
    const labeled = MLFeaturePipeline.attachHistoricalOutcome(sample, 'WIN', 3.2, 0.4, 8);
    assert.equal(labeled.futureOutcome, 'WIN');
    assert.equal(labeled.mfe, 3.2);
    assert.equal(labeled.mae, 0.4);
    assert.equal(labeled.durationBars, 8);
  });

  it('10. HistoricalReplayEngine with Adaptive Engine: runs replay with dynamic trailing stop and position sizing', () => {
    const candles = generateCandles(90, 'UP');
    const replay = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      useAdaptiveEngine: true,
    });

    assert.equal(replay.status, 'SUCCESS');
    assert.ok(replay.totalCandles === 90);
    assert.ok(replay.rejectionFunnel !== undefined);
    assert.ok(replay.qualityDistribution !== undefined);
  });

  it('11. FilterAblationEngine: runPhase5Ablation compares Adaptive Baseline vs Static Fallbacks', () => {
    const candles = generateCandles(90, 'UP');
    const report = FilterAblationEngine.runPhase5Ablation(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    assert.equal(report.baseline.scenarioId, 'adaptive_baseline');
    assert.ok(report.scenarios.length >= 6);
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'static_weights'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'static_mtf'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'static_sl'));
  });
});
