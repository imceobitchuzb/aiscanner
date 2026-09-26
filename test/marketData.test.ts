import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ASSET_CATALOG, getAssetMetadata } from '../lib/market/assetMetadata';
import { marketService } from '../lib/market/marketService';
import { CryptoMarketDataProvider } from '../lib/market/providers/cryptoProvider';
import { FxMarketDataProvider } from '../lib/market/providers/fxProvider';
import { MetalsMarketDataProvider } from '../lib/market/providers/metalsProvider';
import { StockMarketDataProvider } from '../lib/market/providers/stockProvider';

import { findHistoricalAnalogs } from '../lib/quant/analogMatcher';
import { runWalkForwardAnalysis } from '../lib/quant/walkForward';
import { runMonteCarloSimulation } from '../lib/quant/monteCarlo';
import { detectMarketRegime } from '../lib/quant/regimeDetector';
import { simulateDigitalTwin } from '../lib/quant/digitalTwin';

import { QuantFeatureEngine } from '../lib/quant/featureEngine';
import { MarketStructureEngine } from '../lib/quant/marketStructureEngine';
import { MultiTimeframeEngine } from '../lib/quant/multiTimeframeEngine';
import { MarketRegimeEngine } from '../lib/quant/regimeEngine';
import { SignalDecisionEngine } from '../lib/quant/signalDecisionEngine';
import { ForecastEngine } from '../lib/quant/forecastEngine';
import { SignalLifecycleEngine } from '../lib/quant/signalLifecycle';

describe('1. Asset Metadata & Asset Classes', () => {
  it('correctly classifies BTCUSDT as CRYPTO with Binance exchange and WebSocket stream', () => {
    const meta = getAssetMetadata('BTCUSDT');
    assert.equal(meta.category, 'CRYPTO');
    assert.equal(meta.exchange, 'Binance Spot');
    assert.equal(meta.streamType, 'WEBSOCKET');
    assert.equal(meta.priceDecimals, 2);
  });

  it('correctly classifies XAUUSD as METALS with LBMA/COMEX exchange and 24/5 hours', () => {
    const meta = getAssetMetadata('XAUUSD');
    assert.equal(meta.category, 'METALS');
    assert.match(meta.exchange, /COMEX|LBMA/);
    assert.equal(meta.tradingHours, '24/5');
    assert.equal(meta.baseCurrency, 'XAU');
    assert.equal(meta.quoteCurrency, 'USD');
  });

  it('correctly classifies EURUSD as FOREX with 4 price decimals precision', () => {
    const meta = getAssetMetadata('EURUSD');
    assert.equal(meta.category, 'FOREX');
    assert.equal(meta.priceDecimals, 4);
    assert.equal(meta.tradingHours, '24/5');
  });

  it('correctly classifies NVDA as EQUITIES with US_EQUITIES hours', () => {
    const meta = getAssetMetadata('NVDA');
    assert.equal(meta.category, 'EQUITIES');
    assert.equal(meta.tradingHours, 'US_EQUITIES');
  });
});

describe('2. Provider Abstraction & Polymorphic Dispatcher', () => {
  it('resolves crypto symbols to CryptoMarketDataProvider without symbol if/else hacks', () => {
    const provider = marketService.resolveProvider('BTCUSDT');
    assert.ok(provider instanceof CryptoMarketDataProvider);
  });

  it('resolves XAUUSD to MetalsMarketDataProvider without symbol if/else hacks', () => {
    const provider = marketService.resolveProvider('XAUUSD');
    assert.ok(provider instanceof MetalsMarketDataProvider);
  });

  it('resolves EURUSD to FxMarketDataProvider', () => {
    const provider = marketService.resolveProvider('EURUSD');
    assert.ok(provider instanceof FxMarketDataProvider);
  });

  it('resolves NVDA to StockMarketDataProvider', () => {
    const provider = marketService.resolveProvider('NVDA');
    assert.ok(provider instanceof StockMarketDataProvider);
  });
});

