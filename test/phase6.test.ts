import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CryptoConfirmationEngine } from '../lib/quant/cryptoConfirmationEngine';
import { ForexPipEngine } from '../lib/quant/forexPipEngine';
import { HistoricalDataFeed } from '../lib/quant/historicalDataFeed';
import { WalkForwardEngine } from '../lib/quant/walkForwardEngine';
import { SignalAuditTrail } from '../lib/quant/signalAuditTrail';
import { AdaptiveSignalEngine } from '../lib/quant/adaptiveSignalEngine';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { Candle } from '../lib/market/types';

describe('Phase 6: Robustness, Multi-Timeframe Confirmation & Historical Expansion Suite', () => {

  it('1. ForexPipEngine: Converts price to pips and calculates ATR in pips accurately', () => {
    // 4-decimal currency pairs (EURUSD)
    const eurusdDiff = 0.0035; // 35 pips
    const pips = ForexPipEngine.priceToPips(eurusdDiff, 'EURUSD');
    assert.equal(pips, 35);

    const priceBack = ForexPipEngine.pipsToPrice(35, 'EURUSD');
    assert.equal(priceBack, 0.0035);

    // ATR to pips
    const atrPrice = 0.0012; // 12 pips
    const atrPips = ForexPipEngine.calculateAtrInPips(atrPrice, 'EURUSD');
    assert.equal(atrPips, 12);

    // JPY pair
    const usdjpyDiff = 0.45; // 45 pips
    const jpyPips = ForexPipEngine.priceToPips(usdjpyDiff, 'USDJPY');
    assert.equal(jpyPips, 45);
  });

  it('2. ForexPipEngine: Evaluates FX volatility calibrated in pips rather than crypto %', () => {
    // 15m EURUSD with 10 pips ATR (0.09% of price)
    const vol15m = ForexPipEngine.evaluateForexVolatility('EURUSD', 0.0010, '15m');
    assert.equal(vol15m.isOptimal, true);
    assert.equal(vol15m.score, 85);
    assert.ok(vol15m.reason.includes('Оптимальная'));

    // 15m EURUSD with 2 pips ATR -> low volatility drift
    const volLow = ForexPipEngine.evaluateForexVolatility('EURUSD', 0.0002, '15m');
    assert.equal(volLow.isOptimal, false);
    assert.equal(volLow.score, 45);

    // 15m EURUSD with 55 pips ATR -> extreme volatility spike
    const volHigh = ForexPipEngine.evaluateForexVolatility('EURUSD', 0.0055, '15m');
    assert.equal(volHigh.isOptimal, false);
    assert.equal(volHigh.score, 35);
  });

  it('3. ForexPipEngine: Validates structural R:R in pip units (1.5R required)', () => {
    // 25 pips headroom to resistance, 12 pips stop loss -> R:R = 2.08 (Valid >= 1.5)
    const validAssessment = ForexPipEngine.evaluateForexHeadroom('EURUSD', 0.0025, 0.0012, 1.5);
    assert.equal(validAssessment.hasValidRr, true);
    assert.ok(validAssessment.riskReward >= 1.5);
    assert.equal(validAssessment.score, 90);

    // 8 pips headroom, 12 pips stop loss -> R:R = 0.67 (Invalid < 1.5)
    const invalidAssessment = ForexPipEngine.evaluateForexHeadroom('EURUSD', 0.0008, 0.0012, 1.5);
    assert.equal(invalidAssessment.hasValidRr, false);
    assert.ok(invalidAssessment.riskReward < 1.5);
    assert.equal(invalidAssessment.score, 25);
  });

  it('4. CryptoConfirmationEngine: Rejects breakout attempts in RANGE and LOW_VOLATILITY regimes', () => {
    const candles: Candle[] = [];
    const baseTime = 1700000000;
    for (let i = 0; i < 50; i++) {
      candles.push({
        time: baseTime + i * 900,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 100,
      });
    }

    const mockStructure: any = {
      state: 'BREAKOUT',
      recentSwingHigh: 50000,
      recentSwingLow: 49500,
    };
    const mockRegimeRange: any = { regime: 'RANGE', confidence: 70 };
    const mockFeatures: any = { atrPercent: 1.5, price: 50050, ema20: 50000, atr14: 100 };

    const rangeRejection = CryptoConfirmationEngine.validateShortTimeframeCrypto(
      candles,
      'LONG',
      mockStructure,
      mockRegimeRange,
      mockFeatures,
      'BTCUSDT',
      '15m'
    );

    assert.equal(rangeRejection.isApproved, false);
    assert.equal(rangeRejection.verdict, 'RANGE_BREAKOUT_REJECTED');

    const mockRegimeLowVol: any = { regime: 'TRENDING_BULL', confidence: 70 };
    const mockFeaturesLowVol: any = { atrPercent: 0.4, price: 50050, ema20: 50000, atr14: 100 };

    const lowVolRejection = CryptoConfirmationEngine.validateShortTimeframeCrypto(
      candles,
      'LONG',
      mockStructure,
      mockRegimeLowVol,
      mockFeaturesLowVol,
      'BTCUSDT',
      '15m'
    );

    assert.equal(lowVolRejection.isApproved, false);
    assert.equal(lowVolRejection.verdict, 'LOW_VOLATILITY_BREAKOUT_REJECTED');
  });

  it('5. CryptoConfirmationEngine: Detects Liquidity Sweeps with large rejection wicks', () => {
    const candles: Candle[] = [];
    const baseTime = 1700000000;
    for (let i = 0; i < 49; i++) {
      candles.push({
        time: baseTime + i * 900,
        open: 50000,
        high: 50200,
        low: 49800,
        close: 50100,
        volume: 500,
      });
    }

    // 50th candle: spikes above 50,500 swing high to 50,800, but is rejected and closes at 50,200 with 60% upper wick
    candles.push({
      time: baseTime + 49 * 900,
      open: 50250,
      high: 50800,
      low: 50150,
      close: 50200,
      volume: 2500,
    });

    const mockStructure: any = {
      state: 'BREAKOUT',
      recentSwingHigh: 50500,
      recentSwingLow: 49500,
    };
    const mockRegime: any = { regime: 'TRENDING_BULL', confidence: 75 };
    const mockFeatures: any = { atrPercent: 1.8, price: 50200, ema20: 50100, atr14: 200 };

    const sweepResult = CryptoConfirmationEngine.validateShortTimeframeCrypto(
      candles,
      'LONG',
      mockStructure,
      mockRegime,
      mockFeatures,
      'BTCUSDT',
      '15m'
    );

    assert.equal(sweepResult.isApproved, false);
    assert.equal(sweepResult.verdict, 'LIQUIDITY_SWEEP_RISK');
    assert.equal(sweepResult.isLiquiditySweepRisk, true);
    assert.ok(sweepResult.sweepDetails);
  });

  it('6. CryptoConfirmationEngine: Approves VALIDATED_PULLBACK in direction of 1h trend', () => {
    // Generate synthetic 1h uptrend in 15m candles
    const candles: Candle[] = [];
    let p = 50000;
    const baseTime = 1700000000;

    for (let i = 0; i < 60; i++) {
      p += 30;
      candles.push({
        time: baseTime + i * 900,
        open: p - 10,
        high: p + 40,
        low: p - 20,
        close: p,
        volume: 1000,
      });
    }

    // Last candle is a bullish rejection bounce near EMA20
    const lastBar = candles[candles.length - 1];
    const mockStructure: any = {
      state: 'BULLISH_STRUCTURE',
      recentSwingHigh: p + 100,
      recentSwingLow: p - 300,
    };
    const mockRegime: any = { regime: 'TRENDING_BULL', confidence: 80 };
    const mockFeatures: any = {
      atrPercent: 1.2,
      price: lastBar.close,
      ema20: lastBar.close - 20,
      atr14: 80,
      rsi14: 52,
    };

    const pullbackResult = CryptoConfirmationEngine.validateShortTimeframeCrypto(
      candles,
      'LONG',
      mockStructure,
      mockRegime,
      mockFeatures,
      'BTCUSDT',
      '15m'
    );

    assert.equal(pullbackResult.isApproved, true);
    assert.ok(pullbackResult.verdict === 'VALIDATED_PULLBACK' || pullbackResult.verdict === 'CONFIRMED');
  });

  it('7. HistoricalDataFeed: Caches datasets and reports honest coverage without fabrication', async () => {
    HistoricalDataFeed.clearCache();

    const { candles, coverage } = await HistoricalDataFeed.loadDataset('BTCUSDT', '1h', 50);
    assert.ok(candles.length > 0);
    assert.equal(coverage.asset, 'BTCUSDT');
    assert.equal(coverage.timeframe, '1h');
    assert.ok(['COMPLETE', 'PARTIAL', 'DATASET_INCOMPLETE'].includes(coverage.status));
    assert.ok(coverage.timespanDays >= 0);

    // Verify cache hit
    const secondCall = await HistoricalDataFeed.loadDataset('BTCUSDT', '1h', 50);
    assert.equal(secondCall.candles.length, candles.length);
  });

  it('8. Upgraded Multi-Window Walk-Forward: Evaluates rolling windows with exposure and rejection rates', () => {
    const candles: Candle[] = [];
    let p = 50000;
    for (let i = 0; i < 150; i++) {
      p += (i % 3 === 0 ? 100 : -40);
      candles.push({
        time: 1700000000 + i * 3600,
        open: p,
        high: p + 120,
        low: p - 80,
        close: p + 50,
        volume: 3000,
      });
    }

    const wf = WalkForwardEngine.runWalkForward(candles, {
      asset: 'BTCUSDT',
      timeframe: '1h',
      useAdaptiveEngine: true,
    }, 3);

    assert.equal(wf.status, 'SUCCESS');
    assert.ok(wf.totalWindows > 0);
    for (const w of wf.windows) {
      assert.ok(w.inSampleMetrics);
      assert.ok(w.outOfSampleMetrics);
      assert.ok(typeof w.inSampleMetrics.exposurePercent === 'number');
      assert.ok(typeof w.outOfSampleMetrics.rejectionRatePercent === 'number');
    }

    // Statistical safety check
    assert.ok(typeof wf.isStatisticallyReliable === 'boolean');
    assert.ok(['PROVEN_EDGE', 'TENTATIVE_EDGE', 'OVERFITTED', 'INSUFFICIENT_SAMPLE_SIZE'].includes(wf.statisticalVerdict));
  });

  it('9. SignalAuditTrail Diagnostics: Answers Why Won, Why Lost, and Why Rejected', () => {
    SignalAuditTrail.clear();

    // 1. Rejected record
    SignalAuditTrail.logDecision({
      id: 'sig-test-rej-1',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      direction: 'LONG',
      finalDecision: 'REJECT',
      rejectionCode: 'RANGE_BREAKOUT_REJECTED',
      rejectionReason: 'Попытка пробоя в боковом диапазоне отклонена',
      setupQuality: 35,
    });

    // 2. Winning record
    SignalAuditTrail.logDecision({
      id: 'sig-test-win-1',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      direction: 'LONG',
      finalDecision: 'EXECUTE',
      setupQuality: 88,
      mtfAlignment: 85,
      htfStructure: 'BULLISH_STRUCTURE / BULLISH_STRUCTURE',
    });
    SignalAuditTrail.attachTradeOutcome('sig-test-win-1', 'WIN', 1.85, 'TP2_HIT');

    // 3. Losing record
    SignalAuditTrail.logDecision({
      id: 'sig-test-loss-1',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      direction: 'SHORT',
      finalDecision: 'EXECUTE',
      setupQuality: 70,
      mtfAlignment: 60,
      exitReason: 'SL_HIT',
    });
    SignalAuditTrail.attachTradeOutcome('sig-test-loss-1', 'LOSS', -1.0, 'SL_HIT');

    const rejDiag = SignalAuditTrail.getRejectionDiagnostics();
    assert.ok(rejDiag.length >= 1);
    assert.equal(rejDiag[0].code, 'RANGE_BREAKOUT_REJECTED');
    assert.equal(rejDiag[0].count, 1);

    const winLossDiag = SignalAuditTrail.getWinLossDiagnostics();
    assert.equal(winLossDiag.wins, 1);
    assert.equal(winLossDiag.losses, 1);
    assert.ok(winLossDiag.winDrivers.length > 0);
    assert.ok(winLossDiag.lossDrivers.length > 0);
  });
});
