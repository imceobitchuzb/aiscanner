import { getAllSupportedSymbols, getAssetMetadata } from './assetMetadata';
import { IMarketDataProvider } from './providers/base';
import { CryptoMarketDataProvider } from './providers/cryptoProvider';
import { FxMarketDataProvider } from './providers/fxProvider';
import { MetalsMarketDataProvider } from './providers/metalsProvider';
import { StockMarketDataProvider } from './providers/stockProvider';
import { CandleWithProvenance, ProviderHealth, QuoteWithProvenance, Timeframe } from './types';

export class MarketDataService {
  private cryptoProvider = new CryptoMarketDataProvider();
  private metalsProvider = new MetalsMarketDataProvider();
  private fxProvider = new FxMarketDataProvider();
  private stockProvider = new StockMarketDataProvider();

  private providers: IMarketDataProvider[];

  constructor() {
    this.providers = [
      this.cryptoProvider,
      this.metalsProvider,
      this.fxProvider,
      this.stockProvider,
    ];
  }

  /**
   * Resolves the specialized market data provider based on asset class metadata.
   * Completely avoids symbol-specific if/else hacks.
   */
  public resolveProvider(symbol: string): IMarketDataProvider {
    const meta = getAssetMetadata(symbol);
    switch (meta.category) {
      case 'CRYPTO':
        return this.cryptoProvider;
      case 'METALS':
      case 'COMMODITIES':
        return this.metalsProvider;
      case 'FOREX':
        return this.fxProvider;
      case 'EQUITIES':
      case 'INDICES':
        return this.stockProvider;
      default:
        return this.cryptoProvider;
    }
  }

  public async getQuote(symbol: string): Promise<QuoteWithProvenance> {
    const provider = this.resolveProvider(symbol);
    try {
      return await provider.getQuote(symbol);
    } catch (err) {
      // In case primary provider errors, attempt fallback across remaining providers if supported
      for (const p of this.providers) {
        if (p !== provider && p.isSupported(symbol)) {
          try {
            return await p.getQuote(symbol);
          } catch {
            continue;
          }
        }
      }

      // If all live providers fail, construct explicit error quote rather than masking with mock
      const meta = getAssetMetadata(symbol);
      const nowSec = Math.floor(Date.now() / 1000);
      return {
        symbol: meta.symbol,
        name: meta.name,
        category: meta.category,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: '0',
        bid: 0,
        ask: 0,
        spread: 0,
        spreadPercent: 0,
        timestamp: nowSec,
        isoTimestamp: new Date(nowSec * 1000).toISOString(),
        source: 'DATA_UNAVAILABLE',
        latencyMs: 0,
        marketStatus: 'HALTED',
        freshness: 'OFFLINE',
        isLive: false,
        volatility: 0,
        regime: 'UNCERTAIN',
        signalState: 'NEUTRAL',
      };
    }
  }

  public async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit = 120
  ): Promise<CandleWithProvenance[]> {
    const provider = this.resolveProvider(symbol);
    try {
      const candles = await provider.getCandles(symbol, timeframe, limit);
      return this.normalizeCandles(candles);
    } catch (err) {
      // Fallback across providers
      for (const p of this.providers) {
        if (p !== provider && p.isSupported(symbol)) {
          try {
            const candles = await p.getCandles(symbol, timeframe, limit);
            return this.normalizeCandles(candles);
          } catch {
            continue;
          }
        }
      }
      return [];
    }
  }

  public async getWatchlist(): Promise<QuoteWithProvenance[]> {
    const symbols = getAllSupportedSymbols();
    const results = await Promise.allSettled(
      symbols.map((sym) => this.getQuote(sym))
    );

    return results
      .map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const meta = getAssetMetadata(symbols[i]);
        return {
          symbol: meta.symbol,
          name: meta.name,
          category: meta.category,
          price: 0,
          change24h: 0,
          high24h: 0,
          low24h: 0,
          volume24h: '0',
          bid: 0,
          ask: 0,
          spread: 0,
          spreadPercent: 0,
          timestamp: Math.floor(Date.now() / 1000),
          isoTimestamp: new Date().toISOString(),
          source: 'OFFLINE',
          latencyMs: 0,
          marketStatus: 'HALTED' as const,
          freshness: 'OFFLINE' as const,
          isLive: false,
        };
      })
      .filter((q) => q.price > 0);
  }

  public async getAllProviderHealth(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((p) => p.getHealth()));
  }

  /**
   * Enforces mathematical validity & timestamp normalization
   */
  private normalizeCandles(candles: CandleWithProvenance[]): CandleWithProvenance[] {
    return candles
      .filter((c) => c && typeof c.time === 'number' && !isNaN(c.close) && c.close > 0)
      .map((c) => {
        // Enforce seconds UTC (if ms timestamp > 1e11, convert to seconds)
        const time = c.time > 1e11 ? Math.floor(c.time / 1000) : c.time;
        const open = c.open || c.close;
        const close = c.close;
        const high = Math.max(open, close, c.high || c.close);
        const low = Math.min(open, close, c.low || c.close);

        return {
          time,
          open,
          high,
          low,
          close,
          volume: Math.max(0, c.volume || 0),
          source: c.source,
        };
      })
      .sort((a, b) => a.time - b.time);
  }
}

export const marketService = new MarketDataService();
