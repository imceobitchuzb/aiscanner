export type AssetCategory = 'CRYPTO' | 'FOREX' | 'METALS' | 'EQUITIES' | 'COMMODITIES' | 'INDICES';

export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'HALTED';

export type FreshnessState = 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W';

export interface AssetMetadata {
  symbol: string;
  name: string;
  category: AssetCategory;
  baseCurrency: string;
  quoteCurrency: string;
  priceDecimals: number;
  quantityDecimals: number;
  tickSize: number;
  exchange: string;
  tradingHours: '24/7' | '24/5' | 'US_EQUITIES';
  primaryProvider: 'BINANCE' | 'GOLD_API' | 'COMEX' | 'FRANKFURTER' | 'YAHOO_EQUITIES';
  backupProvider?: string;
  streamType: 'WEBSOCKET' | 'POLLING_REST';
  streamEndpoint?: string;
  description: string;
}

export interface QuoteWithProvenance {
  symbol: string;
  name: string;
  category: AssetCategory;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;
  timestamp: number; // Unix timestamp in seconds
  isoTimestamp: string;
  source: string;
  latencyMs: number;
  marketStatus: MarketStatus;
  freshness: FreshnessState;
  isLive: boolean;
  volatility?: number;
  regime?: string;
  signalState?: 'LONG' | 'SHORT' | 'NEUTRAL';
}

export interface CandleWithProvenance {
  time: number; // Unix timestamp in seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source?: string;
}

export interface ProviderHealth {
  providerId: string;
  name: string;
  category: AssetCategory;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  lastSuccessfulPing: string;
  errorCount: number;
}
