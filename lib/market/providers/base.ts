import { CandleWithProvenance, ProviderHealth, QuoteWithProvenance, Timeframe } from '../types';

export interface IMarketDataProvider {
  id: string;
  name: string;
  isSupported(symbol: string): boolean;
  getQuote(symbol: string): Promise<QuoteWithProvenance>;
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<CandleWithProvenance[]>;
  getHealth(): Promise<ProviderHealth>;
}
