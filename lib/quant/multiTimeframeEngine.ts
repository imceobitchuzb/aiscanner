import { Candle, Timeframe } from '../types';
import { QuantFeatureEngine } from './featureEngine';
import { MarketStructureEngine } from './marketStructureEngine';

export interface TimeframeAnalysisRow {
  timeframe: string;
  weight: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  structure: 'BULLISH' | 'BEARISH' | 'RANGE' | 'UNCERTAIN';
  volatility: 'COMPRESSION' | 'NORMAL' | 'EXPANSION';
  emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
}

export interface DetailedMTFAnalysis {
  anchorTimeframe: Timeframe;
  rows: TimeframeAnalysisRow[];
  alignmentScore: number; // 0 - 100% computed mathematically from weights
  dominantBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bullishWeight: number;
  bearishWeight: number;
  totalWeight: number;
  conflicts: string[];
  synthesis: string;
}

export class MultiTimeframeEngine {
  /**
   * Returns standard multi-timeframe hierarchy context for any given timeframe.
   */
  public static getHierarchy(tf: Timeframe): { timeframes: string[]; weights: number[] } {
    switch (tf) {
      case '1m':
      case '5m':
        return { timeframes: ['1m', '5m', '15m', '1h'], weights: [1, 1.5, 2, 3] };
      case '15m':
      case '30m':
        return { timeframes: ['5m', '15m', '1h', '4h'], weights: [1, 2, 3, 4] };
      case '1h':
        return { timeframes: ['15m', '1h', '4h', '1D'], weights: [1.5, 2.5, 3.5, 4.5] };
      case '4h':
        return { timeframes: ['1h', '4h', '1D', '1W'], weights: [2, 3, 4, 5] };
      case '1D':
      case '1W':
        return { timeframes: ['4h', '1D', '1W'], weights: [2.5, 4, 5] };
      default:
        return { timeframes: ['15m', '1h', '4h', '1D'], weights: [1.5, 2.5, 3.5, 4.5] };
    }
  }

  /**
   * Resamples / aggregates candles into higher timeframe bars.
   */
  public static aggregateCandles(candles: Candle[], factor: number): Candle[] {
    if (factor <= 1 || candles.length === 0) return candles;

    const aggregated: Candle[] = [];
    for (let i = 0; i < candles.length; i += factor) {
      const slice = candles.slice(i, i + factor);
      if (slice.length === 0) continue;

      const open = slice[0].open;
      const close = slice[slice.length - 1].close;
      const high = Math.max(...slice.map((c) => c.high));
      const low = Math.min(...slice.map((c) => c.low));
      const volume = slice.reduce((s, c) => s + c.volume, 0);
      const time = slice[0].time;

      aggregated.push({ time, open, high, low, close, volume });
    }
    return aggregated;
  }