describe('3. Real Data Provenance & Spot Gold Verification', () => {
  it('fetches real Spot Gold (XAUUSD) with price > 3000, Bid, Ask, Spread and Provenance', async () => {
    const metalsProvider = new MetalsMarketDataProvider();
    const quote = await metalsProvider.getQuote('XAUUSD');

    assert.equal(quote.symbol, 'XAUUSD');
    assert.equal(quote.category, 'METALS');
    // Real spot gold in 2026 trades above $3000 (not the old mock $2684.50!)
    assert.ok(quote.price > 3000, `Expected gold price > 3000, got ${quote.price}`);
    assert.ok(quote.bid > 0, 'Bid price must be positive');
    assert.ok(quote.ask >= quote.bid, 'Ask price must be >= Bid price');
    assert.ok(quote.spread >= 0, 'Spread must be non-negative');
    assert.ok(quote.latencyMs >= 0, 'Latency must be non-negative');
    assert.ok(['GOLD_API_SPOT', 'COMEX_FUTURES', 'PAXOS_PHYSICAL_GOLD'].includes(quote.source));
    assert.ok(['OPEN', 'CLOSED', 'PRE_MARKET', 'POST_MARKET'].includes(quote.marketStatus));
    assert.ok(['LIVE', 'RECENT', 'STALE'].includes(quote.freshness));
  });

  it('fetches real Crypto quote (BTCUSDT) with authentic Binance provenance', async () => {
    const cryptoProvider = new CryptoMarketDataProvider();
    const quote = await cryptoProvider.getQuote('BTCUSDT');

    assert.equal(quote.symbol, 'BTCUSDT');
    assert.equal(quote.category, 'CRYPTO');
    assert.ok(quote.price > 10000, `Expected BTC price > 10000, got ${quote.price}`);
    assert.equal(quote.source, 'BINANCE_SPOT');
    assert.equal(quote.marketStatus, 'OPEN');
    assert.ok(['LIVE', 'RECENT'].includes(quote.freshness));
  });

  it('fetches real Forex quote (EURUSD) with 4 decimal places precision', async () => {
    const fxProvider = new FxMarketDataProvider();
    const quote = await fxProvider.getQuote('EURUSD');

    assert.equal(quote.symbol, 'EURUSD');
    assert.equal(quote.category, 'FOREX');
    assert.ok(quote.price > 0.5 && quote.price < 2.0, `Expected EURUSD rate between 0.5 and 2.0, got ${quote.price}`);
    assert.ok(['INTERBANK_FX_FEED', 'ECB_CENTRAL_BANK_RATE'].includes(quote.source));
  });
});

describe('4. Candle Normalization & Mathematical Validity', () => {
  it('normalizes candles with valid UNIX seconds UTC and OHLC invariants', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 10);
    assert.ok(candles.length > 0, 'Expected non-empty candle array');

    for (const c of candles) {
      assert.ok(c.time < 1e11, `Candle time must be seconds UTC, not ms: ${c.time}`);
      assert.ok(c.high >= c.low, `High (${c.high}) must be >= Low (${c.low})`);
      assert.ok(c.high >= c.open, `High (${c.high}) must be >= Open (${c.open})`);
      assert.ok(c.high >= c.close, `High (${c.high}) must be >= Close (${c.close})`);
      assert.ok(c.low <= c.open, `Low (${c.low}) must be <= Open (${c.open})`);
      assert.ok(c.low <= c.close, `Low (${c.low}) must be <= Close (${c.close})`);
      assert.ok(c.volume >= 0, `Volume must be >= 0: ${c.volume}`);
    }
  });

  it('fetches and normalizes real historical Gold candles', async () => {
    const candles = await marketService.getCandles('XAUUSD', '1h', 10);
    assert.ok(candles.length > 0, 'Expected non-empty gold candle array');
    const last = candles[candles.length - 1];
    assert.ok(last.close > 3000, `Expected gold candle close > 3000, got ${last.close}`);
  });
});

describe('5. Quantitative Engines Integrity (Elimination of Fake Metrics)', () => {
  it('analogMatcher returns 0 setups and empty matches on insufficient data (NO fake 142 setups)', () => {
    const result = findHistoricalAnalogs([], 'BTCUSDT');
    assert.equal(result.similarSetupsFound, 0);
    assert.equal(result.winRateTP, 0);
    assert.equal(result.lossRateSL, 0);
    assert.equal(result.topMatches.length, 0);
  });

  it('walkForward analysis returns INSUFFICIENT_DATA on insufficient candles (NO fake 1.82 Sharpe)', () => {
    const config = {
      name: 'EMA Momentum',
      symbol: 'BTCUSDT',
      timeframe: '1h' as const,
      initialBalance: 10000,
      riskPerTradePercent: 1.5,
      stopLossAtrMultiplier: 2.0,
      takeProfitAtrMultiplier: 3.5,
      indicators: {
        useEmaCross: true,
        useRsiFilter: true,
        useStructureBreakout: true,
        useVolumeExpansion: false,
      },
    };

    const result = runWalkForwardAnalysis([], config);
    assert.equal(result.robustnessGrade, 'INSUFFICIENT_DATA');
    assert.equal(result.inSampleSharpe, 0);
    assert.equal(result.outOfSampleSharpe, 0);
  });

  it('monteCarlo simulation returns initial balance on zero trades (NO fake 15-45% gains)', () => {
    const result = runMonteCarloSimulation([], 10000);
    assert.equal(result.p5TerminalEquity, 10000);
    assert.equal(result.p50TerminalEquity, 10000);
    assert.equal(result.p95TerminalEquity, 10000);
    assert.equal(result.expectedMaxDrawdown, 0);
    assert.equal(result.probabilityOfRuin, 0);
  });

  it('regimeDetector returns UNCERTAIN and 0 confidence on empty candles (NO fake 45% confidence)', () => {
    const result = detectMarketRegime([]);
    assert.equal(result.regime, 'UNCERTAIN');
    assert.equal(result.confidence, 0);
    assert.equal(result.durationHours, 0);
  });
});

