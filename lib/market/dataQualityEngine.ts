import { Candle, Timeframe } from '../types';

export interface DataQualityReport {
  status: 'DATASET_VALID' | 'DATASET_INVALID';
  totalCandles: number;
  validCandlesCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
  ohlcViolationCount: number;
  timestampGapsCount: number;
  largestGapSeconds: number;
  expectedIntervalSeconds: number;
  coveragePercent: number; // (valid / totalExpected) * 100
  startTime: number;
  endTime: number;
  issues: string[];
  cleanCandles: Candle[];
}

export class DataQualityEngine {
  /**
   * Translates timeframe into expected duration in seconds.
   */
  public static getIntervalSeconds(tf: Timeframe): number {
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

  /**
   * Audits candle datasets for anomalies, gaps, duplicate timestamps, and OHLC violations.
   * Cleans and sorts valid candles chronologically.
   */
  public static auditAndClean(candles: Candle[], tf: Timeframe, is24_7 = true): DataQualityReport {
    if (!candles || candles.length === 0) {
      return {
        status: 'DATASET_INVALID',
        totalCandles: 0,
        validCandlesCount: 0,
        duplicateCount: 0,
        outOfOrderCount: 0,
        ohlcViolationCount: 0,
        timestampGapsCount: 0,
        largestGapSeconds: 0,
        expectedIntervalSeconds: this.getIntervalSeconds(tf),
        coveragePercent: 0,
        startTime: 0,
        endTime: 0,
        issues: ['Набор свечей пуст (0 элементов).'],
        cleanCandles: [],
      };
    }

    const intervalSec = this.getIntervalSeconds(tf);
    const issues: string[] = [];
    let duplicateCount = 0;
    let outOfOrderCount = 0;
    let ohlcViolationCount = 0;
    let timestampGapsCount = 0;
    let largestGapSeconds = 0;

    // 1. Initial sort to check ordering
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].time < candles[i - 1].time) {
        outOfOrderCount++;
      }
    }

    // Sort strictly ascending
    const sorted = [...candles].sort((a, b) => a.time - b.time);

    // 2. Deduplicate and filter OHLC violations
    const seenTimes = new Set<number>();
    const validCandles: Candle[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];

      // Duplicate check
      if (seenTimes.has(c.time)) {
        duplicateCount++;
        continue;
      }
      seenTimes.add(c.time);

      // OHLC sanity violations
      const hasOhlcViolation =
        c.high < c.low ||
        c.high < c.open ||
        c.high < c.close ||
        c.low > c.open ||
        c.low > c.close ||
        c.open <= 0 ||
        c.high <= 0 ||
        c.low <= 0 ||
        c.close <= 0 ||
        isNaN(c.open) ||
        isNaN(c.high) ||
        isNaN(c.low) ||
        isNaN(c.close);

      if (hasOhlcViolation) {
        ohlcViolationCount++;
        continue;
      }

      validCandles.push(c);
    }

    // 3. Gap Analysis
    // Allowed gap threshold: 2.5x interval (weekend gaps for 24/5 FX/Metals are expected and handled)
    const weekendSeconds = 48 * 3600;
    for (let i = 1; i < validCandles.length; i++) {
      const delta = validCandles[i].time - validCandles[i - 1].time;
      if (delta > intervalSec * 2.2) {
        // If not 24/7 and delta corresponds to weekend, don't penalize as corrupt data
        if (!is24_7 && delta <= weekendSeconds + intervalSec * 4) {
          // Valid weekend gap
        } else {
          timestampGapsCount++;
          if (delta > largestGapSeconds) {
            largestGapSeconds = delta;
          }
        }
      }
    }

    const startTime = validCandles.length > 0 ? validCandles[0].time : 0;
    const endTime = validCandles.length > 0 ? validCandles[validCandles.length - 1].time : 0;
    const totalSpanSeconds = Math.max(0, endTime - startTime);
    const expectedCandleCount = totalSpanSeconds > 0 ? Math.floor(totalSpanSeconds / intervalSec) + 1 : validCandles.length;
    const coveragePercent = expectedCandleCount > 0
      ? Math.min(100, Math.round((validCandles.length / expectedCandleCount) * 10000) / 100)
      : 100;

    if (duplicateCount > 0) issues.push(`Обнаружено ${duplicateCount} дубликатов свечей (устранены).`);
    if (outOfOrderCount > 0) issues.push(`Обнаружено ${outOfOrderCount} свечей с нарушением хронологии (отсортированы).`);
    if (ohlcViolationCount > 0) issues.push(`Обнаружено ${ohlcViolationCount} некорректных OHLC записей (отфильтрованы).`);
    if (timestampGapsCount > 0) issues.push(`Обнаружено ${timestampGapsCount} временных разрывов (макс. ${Math.round(largestGapSeconds / 3600)}ч).`);

    // Dataset Validity: if OHLC violations exist, coverage < 80%, or invalid ratio > 15% -> DATASET_INVALID
    const totalInput = candles.length;
    const invalidRatio = totalInput > 0 ? (ohlcViolationCount + duplicateCount) / totalInput : 1;
    const isCorrupt = ohlcViolationCount > 0 || coveragePercent < 80 || invalidRatio > 0.15 || validCandles.length < 30;

    const status: DataQualityReport['status'] = isCorrupt ? 'DATASET_INVALID' : 'DATASET_VALID';
    if (isCorrupt) {
      issues.unshift('Датасет повреждён или содержит критический процент аномалий (> 25%).');
    }

    return {
      status,
      totalCandles: totalInput,
      validCandlesCount: validCandles.length,
      duplicateCount,
      outOfOrderCount,
      ohlcViolationCount,
      timestampGapsCount,
      largestGapSeconds,
      expectedIntervalSeconds: intervalSec,
      coveragePercent,
      startTime,
      endTime,
      issues,
      cleanCandles: validCandles,
    };
  }
}