  /**
   * Evaluates trend, momentum, and structure across timeframes and computes real alignment %.
   */
  public static analyze(
    currentCandles: Candle[],
    anchorTimeframe: Timeframe = '1h'
  ): DetailedMTFAnalysis {
    if (!currentCandles || currentCandles.length < 10) {
      return {
        anchorTimeframe,
        rows: [],
        alignmentScore: 0,
        dominantBias: 'NEUTRAL',
        bullishWeight: 0,
        bearishWeight: 0,
        totalWeight: 0,
        conflicts: ['Insufficient historical bars for multi-timeframe synchronization.'],
        synthesis: 'MTF alignment unavailable due to sparse candle series.',
      };
    }

    const { timeframes, weights } = this.getHierarchy(anchorTimeframe);
    const rows: TimeframeAnalysisRow[] = [];

    let totalWeight = 0;
    let bullishWeight = 0;
    let bearishWeight = 0;

    // Resampling multipliers relative to anchor
    const resampleMultipliers: Record<string, number> = {
      '1m': 1,
      '5m': 2,
      '15m': 3,
      '1h': 4,
      '4h': 8,
      '1D': 16,
      '1W': 32,
    };

    timeframes.forEach((tfName, idx) => {
      const weight = weights[idx] || 1;
      totalWeight += weight;

      // Extract features for this scale
      const mult = resampleMultipliers[tfName] || 1;
      const scaledCandles = mult > 1 ? this.aggregateCandles(currentCandles, mult) : currentCandles;
      const feat = QuantFeatureEngine.extractFeatures(scaledCandles);
      const struct = MarketStructureEngine.analyze(scaledCandles);

      if (!feat) {
        rows.push({
          timeframe: tfName,
          weight,
          trend: 'NEUTRAL',
          momentum: 'WEAK',
          structure: 'UNCERTAIN',
          volatility: 'NORMAL',
          emaAlignment: 'NEUTRAL',
          rsi: 50,
        });
        return;
      }

      // Trend decision
      let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      let emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

      if (feat.price > feat.ema20 && feat.ema20 > feat.ema50) {
        emaAlignment = 'BULLISH';
      } else if (feat.price < feat.ema20 && feat.ema20 < feat.ema50) {
        emaAlignment = 'BEARISH';
      }

      if (emaAlignment === 'BULLISH' && feat.trendSlope > 0) {
        trend = 'BULLISH';
        bullishWeight += weight;
      } else if (emaAlignment === 'BEARISH' && feat.trendSlope < 0) {
        trend = 'BEARISH';
        bearishWeight += weight;
      } else {
        trend = 'NEUTRAL';
      }

      // Momentum
      let momentum: 'STRONG' | 'MODERATE' | 'WEAK' = 'MODERATE';
      if (feat.adx.adx14 >= 25 && Math.abs(feat.momentum10) > 2.0) {
        momentum = 'STRONG';
      } else if (feat.adx.adx14 < 18 && Math.abs(feat.momentum10) < 0.5) {
        momentum = 'WEAK';
      }

      // Volatility
      let volatility: 'COMPRESSION' | 'NORMAL' | 'EXPANSION' = 'NORMAL';
      if (feat.bollinger.bandwidth > 5.0 || feat.atrPercent > 2.5) {
        volatility = 'EXPANSION';
      } else if (feat.bollinger.bandwidth < 1.8) {
        volatility = 'COMPRESSION';
      }

      // Structure tag
      const structure = struct.state === 'BULLISH_STRUCTURE' || struct.state === 'BREAKOUT'
        ? 'BULLISH'
        : struct.state === 'BEARISH_STRUCTURE' || struct.state === 'BREAKDOWN'
        ? 'BEARISH'
        : struct.state === 'RANGE'
        ? 'RANGE'
        : 'UNCERTAIN';

      rows.push({
        timeframe: tfName,
        weight,
        trend,
        momentum,
        structure,
        volatility,
        emaAlignment,
        rsi: feat.rsi14,
      });
    });

    const dominantBias = bullishWeight > bearishWeight ? 'BULLISH' : bearishWeight > bullishWeight ? 'BEARISH' : 'NEUTRAL';
    const dominantWeight = Math.max(bullishWeight, bearishWeight);
    const alignmentScore = totalWeight > 0 ? Math.round((dominantWeight / totalWeight) * 100) : 0;

    // Detect structural conflicts
    const conflicts: string[] = [];
    const lowerRows = rows.slice(0, Math.ceil(rows.length / 2));
    const higherRows = rows.slice(Math.ceil(rows.length / 2));

    const lowerBullish = lowerRows.filter((r) => r.trend === 'BULLISH').length;
    const lowerBearish = lowerRows.filter((r) => r.trend === 'BEARISH').length;
    const higherBullish = higherRows.filter((r) => r.trend === 'BULLISH').length;
    const higherBearish = higherRows.filter((r) => r.trend === 'BEARISH').length;

    if (lowerBullish > 0 && higherBearish > 0) {
      conflicts.push('Конфликт ТФ: Младшие таймфреймы показывают восходящий отскок прямо в нисходящее сопротивление старших ТФ.');
    }
    if (lowerBearish > 0 && higherBullish > 0) {
      conflicts.push('Конфликт ТФ: Младший локальный откат против подтверждённого восходящего тренда старших ТФ.');
    }

    const synthesis =
      alignmentScore >= 75
        ? `Высокая синхронизация ТФ (${alignmentScore}% ${dominantBias}): институциональный тренд подтверждён.`
        : alignmentScore >= 50
        ? `Умеренное согласие ТФ (${alignmentScore}%): присутствуют разнонаправленные импульсы.`
        : `Конфликтный рынок (${alignmentScore}%): отсутствие единого направленного согласия между горизонтами.`;

    return {
      anchorTimeframe,
      rows,
      alignmentScore,
      dominantBias,
      bullishWeight: Math.round(bullishWeight * 10) / 10,
      bearishWeight: Math.round(bearishWeight * 10) / 10,
      totalWeight: Math.round(totalWeight * 10) / 10,
      conflicts,
      synthesis,
    };
  }
}