describe('6. Digital Twin PnL and Liquidation Math', () => {
  it('computes correct Long PnL and liquidation price', () => {
    const res = simulateDigitalTwin(50000, 4.0, 'LONG', 5, 10000, 'BTCUSDT');
    // +4% price move with 5x leverage = +20% PnL
    assert.equal(res.pnlPercent, 20);
    assert.equal(res.pnlUsd, 2000);
    // Liquidation price for 5x long is below current price
    assert.ok(res.liquidationPrice < 50000);
    assert.ok(res.simulatedPrice === 52000);
  });

  it('computes correct Short PnL and liquidation price', () => {
    const res = simulateDigitalTwin(50000, 4.0, 'SHORT', 5, 10000, 'BTCUSDT');
    // +4% price rise against short with 5x leverage = -20% PnL
    assert.equal(res.pnlPercent, -20);
    assert.equal(res.pnlUsd, -2000);
    // Liquidation price for 5x short is above current price
    assert.ok(res.liquidationPrice > 50000);
  });
});

describe('7. QuantFeatureEngine Mathematical Precision', () => {
  it('computes all mathematical features without NaN on authentic candles', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 60);
    const feat = QuantFeatureEngine.extractFeatures(candles);
    assert.ok(feat !== null, 'Features should not be null for 60 candles');

    assert.ok(!isNaN(feat.price) && feat.price > 0, 'Price must be positive');
    assert.ok(!isNaN(feat.atr14) && feat.atr14 > 0, 'ATR must be positive');
    assert.ok(!isNaN(feat.atrPercent) && feat.atrPercent > 0, 'ATR% must be positive');
    assert.ok(!isNaN(feat.ema20) && feat.ema20 > 0, 'EMA20 must be positive');
    assert.ok(!isNaN(feat.ema50) && feat.ema50 > 0, 'EMA50 must be positive');
    assert.ok(!isNaN(feat.rsi14) && feat.rsi14 >= 0 && feat.rsi14 <= 100, 'RSI must be in [0, 100]');
    assert.ok(!isNaN(feat.macd.macdLine), 'MACD line must be valid');
    assert.ok(!isNaN(feat.macd.histogram), 'MACD histogram must be valid');
    assert.ok(!isNaN(feat.adx.adx14) && feat.adx.adx14 >= 0, 'ADX must be non-negative');
    assert.ok(!isNaN(feat.bollinger.upper), 'Bollinger Upper must be valid');
    assert.ok(!isNaN(feat.bollinger.bandwidth) && feat.bollinger.bandwidth >= 0, 'Bollinger bandwidth must be >= 0');
    assert.ok(!isNaN(feat.realizedVolatility) && feat.realizedVolatility >= 0, 'Realized volatility must be >= 0');
    assert.ok(!isNaN(feat.trendSlope), 'Trend slope must be valid');
  });
});

describe('8. MarketStructureEngine Swing Extrema & Authentic S/R', () => {
  it('identifies fractal swing points without arbitrary price multipliers', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 60);
    const struct = MarketStructureEngine.analyze(candles);

    assert.ok(['BULLISH_STRUCTURE', 'BEARISH_STRUCTURE', 'RANGE', 'BREAKOUT', 'BREAKDOWN', 'UNCERTAIN'].includes(struct.state));
    assert.ok(struct.confidence >= 0 && struct.confidence <= 100);
    assert.ok(struct.keySupport > 0, 'Key support must be positive');
    assert.ok(struct.keyResistance > 0, 'Key resistance must be positive');
    assert.ok(struct.keyResistance >= struct.keySupport, 'Resistance must be >= Support');
  });

  it('returns UNCERTAIN and 0 confidence on empty or sparse candles', () => {
    const struct = MarketStructureEngine.analyze([]);
    assert.equal(struct.state, 'UNCERTAIN');
    assert.equal(struct.confidence, 0);
  });
});

