import { Asset, Candle, NewsItem, Timeframe } from '../types';

export interface IMarketDataProvider {
  name: string;
  isLive: boolean;
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
  getAsset(symbol: string): Promise<Asset>;
  getWatchlist(): Promise<Asset[]>;
}

export interface INewsProvider {
  getLatestNews(symbol?: string): Promise<NewsItem[]>;
}
