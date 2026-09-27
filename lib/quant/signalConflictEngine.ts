import { QuantFeatures } from './featureEngine';
import { DetailedMarketStructure } from './marketStructureEngine';
import { DetailedMTFAnalysis } from './multiTimeframeEngine';
import { MarketRegimeState, Timeframe } from '../types';

export type ConflictSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface DetectedConflict {
  category: 'TREND' | 'MTF' | 'STRUCTURE' | 'MOMENTUM' | 'VOLATILITY' | 'LIQUIDITY' | 'RISK_REWARD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  mitigation: string;
  qualityPenalty: number;
}

export interface ConflictReport {
  overallLevel: ConflictSeverity;
  totalConflicts: number;
  conflicts: DetectedConflict[];
  totalQualityPenalty: number;
}

export class SignalConflictEngine {
  /**
   * Deterministically evaluates directional conflicts across all quantitative dimensions.
   * Ensures transparency: conflicts are disclosed directly rather than silently discarding valid opportunities.
   */
  public static evaluateConflicts(
    candidateDirection: 'LONG' | 'SHORT' | 'NEUTRAL',
    features: QuantFeatures,
    structure: DetailedMarketStructure,
    regime: MarketRegimeState,
    mtf: DetailedMTFAnalysis,
    timeframe: Timeframe,
    riskRewardRatio: number
  ): ConflictReport {
    if (candidateDirection === 'NEUTRAL') {
      return {
        overallLevel: 'NONE',
        totalConflicts: 0,
        conflicts: [],
        totalQualityPenalty: 0,
      };
    }

    const isLong = candidateDirection === 'LONG';
    const conflicts: DetectedConflict[] = [];

    // 1. Trend Conflict: Price vs EMA alignment / Slope
    if (isLong) {
      if (features.trendSlope < -0.15) {
        conflicts.push({
          category: 'TREND',
          severity: 'HIGH',
          title: 'Конфликт наклона тренда (Trend Slope)',
          description: `Покупка против нисходящего наклона EMA (${features.trendSlope.toFixed(2)}%/бар).`,
          mitigation: 'Уменьшить объём позиции на 30% или дождаться закругления EMA20 вверх.',
          qualityPenalty: 12,
        });
      } else if (features.price < features.ema50 && features.price > features.ema20) {
        conflicts.push({
          category: 'TREND',
          severity: 'LOW',
          title: 'Смешанный трендовый веер',
          description: 'Цена выше EMA20, но остаётся под сопротивлением 50-периодной средней.',
          mitigation: 'Использовать частичную фиксацию прибыли на уровне EMA50.',
          qualityPenalty: 4,
        });
      }
    } else {
      if (features.trendSlope > 0.15) {
        conflicts.push({
          category: 'TREND',
          severity: 'HIGH',
          title: 'Конфликт наклона тренда (Trend Slope)',
          description: `Продажа против восходящего наклона EMA (+${features.trendSlope.toFixed(2)}%/бар).`,
          mitigation: 'Уменьшить объём позиции на 30% или дождаться подтверждения слома структуры вниз.',
          qualityPenalty: 12,
        });
      } else if (features.price > features.ema50 && features.price < features.ema20) {
        conflicts.push({
          category: 'TREND',
          severity: 'LOW',
          title: 'Смешанный трендовый веер',
          description: 'Цена ниже EMA20, но сохраняется поддержка от EMA50 снизу.',
          mitigation: 'Контролировать реакцию цены на тесте EMA50.',
          qualityPenalty: 4,
        });
      }
    }

    // 2. MTF Conflict: Hierarchical alignment
    if (isLong) {
      if (mtf.dominantBias === 'BEARISH' && mtf.alignmentScore >= 70) {
        conflicts.push({
          category: 'MTF',
          severity: 'HIGH',
          title: 'Макро-конфликт старших таймфреймов (4H/1D Bearish)',
          description: 'Старший контекст (4H/1D) находится в подтверждённом нисходящем тренде.',
          mitigation: 'Рассматривать сделку как локальный контртрендовый отскок с консервативным TP1.',
          qualityPenalty: 14,
        });
      } else if (mtf.dominantBias === 'BEARISH') {
        conflicts.push({
          category: 'MTF',
          severity: 'MEDIUM',
          title: 'Умеренное расхождение таймфреймов',
          description: `Рабочий таймфрейм (${timeframe}) бычий, но старший тренд сохраняет нейтрально-медвежью структуру.`,
          mitigation: 'Переводить стоп-лосс в безубыток при достижении +1.0 R.',
          qualityPenalty: 8,
        });
      }
    } else {
      if (mtf.dominantBias === 'BULLISH' && mtf.alignmentScore >= 70) {
        conflicts.push({
          category: 'MTF',
          severity: 'HIGH',
          title: 'Макро-конфликт старших таймфреймов (4H/1D Bullish)',
          description: 'Старший контекст находится в сильном бычьем тренде.',
          mitigation: 'Шорт против макро-тренда: сократить риск на сделку до 0.5% депозита.',
          qualityPenalty: 14,
        });
      } else if (mtf.dominantBias === 'BULLISH') {
        conflicts.push({
          category: 'MTF',
          severity: 'MEDIUM',
          title: 'Умеренное расхождение таймфреймов',
          description: `Рабочий таймфрейм (${timeframe}) медвежий, но старший тренд бычий.`,
          mitigation: 'Ориентироваться на ближайшие локальные цели (TP1).',
          qualityPenalty: 8,
        });
      }
    }

    // 3. Structure Conflict: Proximity to Key Levels
    if (isLong) {
      if (structure.distanceToResistancePct < 0.6) {
        conflicts.push({
          category: 'STRUCTURE',
          severity: 'HIGH',
          title: 'Покупка в ключевой уровень сопротивления',
          description: `До зоны предложения всего ${structure.distanceToResistancePct.toFixed(2)}%, повышен риск отбоя вниз.`,
          mitigation: 'Дождаться уверенного закрытия свечи выше уровня сопротивления.',
          qualityPenalty: 10,
        });
      } else if (structure.distanceToResistancePct < 1.2) {
        conflicts.push({
          category: 'STRUCTURE',
          severity: 'LOW',
          title: 'Умеренная близость сопротивления',
          description: `До ближайшего сопротивления ${structure.distanceToResistancePct.toFixed(2)}%.`,
          mitigation: 'Убедиться, что первая цель (TP1) не превышает данный уровень.',
          qualityPenalty: 4,
        });
      }
    } else {
      if (structure.distanceToSupportPct < 0.6) {
        conflicts.push({
          category: 'STRUCTURE',
          severity: 'HIGH',
          title: 'Продажа в ключевой уровень поддержки',
          description: `До зоны спроса всего ${structure.distanceToSupportPct.toFixed(2)}%, повышен риск ложного пробоя.`,
          mitigation: 'Дождаться подтверждения закрепления цены под поддержкой.',
          qualityPenalty: 10,
        });
      } else if (structure.distanceToSupportPct < 1.2) {
        conflicts.push({
          category: 'STRUCTURE',
          severity: 'LOW',
          title: 'Умеренная близость поддержки',
          description: `До ближайшей зоны покупателей ${structure.distanceToSupportPct.toFixed(2)}%.`,
          mitigation: 'Убедиться, что TP1 расположен строго выше зоны поддержки.',
          qualityPenalty: 4,
        });
      }
    }

    // 4. Momentum Conflict: RSI & MACD divergence
    if (isLong) {
      if (features.rsi14 > 72) {
        conflicts.push({
          category: 'MOMENTUM',
          severity: 'MEDIUM',
          title: 'Перекупленность осциллятора (RSI > 72)',
          description: `RSI на уровне ${features.rsi14.toFixed(1)} указывает на кульминацию покупок.`,
          mitigation: 'Вход на откате к EMA20 предпочтительнее входа по рынку.',
          qualityPenalty: 7,
        });
      } else if (features.macd.histogram < 0 && features.trendSlope > 0) {
        conflicts.push({
          category: 'MOMENTUM',
          severity: 'LOW',
          title: 'Затухание импульса MACD',
          description: 'Гистограмма MACD отрицательна при восходящем уклоне цены.',
          mitigation: 'Ждать появления зелёного бара гистограммы.',
          qualityPenalty: 4,
        });
      }
    } else {
      if (features.rsi14 < 28) {
        conflicts.push({
          category: 'MOMENTUM',
          severity: 'MEDIUM',
          title: 'Перепроданность осциллятора (RSI < 28)',
          description: `RSI на уровне ${features.rsi14.toFixed(1)} сигнализирует о риске резкого шорт-сквиза.`,
          mitigation: 'Не шортить экстремальное дно, дождаться отката.',
          qualityPenalty: 7,
        });
      } else if (features.macd.histogram > 0 && features.trendSlope < 0) {
        conflicts.push({
          category: 'MOMENTUM',
          severity: 'LOW',
          title: 'Затухание импульса MACD',
          description: 'Гистограмма MACD положительна при нисходящем уклоне цены.',
          mitigation: 'Ждать появления красного бара гистограммы.',
          qualityPenalty: 4,
        });
      }
    }

    // 5. Volatility Conflict: ATR extremes
    if (features.atrPercent > 4.5) {
      conflicts.push({
        category: 'VOLATILITY',
        severity: 'MEDIUM',
        title: 'Повышенная турбулентность (ATR > 4.5%)',
        description: `Текущий размах свечей (${features.atrPercent.toFixed(2)}%) требует более широкого стоп-лосса.`,
        mitigation: 'Уменьшить размер позиции для сохранения нормативного риска в USD.',
        qualityPenalty: 6,
      });
    } else if (features.atrPercent < 0.3) {
      conflicts.push({
        category: 'VOLATILITY',
        severity: 'LOW',
        title: 'Сжатие волатильности (Low ATR)',
        description: `Рынок в узком канале (${features.atrPercent.toFixed(2)}%), вероятен ложный выход.`,
        mitigation: 'Ожидать всплеска объёма перед входом.',
        qualityPenalty: 3,
      });
    }

    // 6. Liquidity Conflict: Volume contraction
    if (features.volumeRatio < 0.65) {
      conflicts.push({
        category: 'LIQUIDITY',
        severity: 'LOW',
        title: 'Низкая торговая активность',
        description: `Объём текущего бара составляет лишь ${(features.volumeRatio * 100).toFixed(0)}% от среднего значения.`,
        mitigation: 'Исключить агрессивные рыночные заявки во избежание проскальзывания.',
        qualityPenalty: 4,
      });
    }

    // 7. Risk/Reward Conflict
    if (riskRewardRatio > 0 && riskRewardRatio < 1.4) {
      conflicts.push({
        category: 'RISK_REWARD',
        severity: 'HIGH',
        title: 'Неудовлетворительный профиль R:R',
        description: `Коэффициент риск/прибыль (${riskRewardRatio.toFixed(2)}) ниже нормативного институционального минимума 1.5.`,
        mitigation: 'Потребовать более далёкую цель или более плотный структурный стоп.',
        qualityPenalty: 12,
      });
    }

    // Aggregate overall conflict severity level
    const hasHigh = conflicts.some((c) => c.severity === 'HIGH');
    const mediumCount = conflicts.filter((c) => c.severity === 'MEDIUM').length;

    let overallLevel: ConflictSeverity = 'NONE';
    if (hasHigh || mediumCount >= 2) overallLevel = 'HIGH';
    else if (mediumCount === 1 || conflicts.length >= 3) overallLevel = 'MEDIUM';
    else if (conflicts.length > 0) overallLevel = 'LOW';

    const totalQualityPenalty = conflicts.reduce((s, c) => s + c.qualityPenalty, 0);

    return {
      overallLevel,
      totalConflicts: conflicts.length,
      conflicts,
      totalQualityPenalty,
    };
  }
}
