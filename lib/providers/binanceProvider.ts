import { Asset, Candle, Timeframe } from '../types';
import { IMarketDataProvider } from './base';
import { DEFAULT_ASSETS, DemoMarketDataProvider } from './demoProvider';

export class LiveMarketDataProvider implements IMarketDataProvider {
  name = 'Binance Public REST API';
  isLive = true;
  private demoFallback = new DemoMarketDataProvider();

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

  async getWatchlist(): Promise<Asset[]> {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
        next: { revalidate: 15 },
      });
      if (!res.ok) throw new Error('Binance ticker request failed');
      const data = await res.json();

      return DEFAULT_ASSETS.map((asset) => {
        if (!asset.isLiveSupported) return asset;
        const match = data.find((d: { symbol: string }) => d.symbol === asset.symbol);
        if (!match) return asset;

        const price = parseFloat(match.lastPrice);
        const change = parseFloat(match.priceChangePercent);
        const high = parseFloat(match.highPrice);
        const low = parseFloat(match.lowPrice);
        const quoteVol = parseFloat(match.quoteVolume);

        return {
          ...asset,
          price,
          change24h: Math.round(change * 100) / 100,
          high24h: high,
          low24h: low,
          volume24h: quoteVol > 1e9 ? `$${(quoteVol / 1e9).toFixed(1)}B` : `$${(quoteVol / 1e6).toFixed(1)}M`,
        };
      });
    } catch {
      return this.demoFallback.getWatchlist();
    }
  }

  async getAsset(symbol: string): Promise<Asset> {
    const defaultMeta = DEFAULT_ASSETS.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
    if (defaultMeta && !defaultMeta.isLiveSupported) {
      return defaultMeta;
    }

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`, {
        next: { revalidate: 10 },
      });
      if (!res.ok) throw new Error('Live ticker fetch failed');
      const data = await res.json();

      const price = parseFloat(data.lastPrice);
      const change = parseFloat(data.priceChangePercent);
      const high = parseFloat(data.highPrice);
      const low = parseFloat(data.lowPrice);
      const quoteVol = parseFloat(data.quoteVolume);

      return {
        symbol: symbol.toUpperCase(),
        name: defaultMeta?.name || `${symbol.toUpperCase()} Perpetual / Spot`,
        category: 'CRYPTO',
        price,
        change24h: Math.round(change * 100) / 100,
        high24h: high,
        low24h: low,
        volume24h: quoteVol > 1e9 ? `$${(quoteVol / 1e9).toFixed(1)}B` : `$${(quoteVol / 1e6).toFixed(1)}M`,
        volatility: Math.abs(change) * 0.8 + 2.0,
        regime: change > 1.5 ? 'TRENDING_BULL' : change < -1.5 ? 'TRENDING_BEAR' : 'RANGE',
        signalState: change > 1.0 ? 'LONG' : change < -1.0 ? 'SHORT' : 'NEUTRAL',
        isLiveSupported: true,
      };
    } catch {
      return this.demoFallback.getAsset(symbol);
    }
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 120): Promise<Candle[]> {
    const isCrypto = symbol.toUpperCase().endsWith('USDT') || symbol.toUpperCase().endsWith('BTC');
    if (!isCrypto) {
      return this.demoFallback.getCandles(symbol, timeframe, limit);
    }

    try {
      const interval = this.tfToBinance(timeframe);
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url, { next: { revalidate: 10 } });
      if (!res.ok) throw new Error('Failed to fetch candles from Binance');
      const rawData = await res.json();

      return rawData.map((k: (string | number)[]) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
    } catch {
      return this.demoFallback.getCandles(symbol, timeframe, limit);
    }
  }
}

export const marketProvider = new LiveMarketDataProvider();
