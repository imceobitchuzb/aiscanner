import { Asset, Candle, Timeframe } from '../types';
import { DEFAULT_ASSETS, DemoMarketDataProvider } from './demoProvider';

export class ClientMarketProvider {
  private fallback = new DemoMarketDataProvider();

  async getWatchlist(): Promise<Asset[]> {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      return Array.isArray(data) ? data : DEFAULT_ASSETS;
    } catch {
      return DEFAULT_ASSETS;
    }
  }

  async getAsset(symbol: string): Promise<Asset> {
    try {
      const res = await fetch(`/api/market?symbol=${symbol.toUpperCase()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('API asset fetch failed');
      return await res.json();
    } catch {
      return this.fallback.getAsset(symbol);
    }
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 120): Promise<Candle[]> {
    try {
      const res = await fetch(`/api/candles?symbol=${symbol.toUpperCase()}&timeframe=${timeframe}&limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('API candle fetch failed');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      return this.fallback.getCandles(symbol, timeframe, limit);
    } catch {
      return this.fallback.getCandles(symbol, timeframe, limit);
    }
  }
}

export const clientMarketProvider = new ClientMarketProvider();
