import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Candle } from '../lib/market/types';
import { DataQualityEngine } from '../lib/market/dataQualityEngine';
import { HistoricalReplayEngine } from '../lib/quant/historicalReplayEngine';
import { SignalDecisionEngine } from '../lib/quant/signalDecisionEngine';
import { FilterAblationEngine } from '../lib/quant/filterAblationEngine';
import { ContextEngine, MacroBar, MacroContextSeries } from '../lib/quant/contextEngine';

// Helper to generate realistic synthetic wave series
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

describe('Phase 4: Large Dataset Scaling, Quality Audit & Signal Attribution Suite', () => {

  it('1. DataQualityEngine: duplicate removal and timestamp sorting', () => {
    const raw = generateCandles(50, 'UP');
    // Inject duplicates and out-of-order bars
    const corrupted: Candle[] = [
      ...raw.slice(0, 20),
      raw[10], // Duplicate of bar 10
      raw[15], // Duplicate of bar 15
      raw[40], // Out of order bar
      ...raw.slice(20, 40),
      ...raw.slice(41),
    ];

    const audit = DataQualityEngine.auditAndClean(corrupted, '1h');
    assert.equal(audit.duplicateCount, 2, 'Must detect exactly 2 duplicate timestamps');
    assert.ok(audit.outOfOrderCount > 0, 'Must detect out-of-order timestamps');
    assert.equal(audit.cleanCandles.length, 50, 'Cleaned candles must be deduplicated to exactly 50 bars');

    // Verify cleanCandles are strictly ascending in time
    for (let i = 1; i < audit.cleanCandles.length; i++) {
      assert.ok(audit.cleanCandles[i].time > audit.cleanCandles[i - 1].time, 'Cleaned candles must be strictly ordered');
    }
  });

  it('2. DataQualityEngine: OHLC invariant violation detection and DATASET_INVALID flag', () => {
    const raw = generateCandles(60, 'UP');
    // Corrupt high < low on bar 25
    raw[25].high = raw[25].low - 100;
    // Corrupt negative price on bar 30
    raw[30].close = -500;

    const audit = DataQualityEngine.auditAndClean(raw, '1h');
    assert.ok(audit.ohlcViolationCount >= 2, 'Must catch invalid OHLC relations');
    assert.equal(audit.status, 'DATASET_INVALID', 'Must flag corrupt dataset as DATASET_INVALID');
  });

  it('3. Standardized Rejection Attribution: BAD_RR and HIGH_VOLATILITY codes', () => {
    const candles = generateCandles(70, 'UP');

    // Force high volatility filter rejection by inflating candle range
    const volatileCandles = candles.map((c) => ({
      ...c,
      high: c.high + 5000,
      low: c.low - 5000,
    }));

    const rejVol = SignalDecisionEngine.evaluate(volatileCandles, 'BTCUSDT', '1h');
    assert.equal(rejVol.direction, 'NEUTRAL');
    assert.equal(rejVol.rejectionReasonCode, 'HIGH_VOLATILITY');
    assert.equal(rejVol.funnelStageReached, 'REGIME_PASSED');

    // Test BAD_RR by demanding extreme minRiskReward
    const rejRR = SignalDecisionEngine.evaluate(candles, 'BTCUSDT', '1h', true, true, 8.0);
    assert.equal(rejRR.direction, 'NEUTRAL');
    assert.equal(rejRR.rejectionReasonCode, 'BAD_RR');
    assert.equal(rejRR.funnelStageReached, 'MTF_PASSED');
  });

  it('4. Rejection Attribution: MARKET_CLOSED and STALE_DATA gates', () => {
    const candles = generateCandles(60, 'UP');

    // Market closed
    const resClosed = SignalDecisionEngine.evaluate(candles, 'BTCUSDT', '1h', false, true);
    assert.equal(resClosed.direction, 'NEUTRAL');
    assert.equal(resClosed.rejectionReasonCode, 'MARKET_CLOSED');
    assert.equal(resClosed.funnelStageReached, 'POTENTIAL');

    // Stale data
    const resStale = SignalDecisionEngine.evaluate(candles, 'BTCUSDT', '1h', true, false);
    assert.equal(resStale.direction, 'NEUTRAL');
    assert.equal(rejReason(resStale), 'STALE_DATA');
  });

  function rejReason(res: any) {
    return res.rejectionReasonCode;
  }

  it('5. Rejection Funnel & Market Regime Coverage tracking in HistoricalReplayEngine', () => {
    const candles = generateCandles(90, 'UP');
    const replay = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      minRiskReward: 1.5,
    });

    assert.equal(replay.status, 'SUCCESS');
    assert.ok(replay.rejectionFunnel !== undefined);
    assert.ok(replay.rejectionFunnel.potentialBars > 0);
    assert.ok(replay.rejectionFunnel.potentialBars >= replay.rejectionFunnel.structurePassed);
    assert.ok(replay.rejectionFunnel.structurePassed >= replay.rejectionFunnel.regimePassed);
    assert.ok(replay.rejectionFunnel.regimePassed >= replay.rejectionFunnel.mtfPassed);

    assert.ok(replay.rejectionHistogram !== undefined);
    assert.ok(Object.keys(replay.rejectionHistogram).length > 0);

    assert.ok(replay.regimeCoverage !== undefined);
    const totalPercentage = Object.values(replay.regimeCoverage).reduce((s, r) => s + r.percentage, 0);
    assert.ok(Math.abs(totalPercentage - 100) < 1.0, 'Regime percentages must sum to ~100%');
  });

  it('6. Trade Attribution: whyThisSignal, invalidationPrice, invalidationReason attached', () => {
    const candles = generateCandles(90, 'UP');
    const replay = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    for (const trade of replay.trades) {
      assert.ok(trade.invalidationPrice !== undefined && trade.invalidationPrice > 0);
      assert.ok(typeof trade.invalidationReason === 'string' && trade.invalidationReason.length > 0);
      assert.ok(Array.isArray(trade.whyThisSignal) && trade.whyThisSignal.length > 0);
    }
  });

  it('7. FilterAblationEngine: evaluates all 7 scenarios with verdicts', () => {
    const candles = generateCandles(90, 'UP');
    const report = FilterAblationEngine.runAblation(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    assert.equal(report.scenarios.length, 7);
    assert.equal(report.baseline.scenarioId, 'baseline');
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_mtf'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_volatility'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_rr'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_structure'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_momentum'));
    assert.ok(report.scenarios.some((s) => s.scenarioId === 'without_resistance'));

    for (const sc of report.scenarios) {
      assert.ok(['CRITICAL_PROTECTOR', 'HARMFUL_DRAG', 'NEUTRAL_FILTER'].includes(sc.verdict));
      assert.ok(typeof sc.verdictReason === 'string');
    }
  });

  it('8. ContextEngine: Strict timestamp alignment and zero future data leakage', () => {
    const btcSeries: MacroBar[] = [
      { time: 1000, close: 40000 },
      { time: 2000, close: 41000 },
      { time: 3000, close: 42000 },
      { time: 4000, close: 43000 },
    ];

    const dxySeries: MacroBar[] = [
      { time: 1000, close: 104.0 },
      { time: 2000, close: 104.5 },
      { time: 3000, close: 105.0 },
    ];

    const ctxData: MacroContextSeries = {
      btc: btcSeries,
      dxy: dxySeries,
      vix: [{ time: 2500, close: 18 }],
    };

    // Query at timestamp 2500: btc must be bar at 2000 (close 41000), NOT 3000 or 4000
    const point = ContextEngine.getLatestPointAtOrBefore(btcSeries, 2500);
    assert.ok(point !== null);
    assert.equal(point.current.time, 2000);
    assert.equal(point.current.close, 41000);

    const ctx2500 = ContextEngine.evaluateContextAt(2500, 'BTCUSDT', 'CRYPTO', ctxData);
    assert.equal(ctx2500.timestamp, 2500);
    assert.equal(ctx2500.btcRegime, 'BULLISH'); // 41000 vs 40000

    // Mutate FUTURE bar at 4000
    btcSeries[3].close = 999999;
    const ctx2500AfterFutureMutation = ContextEngine.evaluateContextAt(2500, 'BTCUSDT', 'CRYPTO', ctxData);
    assert.equal(ctx2500AfterFutureMutation.macroAlignmentScore, ctx2500.macroAlignmentScore);
  });

  it('9. Signal Quality Distribution bucketing', () => {
    const candles = generateCandles(90, 'UP');
    const replay = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    assert.ok(replay.qualityDistribution !== undefined);
    const buckets = Object.keys(replay.qualityDistribution);
    assert.ok(buckets.includes('0-20'));
    assert.ok(buckets.includes('40-60'));
    assert.ok(buckets.includes('60-70'));
    assert.ok(buckets.includes('70-80'));
    assert.ok(buckets.includes('80-90'));
  });

});
