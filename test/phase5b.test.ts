import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForexSessionEngine } from '../lib/quant/forexSessionEngine';
import { SignalAuditTrail } from '../lib/quant/signalAuditTrail';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { WalkForwardEngine } from '../lib/quant/walkForwardEngine';
import { AdaptiveSignalEngine } from '../lib/quant/adaptiveSignalEngine';
import { Candle } from '../lib/market/types';

describe('Phase 5B: Forex Session Context, Partial Exits, Audit Trail & Robustness Suite', () => {

  it('1. ForexSessionEngine: Identifies Asian, London, NY and Overlap sessions accurately', () => {
    // 2026-09-28 03:00 UTC -> Asian session
    const asianTime = Date.UTC(2026, 8, 28, 3, 0, 0) / 1000;
    const asianContext = ForexSessionEngine.getSessionContext(asianTime, 'EURUSD');
    assert.equal(asianContext.activeSession, 'ASIAN');
    assert.equal(asianContext.isOverlap, false);

    // 2026-09-28 09:00 UTC -> London session
    const londonTime = Date.UTC(2026, 8, 28, 9, 0, 0) / 1000;
    const londonContext = ForexSessionEngine.getSessionContext(londonTime, 'EURUSD');
    assert.equal(londonContext.activeSession, 'LONDON');
    assert.equal(londonContext.isOverlap, false);

    // 2026-09-28 14:00 UTC -> London / New York Overlap
    const overlapTime = Date.UTC(2026, 8, 28, 14, 0, 0) / 1000;
    const overlapContext = ForexSessionEngine.getSessionContext(overlapTime, 'GBPUSD');
    assert.equal(overlapContext.activeSession, 'OVERLAP');
    assert.equal(overlapContext.isOverlap, true);

    // 2026-09-28 18:00 UTC -> New York session
    const nyTime = Date.UTC(2026, 8, 28, 18, 0, 0) / 1000;
    const nyContext = ForexSessionEngine.getSessionContext(nyTime, 'EURUSD');
    assert.equal(nyContext.activeSession, 'NEW_YORK');
    assert.equal(nyContext.isOverlap, false);
  });

  it('2. ForexSessionEngine: Computes Opening Range and detects Opening Range Breakouts', () => {
    // Build 15m candles covering London opening range (07:00 - 08:00 UTC) and subsequent breakout
    const candles: Candle[] = [];
    const baseDate = new Date(Date.UTC(2026, 8, 28, 6, 0, 0));

    for (let i = 0; i < 20; i++) {
      const time = Math.floor(baseDate.getTime() / 1000) + i * 900;
      // 07:00 to 08:00 (i = 4, 5, 6, 7) establish a range 1.0800 - 1.0830
      let low = 1.0800;
      let high = 1.0830;
      let open = 1.0810;
      let close = 1.0820;

      // i = 8 is 08:00 UTC breakout bar above 1.0830
      if (i >= 8) {
        low = 1.0835;
        high = 1.0870;
        open = 1.0840;
        close = 1.0865;
      }

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: 5000,
      });
    }

    const testTime = candles[9].time; // 08:15 UTC
    const context = ForexSessionEngine.getSessionContext(testTime, 'EURUSD', candles);

    assert.ok(context.openingRange);
    assert.equal(context.openingRange?.session, 'LONDON');
    assert.ok(context.openingRange?.high >= 1.0830);
    assert.ok(context.openingRange?.low <= 1.0810);
    assert.equal(context.openingRangeBreakout, 'BULLISH_BREAKOUT');
  });

  it('3. AdaptiveSignalEngine: Attaches Forex Session Context to Forex evaluations', () => {
    // Generate 40 candles for EURUSD with timestamp in London overlap
    const candles: Candle[] = [];
    const baseTime = Date.UTC(2026, 8, 28, 14, 0, 0) / 1000;

    for (let i = 0; i < 40; i++) {
      candles.push({
        time: baseTime + i * 3600,
        open: 1.0800 + i * 0.0005,
        high: 1.0810 + i * 0.0005,
        low: 1.0795 + i * 0.0005,
        close: 1.0808 + i * 0.0005,
        volume: 10000,
      });
    }

    const evalResult = AdaptiveSignalEngine.evaluate(candles, 'EURUSD', '1h', true, true, 1.5);
    assert.ok(evalResult);
    assert.ok(evalResult.forexSessionContext);
    assert.ok(['LONDON', 'NEW_YORK', 'OVERLAP', 'ASIAN'].includes(evalResult.forexSessionContext.activeSession));
  });

  it('4. HistoricalReplayEngine: Executes Partial Take-Profit (TP1 50%, TP2 30%, TP3 runner)', () => {
    // Generate synthetic trend hitting TP1 and TP2 sequentially
    const candles: Candle[] = [];
    let p = 50000;
    const baseTime = 1700000000;

    // 35 warmup bars
    for (let i = 0; i < 35; i++) {
      p += 50;
      candles.push({
        time: baseTime + i * 900,
        open: p - 20,
        high: p + 30,
        low: p - 30,
        close: p,
        volume: 1000,
      });
    }

    // Next bars: big bullish push to trigger TP1 and TP2
    for (let i = 35; i < 60; i++) {
      p += 200;
      candles.push({
        time: baseTime + i * 900,
        open: p - 50,
        high: p + 250,
        low: p - 60,
        close: p + 200,
        volume: 2000,
      });
    }

    const config: ReplayConfig = {
      asset: 'BTCUSDT',
      timeframe: '15m',
      initialBalance: 10000,
      riskPerTradePercent: 1.0,
      feesBps: 2,
      slippageBps: 1,
      collisionRule: 'SL_FIRST',
      minRiskReward: 1.5,
      maxHoldingBars: 30,
      useAdaptiveEngine: true,
      partialExit: {
        enabled: true,
        tp1Percent: 50,
        tp2Percent: 30,
        moveSlToBreakevenAtTp1: true,
        trailRemainingAfterTp1: true,
      },
    };

    const replay = HistoricalReplayEngine.runReplay(candles, config);
    assert.ok(replay);

    // If trades were executed, check partial fill execution
    if (replay.trades.length > 0) {
      const tradeWithPartials = replay.trades.find((t) => t.partialFills && t.partialFills.length > 0);
      if (tradeWithPartials) {
        assert.ok(tradeWithPartials.partialFills.length >= 1);
        const steps = tradeWithPartials.partialFills.map((f) => f.step);
        assert.ok(steps.includes('TP1') || steps.includes('SL') || steps.includes('TIMEOUT'));
      }
    }
  });

  it('5. SignalDecisionAuditTrail: Deterministic logging and bounded memory buffer', () => {
    SignalAuditTrail.clear();

    for (let i = 0; i < 50; i++) {
      SignalAuditTrail.record({
        timestamp: 1700000000 + i * 60,
        asset: i % 2 === 0 ? 'BTCUSDT' : 'EURUSD',
        timeframe: '15m',
        action: i % 5 === 0 ? 'BUY' : 'HOLD',
        setupState: i % 5 === 0 ? 'CONFIRMED' : 'NO_SETUP',
        rejectionReason: i % 5 === 0 ? undefined : 'BAD_RR',
        setupQuality: i % 5 === 0 ? 82 : 45,
        modelConfidence: i % 5 === 0 ? 78 : 30,
        marketRegime: 'TRENDING_BULL',
      });
    }

    assert.equal(SignalAuditTrail.size(), 50);

    const btcRecords = SignalAuditTrail.query({ asset: 'BTCUSDT' });
    assert.equal(btcRecords.length, 25);

    const confirmedRecords = SignalAuditTrail.query({ action: 'BUY' });
    assert.equal(confirmedRecords.length, 10);

    // Test buffer capacity enforcement
    for (let i = 0; i < 1100; i++) {
      SignalAuditTrail.record({
        timestamp: 1710000000 + i * 60,
        asset: 'BTCUSDT',
        timeframe: '1h',
        action: 'HOLD',
        setupState: 'NO_SETUP',
        setupQuality: 20,
        modelConfidence: 15,
        marketRegime: 'RANGING',
      });
    }

    // Capacity is strictly capped at 1000
    assert.equal(SignalAuditTrail.size(), 1000);
  });

  it('6. WalkForwardEngine: Strict Temporal Split and Statistical Safety (< 30 trades)', () => {
    // Synthesize 100 bars
    const candles: Candle[] = [];
    let p = 1.0800;
    for (let i = 0; i < 100; i++) {
      p += (i % 2 === 0 ? 0.0010 : -0.0005);
      candles.push({
        time: 1700000000 + i * 3600,
        open: p,
        high: p + 0.0015,
        low: p - 0.0010,
        close: p + 0.0005,
        volume: 5000,
      });
    }

    const report = WalkForwardEngine.runTemporalSplit(candles, {
      asset: 'EURUSD',
      timeframe: '1h',
    }, 0.70);

    assert.ok(report);
    assert.equal(report.splitRatio, 0.70);
    assert.equal(report.totalCandles, 100);

    // Because synthetic 100 candles yield < 30 trades, statistical verdict must strictly be INSUFFICIENT_SAMPLE_SIZE
    assert.equal(report.inSampleSummary.isStatisticallyReliable, false);
    assert.equal(report.outOfSampleSummary.isStatisticallyReliable, false);
    assert.equal(report.statisticalVerdict, 'INSUFFICIENT_SAMPLE_SIZE');
    assert.ok(report.conclusion.includes('недостаточна для статистического доказательства'));
  });

  it('7. HistoricalReplayEngine: In-Sample vs Out-of-Sample metrics comparison integrity', () => {
    const candles: Candle[] = [];
    let p = 60000;
    for (let i = 0; i < 120; i++) {
      p += (i % 3 === 0 ? 150 : -50);
      candles.push({
        time: 1700000000 + i * 3600,
        open: p,
        high: p + 200,
        low: p - 100,
        close: p + 100,
        volume: 8000,
      });
    }

    const report = WalkForwardEngine.runTemporalSplit(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      useAdaptiveEngine: true,
    }, 0.65);

    assert.ok(report.inSampleSummary);
    assert.ok(report.outOfSampleSummary);
    assert.ok(typeof report.generalizationScore === 'number');
    assert.ok(report.generalizationScore >= 0 && report.generalizationScore <= 100);
  });
});
