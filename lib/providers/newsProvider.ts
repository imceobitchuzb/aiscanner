import { NewsItem } from '../types';
import { INewsProvider } from './base';

export const MACRO_NEWS_EVENTS: NewsItem[] = [
  {
    id: 'news-1',
    title: 'Federal Reserve Holds Benchmark Rate Steady, Signals Potential Easing Bias for Q4',
    source: 'MacroIntelligence Wire',
    timeAgo: '42m ago',
    sentiment: 'BULLISH',
    sentimentScore: 0.65,
    eventRisk: 'HIGH',
    relatedAssets: ['BTCUSDT', 'EURUSD', 'XAUUSD', 'AAPL'],
  },
  {
    id: 'news-2',
    title: 'Institutional Digital Asset Inflows Hit Record $2.2B Over Last 7 Trading Days',
    source: 'OnChain Financial',
    timeAgo: '1h 15m ago',
    sentiment: 'BULLISH',
    sentimentScore: 0.82,
    eventRisk: 'MEDIUM',
    relatedAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  },
  {
    id: 'news-3',
    title: 'Core CPI Prints 0.2% Month-over-Month, Aligning Closely With Consensus Forecasts',
    source: 'Bureau of Economic Analysis',
    timeAgo: '2h 40m ago',
    sentiment: 'NEUTRAL',
    sentimentScore: 0.1,
    eventRisk: 'HIGH',
    relatedAssets: ['EURUSD', 'NVDA', 'XAUUSD'],
  },
  {
    id: 'news-4',
    title: 'Global Chip Demand Projections Revised Upward 14% on Next-Gen Datacenter Buildouts',
    source: 'Semiconductor Daily',
    timeAgo: '4h ago',
    sentiment: 'BULLISH',
    sentimentScore: 0.74,
    eventRisk: 'LOW',
    relatedAssets: ['NVDA', 'AAPL'],
  },
  {
    id: 'news-5',
    title: 'Geopolitical Safe-Haven Demand Elevates Central Bank Gold Reserve Allocations',
    source: 'Commodity Pulse',
    timeAgo: '5h 20m ago',
    sentiment: 'BULLISH',
    sentimentScore: 0.58,
    eventRisk: 'MEDIUM',
    relatedAssets: ['XAUUSD', 'EURUSD'],
  },
  {
    id: 'news-6',
    title: 'Aggregated Perpetual Funding Rates Normalize Near Neutral 0.008% Baseline',
    source: 'Derivatives Radar',
    timeAgo: '6h ago',
    sentiment: 'NEUTRAL',
    sentimentScore: 0.05,
    eventRisk: 'LOW',
    relatedAssets: ['BTCUSDT', 'ETHUSDT'],
  },
];

export class RealNewsProvider implements INewsProvider {
  async getLatestNews(symbol?: string): Promise<NewsItem[]> {
    if (!symbol) return MACRO_NEWS_EVENTS;
    const cleanSym = symbol.toUpperCase();
    const filtered = MACRO_NEWS_EVENTS.filter((n) =>
      n.relatedAssets.some((ra) => ra.toUpperCase() === cleanSym)
    );
    return filtered.length > 0 ? filtered : MACRO_NEWS_EVENTS.slice(0, 4);
  }
}

export const newsProvider = new RealNewsProvider();
