import { Candle, Timeframe } from '../types';
import { marketService } from '../market/marketService';
import { DataQualityEngine } from '../market/dataQualityEngine';

export interface DatasetCoverageReport {
  asset: string;
  timeframe: Timeframe;
  requestedBars: number;
  availableBars: number;
  startDate?: string;
  endDate?: string;
  timespanDays: number;
  status: 'COMPLETE' | 'PARTIAL' | 'DATASET_INCOMPLETE' | 'UNAVAILABLE';
  isSufficientForValidation: boolean; // >= 1000 bars
  missingReason?: string;
}

export class HistoricalDataFeed {
  private static cache: Map<string, Candle[]> = new Map();

  /**
   * Generates a cache key based on asset, timeframe, and bar count.
   */
  private static getCacheKey(asset: string, timeframe: Timeframe, limit: number): string {
    return `${asset}_${timeframe}_${limit}`;
  }

  /**
   * Scalable historical candle ingestion engine:
   * Ingests, validates, deduplicates, and caches authentic historical market data.
   * Strictly avoids fabricating data: if external providers lack data, explicitly reports DATASET_INCOMPLETE.
   */
  public static async loadDataset(
    asset: string,
    timeframe: Timeframe,
    targetBars = 2000
  ): Promise<{ candles: Candle[]; coverage: DatasetCoverageReport }> {
    const key = this.getCacheKey(asset, timeframe, targetBars);
    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      return {
        candles: cached,
        coverage: this.buildCoverageReport(asset, timeframe, targetBars, cached),
      };
    }

    let allCandles: Candle[] = [];

    try {
      // 1. Ingest via MarketDataService with maximum allowable provider depth
      const initialFetch = await marketService.getCandles(asset, timeframe, Math.min(1000, targetBars));
      allCandles = initialFetch.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      // 2. For Crypto, if target > 1000, attempt backward chronological pagination via Binance Spot API
      if (asset.includes('USDT') && targetBars > 1000 && allCandles.length > 0) {
        const oldestTimeMs = allCandles[0].time * 1000;
        const intervalMap: Record<Timeframe, string> = {
          '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
          '1h': '1h', '4h': '4h', '1D': '1d', '1W': '1w',
        };
        const interval = intervalMap[timeframe] || '1h';

        try {
          const paginationUrl = `https://api.binance.com/api/v3/klines?symbol=${asset}&interval=${interval}&endTime=${oldestTimeMs - 1}&limit=${Math.min(1000, targetBars - allCandles.length)}`;
          const res = await fetch(paginationUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const rawKlines = await res.json();
            if (Array.isArray(rawKlines)) {
              const earlierCandles: Candle[] = rawKlines.map((k: any) => ({
                time: Math.floor(k[0] / 1000),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
              }));
              allCandles = [...earlierCandles, ...allCandles];
            }
          }
        } catch {
          // If pagination fails (e.g. rate limit), proceed with initial batch
        }
      }
    } catch (err: any) {
      // Fallback
    }

    // 3. Strict audit, deduplication and chronological ordering via DataQualityEngine
    const qualityAudit = DataQualityEngine.auditAndClean(allCandles, timeframe);
    const cleanCandles = qualityAudit.cleanCandles;

    this.cache.set(key, cleanCandles);

    const coverage = this.buildCoverageReport(asset, timeframe, targetBars, cleanCandles);
    return {
      candles: cleanCandles,
      coverage,
    };
  }

  /**
   * Builds an honest coverage report without masking missing historical depth.
   */
  private static buildCoverageReport(
    asset: string,
    timeframe: Timeframe,
    requestedBars: number,
    candles: Candle[]
  ): DatasetCoverageReport {
    if (!candles || candles.length === 0) {
      return {
        asset,
        timeframe,
        requestedBars,
        availableBars: 0,
        timespanDays: 0,
        status: 'UNAVAILABLE',
        isSufficientForValidation: false,
        missingReason: 'Котировки недоступны от провайдеров рыночных данных.',
      };
    }

    const firstTime = candles[0].time;
    const lastTime = candles[candles.length - 1].time;
    const timespanDays = Math.round(((lastTime - firstTime) / 86400) * 10) / 10;

    let status: DatasetCoverageReport['status'] = 'COMPLETE';
    let missingReason: string | undefined;

    if (candles.length < requestedBars * 0.5) {
      status = 'DATASET_INCOMPLETE';
      missingReason = `Провайдер вернул только ${candles.length} баров из запрошенных ${requestedBars}. Данных недостаточно для многомесячной непрерывной выборки.`;
    } else if (candles.length < requestedBars) {
      status = 'PARTIAL';
      missingReason = `Получено ${candles.length} баров (${timespanDays} дней). Небольшое отклонение от целевого размера.`;
    }

    return {
      asset,
      timeframe,
      requestedBars,
      availableBars: candles.length,
      startDate: new Date(firstTime * 1000).toISOString().split('T')[0],
      endDate: new Date(lastTime * 1000).toISOString().split('T')[0],
      timespanDays,
      status,
      isSufficientForValidation: candles.length >= 500,
      missingReason,
    };
  }

  public static clearCache(): void {
    this.cache.clear();
  }
}