describe('9. MultiTimeframeEngine Alignment & Resampling', () => {
  it('computes mathematically derived alignment percentage and hierarchy', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 60);
    const mtf = MultiTimeframeEngine.analyze(candles, '1h');

    assert.equal(mtf.anchorTimeframe, '1h');
    assert.ok(mtf.rows.length >= 3, 'Should produce at least 3 hierarchy rows');
    assert.ok(mtf.alignmentScore >= 0 && mtf.alignmentScore <= 100, 'Alignment score must be 0-100%');
    assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(mtf.dominantBias));
    assert.ok(mtf.totalWeight > 0, 'Total weight must be positive');
  });

  it('aggregates candles properly combining open, close, high, low, volume', () => {
    const testCandles = [
      { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 100 },
      { time: 200, open: 12, high: 18, low: 11, close: 16, volume: 150 },
    ];
    const agg = MultiTimeframeEngine.aggregateCandles(testCandles, 2);
    assert.equal(agg.length, 1);
    assert.equal(agg[0].open, 10);
    assert.equal(agg[0].close, 16);
    assert.equal(agg[0].high, 18);
    assert.equal(agg[0].low, 9);
    assert.equal(agg[0].volume, 250);
  });
});

describe('10. MarketRegimeEngine Dynamic Classification', () => {
  it('classifies market regime with dynamic confidence based on features', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 60);
    const regime = MarketRegimeEngine.classify(candles);

    assert.ok(['TRENDING_BULL', 'TRENDING_BEAR', 'RANGE', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'BREAKOUT', 'BREAKDOWN', 'UNCERTAIN'].includes(regime.regime));
    assert.ok(regime.confidence >= 0 && regime.confidence <= 100);
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(regime.stability));
    assert.ok(regime.transitionProbabilities.length > 0);
  });
});

describe('11. SignalDecisionEngine Pipeline, Risk Gates & No-Setup', () => {
  it('returns NO_SETUP when candles are insufficient (< 30)', () => {
    const result = SignalDecisionEngine.evaluate([], 'BTCUSDT', '1h');
    assert.equal(result.setupState, 'NO_SETUP');
    assert.equal(result.direction, 'NEUTRAL');
    assert.equal(result.setupQuality, 0);
    assert.ok(result.rejectionReason?.includes('Недостаточно исторических свечей'));
  });

  it('returns NO_SETUP when market data is stale or offline (Gate 2)', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 50);
    const result = SignalDecisionEngine.evaluate(candles, 'BTCUSDT', '1h', true, false);
    assert.equal(result.setupState, 'NO_SETUP');
    assert.equal(result.direction, 'NEUTRAL');
    assert.ok(result.rejectionReason?.includes('OFFLINE'));
  });

  it('honors minimum R:R threshold and rejects bad R:R setups', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 50);
    // Setting impossible R:R threshold of 10.0 guarantees rejection
    const result = SignalDecisionEngine.evaluate(candles, 'BTCUSDT', '1h', true, true, 10.0);
    assert.equal(result.setupState, 'NO_SETUP');
    assert.equal(result.direction, 'NEUTRAL');
  });

  it('evaluates synthetic bullish series into LONG candidate with trade plan', () => {
    const bullishCandles: Candle[] = [];
    let price = 50000;
    const now = Math.floor(Date.now() / 1000) - 70 * 3600;

    for (let i = 0; i < 70; i++) {
      const cycle = i % 10;
      const isUp = cycle < 7;
      const step = isUp ? 120 + (i % 3) * 20 : -70 - (i % 2) * 15;
      const open = price;
      const close = price + step;
      bullishCandles.push({
        time: now + i * 3600,
        open,
        high: Math.max(open, close) + 40,
        low: Math.min(open, close) - 40,
        close,
        volume: isUp ? 6000 + i * 50 : 3500,
      });
      price = close;
    }

    const result = SignalDecisionEngine.evaluate(bullishCandles, 'TEST_ASSET', '1h', true, true, 1.2);
    assert.equal(result.direction, 'LONG');
    assert.ok(result.setupQuality >= 60, `Quality should be >= 60, got ${result.setupQuality}`);
    assert.ok(result.tradePlan !== null);
    assert.ok(result.tradePlan.takeProfit1 > result.tradePlan.entryPrice);
    assert.ok(result.tradePlan.stopLoss < result.tradePlan.entryPrice);
    assert.ok(result.evidence.some((e) => e.category === 'TREND'));
  });

  it('evaluates synthetic bearish series into SHORT candidate (separate symmetric logic)', () => {
    const bearishCandles: Candle[] = [];
    let price = 70000;
    const now = Math.floor(Date.now() / 1000) - 70 * 3600;

    for (let i = 0; i < 70; i++) {
      const cycle = i % 10;
      const isDown = cycle < 7;
      const step = isDown ? -120 - (i % 3) * 20 : 70 + (i % 2) * 15;
      const open = price;
      const close = price + step;
      bearishCandles.push({
        time: now + i * 3600,
        open,
        high: Math.max(open, close) + 40,
        low: Math.min(open, close) - 40,
        close,
        volume: isDown ? 6000 + i * 50 : 3500,
      });
      price = close;
    }

    const result = SignalDecisionEngine.evaluate(bearishCandles, 'TEST_BEAR', '1h', true, true, 1.2);
    assert.equal(result.direction, 'SHORT');
    assert.ok(result.setupQuality >= 60);
    assert.ok(result.tradePlan !== null);
    assert.ok(result.tradePlan.takeProfit1 < result.tradePlan.entryPrice);
    assert.ok(result.tradePlan.stopLoss > result.tradePlan.entryPrice);
  });
});

