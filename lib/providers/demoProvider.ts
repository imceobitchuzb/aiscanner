import { Asset, Candle, Timeframe } from '../types';
import { IMarketDataProvider } from './base';

export const DEFAULT_ASSETS: Asset[] = [
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether USD',
    category: 'CRYPTO',
    price: 84345.25,
    change24h: 0.47,
    high24h: 85200.00,
    low24h: 83650.00,
    volume24h: '$38.2B',
    volatility: 2.8,
    regime: 'TRENDING_BULL',
    signalState: 'LONG',
    isLiveSupported: true,
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum / Tether USD',
    category: 'CRYPTO',
    price: 2690.15,
    change24h: 0.15,
    high24h: 2740.00,
    low24h: 2660.00,
    volume24h: '$16.5B',
    volatility: 3.2,
    regime: 'TRENDING_BULL',
    signalState: 'LONG',
    isLiveSupported: true,
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana / Tether USD',
    category: 'CRYPTO',
    price: 121.75,
    change24h: -0.12,
    high24h: 124.50,
    low24h: 119.80,
    volume24h: '$4.2B',
    volatility: 4.1,
    regime: 'RANGE',
    signalState: 'NEUTRAL',
    isLiveSupported: true,
  },
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'FOREX',
    price: 1.0825,
    change24h: -0.18,
    high24h: 1.0860,
    low24h: 1.0810,
    volume24h: '$120.4B',
    volatility: 0.5,
    regime: 'RANGE',
    signalState: 'NEUTRAL',
    isLiveSupported: true,
  },
  {
    symbol: 'XAUUSD',
    name: 'Spot Gold / US Dollar (Золото)',
    category: 'METALS',
    price: 4285.50,
    change24h: 0.85,
    high24h: 4312.00,
    low24h: 4268.00,
    volume24h: '$36.5B',
    volatility: 1.2,
    regime: 'ACCUMULATION',
    signalState: 'LONG',
    isLiveSupported: true,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    category: 'EQUITIES',
    price: 124.50,
    change24h: 2.35,
    high24h: 126.80,
    low24h: 121.90,
    volume24h: '$28.1B',
    volatility: 3.8,
    regime: 'TRENDING_BULL',
    signalState: 'LONG',
    isLiveSupported: true,
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'EQUITIES',
    price: 228.40,
    change24h: 0.45,
    high24h: 230.10,
    low24h: 226.50,
    volume24h: '$11.2B',
    volatility: 1.6,
    regime: 'RANGE',
    signalState: 'NEUTRAL',
    isLiveSupported: true,
  },
];

export class DemoMarketDataProvider implements IMarketDataProvider {
  name = 'Deterministic Baseline Simulation';
  isLive = false;

  async getWatchlist(): Promise<Asset[]> {
    return DEFAULT_ASSETS;
  }

  async getAsset(symbol: string): Promise<Asset> {
    const match = DEFAULT_ASSETS.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
    if (match) return match;

    return {
      symbol: symbol.toUpperCase(),
      name: `${symbol.toUpperCase()} Asset`,
      category: 'CRYPTO',
      price: 100.0,
      change24h: 0.5,
      high24h: 102.5,
      low24h: 98.5,
      volume24h: '$1.0B',
      volatility: 2.5,
      regime: 'RANGE',
      signalState: 'NEUTRAL',
      isLiveSupported: false,
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 120): Promise<Candle[]> {
    const asset = await this.getAsset(symbol);
    const basePrice = asset.price;
    const intervalSeconds = this.timeframeToSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - limit * intervalSeconds;

    const candles: Candle[] = [];
    let currentPrice = basePrice * 0.94;
    const volatilityStep = (asset.volatility / 100) * 0.35;
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 42);

    for (let i = 0; i < limit; i++) {
      const time = startTime + i * intervalSeconds;
      const cyclical = Math.sin((i / 14) + (seed % 10)) * volatilityStep * 0.5;
      const drift = 0.0006;
      const randomNoise = (Math.sin(i * 1.7 + seed) * 0.5 + Math.cos(i * 2.3) * 0.5) * volatilityStep;

      const changePct = drift + cyclical + randomNoise;
      const open = currentPrice;
      const close = currentPrice * (1 + changePct);
      const high = Math.max(open, close) * (1 + Math.abs(Math.sin(i * 3.1) * volatilityStep * 0.5));
      const low = Math.min(open, close) * (1 - Math.abs(Math.cos(i * 2.7) * volatilityStep * 0.5));
      const volume = Math.floor(1500 + Math.abs(Math.sin(i * 0.8) * 10000));

      candles.push({
        time,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
      });

      currentPrice = close;
    }

    const scaleFactor = basePrice / candles[candles.length - 1].close;
    return candles.map((c) => ({
      ...c,
      open: Math.round(c.open * scaleFactor * 100) / 100,
      high: Math.round(c.high * scaleFactor * 100) / 100,
      low: Math.round(c.low * scaleFactor * 100) / 100,
      close: Math.round(c.close * scaleFactor * 100) / 100,
    }));
  }

  private timeframeToSeconds(tf: Timeframe): number {
    switch (tf) {
      case '1m': return 60;
      case '5m': return 300;
      case '15m': return 900;
      case '30m': return 1800;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1D': return 86400;
      case '1W': return 604800;
      default: return 3600;
    }
  }
}
