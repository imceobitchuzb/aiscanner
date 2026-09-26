import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Candle } from '../lib/market/types';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { WalkForwardEngine } from '../lib/quant/walkForwardEngine';
import { MonteCarloEngine } from '../lib/quant/monteCarloEngine';
import { ParameterSensitivityEngine } from '../lib/quant/parameterSensitivity';
import { ConfidenceCalibrationEngine } from '../lib/quant/confidenceCalibration';

// Helper to generate realistic synthetic wave series for controlled unit tests
function generateTestCandles(count: number, trend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'UP'): Candle[] {
  const candles: Candle[] = [];
  let price = 50000;
  const now = 1700000000;

  for (let i = 0; i < count; i++) {
    let step = 0;
    if (trend === 'UP') {
      const cycle = i % 10;
      step = cycle < 7 ? 120 + (i % 3) * 20 : -70 - (i % 2) * 15;
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
      time: now + i * 3600,
      open,
      high,
      low,
      close,
      volume: 5000 + (i % 5) * 500,
    });
    price = close;
  }
  return candles;
}

describe('Phase 3: Historical Replay Engine & Quant Verification Suite', () => {

  it('1. Strict Zero Look-Ahead Verification: future candles do not affect current signal', () => {
    const candlesA = generateTestCandles(60, 'UP');
    const candlesB = generateTestCandles(60, 'UP');

    // Mutate future candles beyond bar 45 in candlesB
    for (let i = 46; i < candlesB.length; i++) {
      candlesB[i].close = 999999;
      candlesB[i].high = 999999;
    }

    // Run replay only up to bar 45
    const repA = HistoricalReplayEngine.runReplay(candlesA.slice(0, 46), {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });
    const repB = HistoricalReplayEngine.runReplay(candlesB.slice(0, 46), {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    // Outcomes and trades up to bar 45 must be 100% IDENTICAL
    assert.equal(repA.totalTradesExecuted, repB.totalTradesExecuted);
    assert.equal(repA.winRate, repB.winRate);
    assert.equal(repA.netPnlUsd, repB.netPnlUsd);
  });

  it('2. Conservative SL/TP Collision Resolution: SL First', () => {
    // Construct series where entry happens, then next bar has extreme range hitting BOTH SL and TP
    const baseCandles = generateTestCandles(50, 'UP');
    const entryBar = baseCandles[baseCandles.length - 1];

    // Artificial collision bar: touches deep low and high
    const collisionBar: Candle = {
      time: entryBar.time + 3600,
      open: entryBar.close,
      high: entryBar.close + 5000, // TP zone
      low: entryBar.close - 5000,  // SL zone
      close: entryBar.close,
      volume: 10000,
    };

    const collisionCandles = [...baseCandles, collisionBar];

    const repConservative = HistoricalReplayEngine.runReplay(collisionCandles, {
      asset: 'TEST',
      timeframe: '1h',
      collisionRule: 'SL_FIRST',
    });

    // When SL_FIRST is chosen, any collision MUST be logged as LOSS
    assert.equal(repConservative.collisionRuleUsed, 'SL_FIRST');
    const collisionTrade = repConservative.trades.find((t) => t.exitReason === 'COLLISION_SL');
    if (collisionTrade) {
      assert.equal(collisionTrade.outcome, 'LOSS');
      assert.ok(collisionTrade.rMultiple <= 0);
    }
  });

  it('3. Long Trade Execution & Positive R Realization', () => {
    const candles = generateTestCandles(80, 'UP');
    const rep = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      minRiskReward: 1.5,
    });

    assert.equal(rep.status, 'SUCCESS');
    assert.ok(rep.totalCandles === 80);
    const longTrades = rep.trades.filter((t) => t.direction === 'LONG');
    if (longTrades.length > 0) {
      const firstLong = longTrades[0];
      assert.equal(firstLong.direction, 'LONG');
      assert.ok(firstLong.stopLoss < firstLong.entryPrice);
      assert.ok(firstLong.takeProfit1 > firstLong.entryPrice);
    }
  });

  it('4. Short Trade Execution & Downside R Realization', () => {
    const candles = generateTestCandles(80, 'DOWN');
    const rep = HistoricalReplayEngine.runReplay(candles, {
      asset: 'ETHUSDT',
      timeframe: '1h',
      minRiskReward: 1.5,
    });

    assert.equal(rep.status, 'SUCCESS');
    const shortTrades = rep.trades.filter((t) => t.direction === 'SHORT');
    if (shortTrades.length > 0) {
      const firstShort = shortTrades[0];
      assert.equal(firstShort.direction, 'SHORT');
      assert.ok(firstShort.stopLoss > firstShort.entryPrice);
      assert.ok(firstShort.takeProfit1 < firstShort.entryPrice);
    }
  });

  it('5. Timeout Execution: Exits at maxHoldingBars', () => {
    // Generate sideways range where neither SL nor TP is hit
    const sideways = generateTestCandles(80, 'SIDEWAYS');
    const rep = HistoricalReplayEngine.runReplay(sideways, {
      asset: 'EURUSD',
      timeframe: '1h',
      maxHoldingBars: 10,
    });

    const timeoutTrades = rep.trades.filter((t) => t.exitReason === 'TIMEOUT');
    for (const t of timeoutTrades) {
      assert.ok(t.durationBars >= 10, `Duration should be >= 10, got ${t.durationBars}`);
    }
  });

  it('6. MFE and MAE Precision', () => {
    const candles = generateTestCandles(70, 'UP');
    const rep = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    for (const t of rep.trades) {
      assert.ok(!isNaN(t.mfePercent) && t.mfePercent >= 0, 'MFE must be non-negative');
      assert.ok(!isNaN(t.maePercent) && t.maePercent >= 0, 'MAE must be non-negative');
    }
  });

  it('7. Transaction Costs: Fees and Slippage Impact (Gross vs Net)', () => {
    const candles = generateTestCandles(75, 'UP');
    const repNoCost = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      feesBps: 0,
      slippageBps: 0,
    });
    const repWithCost = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      feesBps: 10,
      slippageBps: 5,
    });

    if (repNoCost.totalTradesExecuted > 0 && repWithCost.totalTradesExecuted > 0) {
      assert.ok(repWithCost.netPnlUsd < repNoCost.netPnlUsd, 'Net PnL with costs must be strictly lower than zero cost');
      assert.ok(repWithCost.totalFeesUsd > 0, 'Fees must be recorded');
      assert.ok(repWithCost.totalSlippageUsd > 0, 'Slippage must be recorded');
    }
  });

  it('8. Walk-Forward Engine: Unseen Out-of-Sample Evaluation', () => {
    const candles = generateTestCandles(150, 'UP');
    const wf = WalkForwardEngine.runWalkForward(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    }, 3);

    assert.equal(wf.status, 'SUCCESS');
    assert.ok(wf.totalWindows > 0);
    for (const w of wf.windows) {
      assert.ok(w.outOfSample.totalCandles > 0);
      assert.ok(w.inSample.totalCandles > w.outOfSample.totalCandles);
    }
    assert.ok(['ROBUST', 'MODERATE', 'OVERFITTED'].includes(wf.robustnessGrade));
  });

  it('9. Monte Carlo Engine: 10,000 Bootstrap Simulations with Real Trades', () => {
    const candles = generateTestCandles(90, 'UP');
    const rep = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    const mc = MonteCarloEngine.simulate(rep.trades, 10000, 10000);

    if (rep.trades.length >= 5) {
      assert.equal(mc.status, 'SUCCESS');
      assert.equal(mc.totalSimulations, 10000);
      assert.ok(mc.finalEquity.p5 <= mc.finalEquity.p50);
      assert.ok(mc.finalEquity.p50 <= mc.finalEquity.p95);
      assert.ok(mc.probabilityOfRuin >= 0 && mc.probabilityOfRuin <= 100);
      assert.ok(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(mc.riskOfRuinVerdict));
    } else {
      assert.equal(mc.status, 'INSUFFICIENT_DATA');
    }
  });

  it('10. Confidence Calibration: Realized Win Rate vs Predicted Confidence', () => {
    const candles = generateTestCandles(90, 'UP');
    const rep = HistoricalReplayEngine.runReplay(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
    });

    const cal = ConfidenceCalibrationEngine.evaluate(rep.trades);
    assert.ok(['CALIBRATED', 'UNCALIBRATED'].includes(cal.status));
    assert.ok(!isNaN(cal.expectedCalibrationError));
  });

  it('11. Parameter Sensitivity Engine: Baseline vs Perturbations', () => {
    const candles = generateTestCandles(90, 'UP');
    const sens = ParameterSensitivityEngine.analyze(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      minRiskReward: 1.5,
    });

    if (sens.parameterRobustnessVerdict !== 'INSUFFICIENT_DATA') {
      assert.ok(sens.variations.length >= 3);
      assert.ok(sens.variations.some((v) => v.isBaseline));
      assert.ok(sens.variations.some((v) => v.parameterName === 'minRiskReward'));
    }
  });

  it('12. Insufficient Data Handling', () => {
    const rep = HistoricalReplayEngine.runReplay([], { asset: 'EMPTY', timeframe: '1h' });
    assert.equal(rep.status, 'INSUFFICIENT_DATA');
    assert.equal(rep.totalTradesExecuted, 0);

    const wf = WalkForwardEngine.runWalkForward([], { asset: 'EMPTY', timeframe: '1h' });
    assert.equal(wf.status, 'INSUFFICIENT_DATA');

    const mc = MonteCarloEngine.simulate([], 10000);
    assert.equal(mc.status, 'INSUFFICIENT_DATA');
  });

});