describe('12. ForecastEngine & Honest Scenarios', () => {
  it('generates Brownian diffusion cone and honest scenario scores', async () => {
    const candles = await marketService.getCandles('BTCUSDT', '1h', 50);
    const forecast = ForecastEngine.generate(candles, 24);

    assert.equal(forecast.isCalibrated, false);
    assert.equal(forecast.cone.length, 25); // 0 + 24 horizons
    assert.equal(forecast.scenarios.length, 3); // BULL, BASE, BEAR

    const bull = forecast.scenarios.find((s) => s.id === 'BULL')!;
    const bear = forecast.scenarios.find((s) => s.id === 'BEAR')!;
    const base = forecast.scenarios.find((s) => s.id === 'BASE')!;

    assert.ok(bull.targetPrice > forecast.currentPrice);
    assert.ok(bear.targetPrice < forecast.currentPrice);
    // Scores sum to 100
    assert.equal(bull.scenarioScore + bear.scenarioScore + base.scenarioScore, 100);
  });
});

describe('13. SignalLifecycleEngine Forward Testing & MFE/MAE', () => {
  it('tracks WIN and TP2_HIT when forward price hits take profit', () => {
    const signal: any = {
      id: 'sig-test-1',
      direction: 'LONG',
      tradePlan: {
        entryPrice: 50000,
        stopLoss: 48000,
        stopLossDistance: 2000,
        takeProfit1: 53000,
        takeProfit2: 55000,
        riskRewardRatio: 2.5,
      },
    };

    const forwardCandles = [
      { time: 1000, open: 50000, high: 52000, low: 49500, close: 51500, volume: 100 },
      { time: 2000, open: 51500, high: 53500, low: 51000, close: 53200, volume: 120 },
      { time: 3000, open: 53200, high: 55500, low: 52800, close: 55100, volume: 140 },
    ];

    const outcome = SignalLifecycleEngine.evaluateOutcome(signal, forwardCandles);
    assert.equal(outcome.status, 'WIN');
    assert.equal(outcome.finalLifecycleState, 'TP2_HIT');
    assert.ok(outcome.achievedRMultiple >= 2.5);
    assert.ok(outcome.maxFavorableExcursionPct > 10);
  });

  it('tracks LOSS and SL_HIT when forward price drops to stop loss', () => {
    const signal: any = {
      id: 'sig-test-2',
      direction: 'LONG',
      tradePlan: {
        entryPrice: 50000,
        stopLoss: 48000,
        stopLossDistance: 2000,
        takeProfit1: 53000,
        takeProfit2: 55000,
        riskRewardRatio: 2.5,
      },
    };

    const forwardCandles = [
      { time: 1000, open: 50000, high: 50200, low: 47500, close: 47800, volume: 200 },
    ];

    const outcome = SignalLifecycleEngine.evaluateOutcome(signal, forwardCandles);
    assert.equal(outcome.status, 'LOSS');
    assert.equal(outcome.finalLifecycleState, 'SL_HIT');
    assert.equal(outcome.achievedRMultiple, -1.0);
  });
});

