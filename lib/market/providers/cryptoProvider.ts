import { getAssetMetadata } from '../assetMetadata';
import { CandleWithProvenance, FreshnessState, ProviderHealth, QuoteWithProvenance, Timeframe } from '../types';
import { IMarketDataProvider } from './base';

export class CryptoMarketDataProvider implements IMarketDataProvider {
  id = 'BINANCE_SPOT';
  name = 'Binance Spot REST & WebSocket';
  private errorCount = 0;
  private lastPing = new Date().toISOString();

  isSupported(symbol: string): boolean {
    const meta = getAssetMetadata(symbol);
    return meta.category === 'CRYPTO';
  }

  private tfToBinance(tf: Timeframe): string {
    switch (tf) {
      case '1m': return '1m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '30m': return '30m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1D': return '1d';
      case '1W': return '1w';
      default: return '1h';
    }
  }

  async getQuote(symbol: string): Promise<QuoteWithProvenance> {
    const meta = getAssetMetadata(symbol);
    const upper = meta.symbol;
    const startMs = Date.now();

    try {
      const [tickerRes, bookRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upper}`, {
          next: { revalidate: 3 },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${upper}`, {
          next: { revalidate: 3 },
          signal: AbortSignal.timeout(5000),
        }),
      ]);

      if (!tickerRes.ok) throw new Error(`Binance ticker HTTP ${tickerRes.status}`);

      const tickerData = await tickerRes.json();
      let bid = parseFloat(tickerData.lastPrice);
      let ask = parseFloat(tickerData.lastPrice);

      if (bookRes.ok) {
        const bookData = await bookRes.json();
        bid = parseFloat(bookData.bidPrice) || bid;
        ask = parseFloat(bookData.askPrice) || ask;
      }

      const latencyMs = Date.now() - startMs;
      const lastPrice = parseFloat(tickerData.lastPrice);
      const change24h = parseFloat(tickerData.priceChangePercent);
      const high24h = parseFloat(tickerData.highPrice);
      const low24h = parseFloat(tickerData.lowPrice);
      const quoteVol = parseFloat(tickerData.quoteVolume);
      const closeTimeSec = Math.floor(Number(tickerData.closeTime) / 1000);
      const spread = Math.max(0, ask - bid);
      const spreadPercent = lastPrice > 0 ? (spread / lastPrice) * 100 : 0;

      const nowSec = Math.floor(Date.now() / 1000);
      // Robust freshness: successfully received live response with low latency
      const freshness: FreshnessState = latencyMs < 2500 ? 'LIVE' : latencyMs < 10000 ? 'RECENT' : 'STALE';

      this.lastPing = new Date().toISOString();

      return {
        symbol: upper,
        name: meta.name,
        category: meta.category,
        price: lastPrice,
        change24h: Math.round(change24h * 100) / 100,
        high24h,
        low24h,
        volume24h: quoteVol >= 1e9 ? `$${(quoteVol / 1e9).toFixed(2)}B` : `$${(quoteVol / 1e6).toFixed(1)}M`,
        bid,
        ask,
        spread: Math.round(spread * 10000) / 10000,
        spreadPercent: Math.round(spreadPercent * 10000) / 10000,
        timestamp: closeTimeSec || nowSec,
        isoTimestamp: new Date((closeTimeSec || nowSec) * 1000).toISOString(),
        source: 'BINANCE_SPOT',
        latencyMs,
        marketStatus: 'OPEN',
        freshness,
        isLive: freshness === 'LIVE' || freshness === 'RECENT',
        volatility: Math.abs(change24h) * 0.75 + 1.8,
        regime: change24h > 1.5 ? 'TRENDING_BULL' : change24h < -1.5 ? 'TRENDING_BEAR' : 'RANGE',
        signalState: change24h > 1.0 ? 'LONG' : change24h < -1.0 ? 'SHORT' : 'NEUTRAL',
      };
    } catch (err) {
      this.errorCount++;
      throw new Error(`[CryptoMarketDataProvider] Failed to fetch quote for ${upper}: ${(err as Error).message}`);
    }
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 120): Promise<CandleWithProvenance[]> {
    const meta = getAssetMetadata(symbol);
    const upper = meta.symbol;
    const interval = this.tfToBinance(timeframe);

    try {
      let allKlines: (string | number)[][] = [];
      let endTimeParam = '';
      const targetLimit = Math.min(3000, Math.max(10, limit));

      while (allKlines.length < targetLimit) {
        const batchLimit = Math.min(1000, targetLimit - allKlines.length);
        const url = `https://api.binance.com/api/v3/klines?symbol=${upper}&interval=${interval}&limit=${batchLimit}${endTimeParam}`;
        const res = await fetch(url, {
          next: { revalidate: 5 },
          signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) break;
        const rawData: (string | number)[][] = await res.json();
        if (!rawData || rawData.length === 0) break;

        // Prepend earlier batch to maintain chronological order
        allKlines = [...rawData, ...allKlines];
        if (rawData.length < batchLimit || allKlines.length >= targetLimit) break;

        const earliestOpenTime = Number(rawData[0][0]);
        endTimeParam = `&endTime=${earliestOpenTime - 1}`;
      }

      // Deduplicate and sort ascending by timestamp
      const uniqueMap = new Map<number, CandleWithProvenance>();
      for (const k of allKlines) {
        const timeSec = Math.floor(Number(k[0]) / 1000);
        if (!uniqueMap.has(timeSec)) {
          uniqueMap.set(timeSec, {
            time: timeSec,
            open: parseFloat(k[1] as string),
            high: parseFloat(k[2] as string),
            low: parseFloat(k[3] as string),
            close: parseFloat(k[4] as string),
            volume: parseFloat(k[5] as string),
            source: 'BINANCE_SPOT',
          });
        }
      }

      const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
      return sorted.slice(-targetLimit);
    } catch (err) {
      this.errorCount++;
      throw new Error(`[CryptoMarketDataProvider] Failed to fetch candles for ${upper}: ${(err as Error).message}`);
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      providerId: this.id,
      name: this.name,
      category: 'CRYPTO',
      status: this.errorCount > 5 ? 'DEGRADED' : 'ONLINE',
      latencyMs: 120,
      lastSuccessfulPing: this.lastPing,
      errorCount: this.errorCount,
    };
  }
}
