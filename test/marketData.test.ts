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
