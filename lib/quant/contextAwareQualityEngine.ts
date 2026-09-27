import { QuantFeatures } from './featureEngine';
import { DetailedMarketStructure } from './marketStructureEngine';
import { DetailedMTFAnalysis } from './multiTimeframeEngine';
import { MarketRegimeState, Timeframe } from '../types';
import { FactorWeights, WeightProfile } from './weightProfiles';
import { ConflictReport } from './signalConflictEngine';

export interface FactorScoreItem {
  name: string;
  category: keyof FactorWeights;
  rawScore: number; // 0-100
  weight: number;   // e.g. 25
  weightedContribution: number; // (rawScore * weight) / 100
  explanation: string;
}

export interface ContextAwareQualityResult {
  overallQuality: number; // 0-100
  baseScore: number;
  penalties: number;
  factorScores: Record<keyof FactorWeights, FactorScoreItem>;
  dominantStrengths: string[];
  vulnerabilities: string[];
  summaryExplanation: string;
}

export class ContextAwareQualityEngine {
  /**
   * Computes normalized factor scores (0-100) and aggregates them dynamically
   * according to the market regime's WeightProfile.
   */
  public static evaluateQuality(
    direction: 'LONG' | 'SHORT',
    features: QuantFeatures,
    structure: DetailedMarketStructure,
    regime: MarketRegimeState,
    mtf: DetailedMTFAnalysis,
    timeframe: Timeframe,
    riskRewardRatio: number,
    weightProfile: WeightProfile,
    conflictReport: ConflictReport
  ): ContextAwareQualityResult {
    const isLong = direction === 'LONG';
    const weights = weightProfile.weights;

    // 1. Trend Score (0-100)
    let trendScore = 50;
    let trendReason = 'Трендовая динамика нейтральна.';
    if (isLong) {
      if (features.price > features.ema20 && features.ema20 > features.ema50 && features.trendSlope > 0) {
        trendScore = Math.min(100, Math.round(75 + features.trendSlope * 40));
        trendReason = `Уверенный бычий тренд: цена выше EMA20 > EMA50, наклон +${features.trendSlope.toFixed(2)}%/бар.`;
      } else if (features.price > features.ema20) {
        trendScore = 62;
        trendReason = 'Умеренный бычий наклон: цена закрепилась выше EMA20.';
      } else {
        trendScore = Math.max(10, Math.round(40 + features.trendSlope * 30));
        trendReason = 'Слабый тренд: цена ниже скользящих средних.';
      }
    } else {
      if (features.price < features.ema20 && features.ema20 < features.ema50 && features.trendSlope < 0) {
        trendScore = Math.min(100, Math.round(75 + Math.abs(features.trendSlope) * 40));
        trendReason = `Уверенный медвежий тренд: цена ниже EMA20 < EMA50, наклон ${features.trendSlope.toFixed(2)}%/бар.`;
      } else if (features.price < features.ema20) {
        trendScore = 62;
        trendReason = 'Умеренное давление продавцов: цена торгуется под EMA20.';
      } else {
        trendScore = Math.max(10, Math.round(40 - features.trendSlope * 30));
        trendReason = 'Слабый нисходящий тренд: цена выше локальных средних.';
      }
    }

    // 2. Structure Score (0-100)
    let structureScore = 50;
    let structureReason = 'Фрактальная структура не сформировала однозначного паттерна.';
    if (isLong) {
      if (structure.state === 'BREAKOUT') {
        structureScore = 90;
        structureReason = 'Импульсный пробой локального максимума: цена удерживается выше уровня пробоя.';
      } else if (structure.state === 'BULLISH_STRUCTURE') {
        structureScore = 80;
        structureReason = 'Бычья рыночная структура: последовательное обновление максимумов (Higher Highs) и минимумов.';
      } else if (structure.state === 'RANGE') {
        structureScore = structure.distanceToSupportPct < 1.0 ? 70 : 45;
        structureReason = `Боковой диапазон: тест поддержки (дистанция ${structure.distanceToSupportPct.toFixed(2)}%).`;
      } else {
        structureScore = 30;
        structureReason = 'Медвежья структура: повышенный риск продолжения падения.';
      }
    } else {
      if (structure.state === 'BREAKDOWN') {
        structureScore = 90;
        structureReason = 'Импульсный пробой ключевой поддержки вниз с закреплением.';
      } else if (structure.state === 'BEARISH_STRUCTURE') {
        structureScore = 80;
        structureReason = 'Медвежья структура: последовательное понижение минимумов и максимумов (Lower Lows/Highs).';
      } else if (structure.state === 'RANGE') {
        structureScore = structure.distanceToResistancePct < 1.0 ? 70 : 45;
        structureReason = `Боковой диапазон: тест сопротивления (дистанция ${structure.distanceToResistancePct.toFixed(2)}%).`;
      } else {
        structureScore = 30;
        structureReason = 'Бычья структура рынка препятствует короткой позиции.';
      }
    }

    // 3. Momentum Score (0-100)
    let momentumScore = 50;
    let momentumReason = 'Осцилляторы в нейтральной зоне.';
    if (isLong) {
      if (features.rsi14 >= 52 && features.rsi14 <= 68 && features.macd.histogram > 0) {
        momentumScore = 88;
        momentumReason = `Здоровый восходящий импульс (RSI: ${features.rsi14.toFixed(1)}, MACD Hist: +${features.macd.histogram.toFixed(2)}).`;
      } else if (features.rsi14 > 48 && features.adx.plusDI > features.adx.minusDI) {
        momentumScore = 70;
        momentumReason = `Преобладание покупателей (+DI: ${features.adx.plusDI.toFixed(1)} > -DI: ${features.adx.minusDI.toFixed(1)}).`;
      } else if (features.rsi14 > 72) {
        momentumScore = 40;
        momentumReason = `Риск кульминации покупок: RSI ${features.rsi14.toFixed(1)} в зоне перекупленности.`;
      } else {
        momentumScore = 35;
        momentumReason = `Слабый покупательский импульс (RSI: ${features.rsi14.toFixed(1)}).`;
      }
    } else {
      if (features.rsi14 <= 48 && features.rsi14 >= 32 && features.macd.histogram < 0) {
        momentumScore = 88;
        momentumReason = `Здоровый нисходящий импульс (RSI: ${features.rsi14.toFixed(1)}, MACD Hist: ${features.macd.histogram.toFixed(2)}).`;
      } else if (features.rsi14 < 52 && features.adx.minusDI > features.adx.plusDI) {
        momentumScore = 70;
        momentumReason = `Преобладание продавцов (-DI: ${features.adx.minusDI.toFixed(1)} > +DI: ${features.adx.plusDI.toFixed(1)}).`;
      } else if (features.rsi14 < 28) {
        momentumScore = 40;
        momentumReason = `Риск отскока: RSI ${features.rsi14.toFixed(1)} в зоне перепроданности.`;
      } else {
        momentumScore = 35;
        momentumReason = `Слабый импульс продавцов (RSI: ${features.rsi14.toFixed(1)}).`;
      }
    }

    // 4. Volume Score (0-100)
    let volumeScore = 50;
    let volumeReason = 'Торговый объём на среднестатистическом уровне.';
    if (features.volumeRatio >= 1.5) {
      volumeScore = 95;
      volumeReason = `Мощный всплеск объёма (${features.volumeRatio.toFixed(1)}x выше среднего значения).`;
    } else if (features.volumeRatio >= 1.15) {
      volumeScore = 78;
      volumeReason = `Повышенный объём подтверждает интерес участников (${features.volumeRatio.toFixed(1)}x).`;
    } else if (features.volumeRatio < 0.7) {
      volumeScore = 30;
      volumeReason = `Пониженный объём (${features.volumeRatio.toFixed(1)}x), нехватка ликвидности для пробоя.`;
    }

    // 5. Volatility Score (0-100)
    let volatilityScore = 60;
    let volatilityReason = 'Волатильность в нормальном рабочем диапазоне.';
    if (features.atrPercent >= 0.8 && features.atrPercent <= 3.2) {
      volatilityScore = 85;
      volatilityReason = `Оптимальная волатильность (ATR ${features.atrPercent.toFixed(2)}%): баланс потенциала хода и контролируемого риска.`;
    } else if (features.atrPercent > 4.5) {
      volatilityScore = 35;
      volatilityReason = `Экстремальный размах колебаний (ATR ${features.atrPercent.toFixed(2)}%): высокий риск резкого проскальзывания.`;
    } else if (features.atrPercent < 0.4) {
      volatilityScore = 45;
      volatilityReason = `Низкая волатильность (ATR ${features.atrPercent.toFixed(2)}%): возможен долгий дрейф без реализации движения.`;
    }

    // 6. MTF Score (0-100) — Hierarchical Alignment
    let mtfScore = 50;
    let mtfReason = 'Нейтральная синхронизация таймфреймов.';
    if (isLong) {
      if (mtf.dominantBias === 'BULLISH') {
        mtfScore = Math.max(65, Math.min(100, Math.round(mtf.alignmentScore)));
        mtfReason = `Синхронизация рабочих и старших таймфреймов на ${mtf.alignmentScore}% (Dominant Bias: BULLISH).`;
      } else if (mtf.dominantBias === 'BEARISH') {
        mtfScore = Math.max(20, Math.round(100 - mtf.alignmentScore));
        mtfReason = `Контртрендовый сетап: старшие таймфреймы направлены вниз (Alignment: ${mtf.alignmentScore}% Bearish).`;
      } else {
        mtfScore = 55;
        mtfReason = 'Старший контекст в боковике, локальный таймфрейм автономен.';
      }
    } else {
      if (mtf.dominantBias === 'BEARISH') {
        mtfScore = Math.max(65, Math.min(100, Math.round(mtf.alignmentScore)));
        mtfReason = `Синхронизация рабочих и старших таймфреймов на ${mtf.alignmentScore}% (Dominant Bias: BEARISH).`;
      } else if (mtf.dominantBias === 'BULLISH') {
        mtfScore = Math.max(20, Math.round(100 - mtf.alignmentScore));
        mtfReason = `Контртрендовый шорт: старший таймфрейм восходящий (Alignment: ${mtf.alignmentScore}% Bullish).`;
      } else {
        mtfScore = 55;
        mtfReason = 'Старший контекст нейтрален, локальное движение самостоятельно.';
      }
    }

    // 7. Support / Resistance Score (0-100)
    let srScore = 60;
    let srReason = 'Достаточный запас хода до ключевых ценовых преград.';
    if (isLong) {
      if (structure.distanceToResistancePct >= 2.0) {
        srScore = 90;
        srReason = `Широкий коридор хода: до ближайшего сопротивления ${structure.distanceToResistancePct.toFixed(2)}%.`;
      } else if (structure.distanceToResistancePct < 0.6) {
        srScore = 25;
        srReason = `Критическая близость преграды: до сопротивления всего ${structure.distanceToResistancePct.toFixed(2)}%.`;
      } else {
        srScore = 65;
        srReason = `Дистанция до уровня предложения составляет ${structure.distanceToResistancePct.toFixed(2)}%.`;
      }
    } else {
      if (structure.distanceToSupportPct >= 2.0) {
        srScore = 90;
        srReason = `Широкий простор для снижения: до поддержки ${structure.distanceToSupportPct.toFixed(2)}%.`;
      } else if (structure.distanceToSupportPct < 0.6) {
        srScore = 25;
        srReason = `Критическая близость поддержки: до зоны покупателей всего ${structure.distanceToSupportPct.toFixed(2)}%.`;
      } else {
        srScore = 65;
        srReason = `Дистанция до зоны спроса составляет ${structure.distanceToSupportPct.toFixed(2)}%.`;
      }
    }

    // 8. Liquidity Score (0-100)
    let liquidityScore = 65;
    let liquidityReason = 'Ликвидность достаточна для безыздержечного исполнения.';
    if (features.volumeRatio >= 1.0) {
      liquidityScore = 80;
      liquidityReason = 'Глубокий стакан и стабильный поток рыночных ордеров.';
    } else if (features.volumeRatio < 0.5) {
      liquidityScore = 35;
      liquidityReason = 'Тонкий рынок, повышен риск расширения спреда.';
    }

    // 9. Risk/Reward Score (0-100)
    let rrScore = 50;
    let rrReason = 'Коэффициент R:R соответствует базовым критериям.';
    if (riskRewardRatio >= 2.5) {
      rrScore = 95;
      rrReason = `Отличное математическое ожидание: потенциал R:R = ${riskRewardRatio.toFixed(2)}.`;
    } else if (riskRewardRatio >= 1.8) {
      rrScore = 80;
      rrReason = `Благоприятное соотношение риска к профиту: R:R = ${riskRewardRatio.toFixed(2)}.`;
    } else if (riskRewardRatio >= 1.5) {
      rrScore = 65;
      rrReason = `Приемлемый нормативный R:R = ${riskRewardRatio.toFixed(2)}.`;
    } else {
      rrScore = 25;
      rrReason = `Невыгодный R:R = ${riskRewardRatio.toFixed(2)} (ниже институционального порога 1.5).`;
    }

    // Compose factor score items
    const factorScores: Record<keyof FactorWeights, FactorScoreItem> = {
      trend: {
        name: 'Трендовая структура',
        category: 'trend',
        rawScore: trendScore,
        weight: weights.trend,
        weightedContribution: Math.round((trendScore * weights.trend) / 100 * 10) / 10,
        explanation: trendReason,
      },
      structure: {
        name: 'Фрактальные уровни',
        category: 'structure',
        rawScore: structureScore,
        weight: weights.structure,
        weightedContribution: Math.round((structureScore * weights.structure) / 100 * 10) / 10,
        explanation: structureReason,
      },
      momentum: {
        name: 'Импульс осцилляторов',
        category: 'momentum',
        rawScore: momentumScore,
        weight: weights.momentum,
        weightedContribution: Math.round((momentumScore * weights.momentum) / 100 * 10) / 10,
        explanation: momentumReason,
      },
      volume: {
        name: 'Институциональный объём',
        category: 'volume',
        rawScore: volumeScore,
        weight: weights.volume,
        weightedContribution: Math.round((volumeScore * weights.volume) / 100 * 10) / 10,
        explanation: volumeReason,
      },
      volatility: {
        name: 'Режим волатильности',
        category: 'volatility',
        rawScore: volatilityScore,
        weight: weights.volatility,
        weightedContribution: Math.round((volatilityScore * weights.volatility) / 100 * 10) / 10,
        explanation: volatilityReason,
      },
      mtf: {
        name: 'Мульти-таймфрейм (MTF)',
        category: 'mtf',
        rawScore: mtfScore,
        weight: weights.mtf,
        weightedContribution: Math.round((mtfScore * weights.mtf) / 100 * 10) / 10,
        explanation: mtfReason,
      },
      supportResistance: {
        name: 'Запас хода до S/R',
        category: 'supportResistance',
        rawScore: srScore,
        weight: weights.supportResistance,
        weightedContribution: Math.round((srScore * weights.supportResistance) / 100 * 10) / 10,
        explanation: srReason,
      },
      liquidity: {
        name: 'Качество ликвидности',
        category: 'liquidity',
        rawScore: liquidityScore,
        weight: weights.liquidity,
        weightedContribution: Math.round((liquidityScore * weights.liquidity) / 100 * 10) / 10,
        explanation: liquidityReason,
      },
      riskReward: {
        name: 'Профиль риск/прибыль',
        category: 'riskReward',
        rawScore: rrScore,
        weight: weights.riskReward,
        weightedContribution: Math.round((rrScore * weights.riskReward) / 100 * 10) / 10,
        explanation: rrReason,
      },
    };

    // Calculate base aggregated score
    let baseScore = 0;
    for (const item of Object.values(factorScores)) {
      baseScore += item.weightedContribution;
    }
    baseScore = Math.round(baseScore * 10) / 10;

    // Apply conflict penalties from SignalConflictEngine
    const penalties = conflictReport.totalQualityPenalty;
    const overallQuality = Math.max(0, Math.min(100, Math.round(baseScore - penalties)));

    // Extract key drivers
    const dominantStrengths = Object.values(factorScores)
      .filter((item) => item.rawScore >= 75 && item.weight > 0)
      .sort((a, b) => b.weightedContribution - a.weightedContribution)
      .map((item) => `${item.name} (${item.rawScore}/100, вес ${item.weight}%)`);

    const vulnerabilities = Object.values(factorScores)
      .filter((item) => item.rawScore < 50 && item.weight > 0)
      .map((item) => `${item.name} (${item.rawScore}/100): ${item.explanation}`);

    const summaryExplanation = `Режим: ${weightProfile.regime}. Базовый балл: ${baseScore}/100. Штрафы конфликтов: -${penalties}. Итоговое качество: ${overallQuality}/100.`;

    return {
      overallQuality,
      baseScore,
      penalties,
      factorScores,
      dominantStrengths,
      vulnerabilities,
      summaryExplanation,
    };
  }
}
