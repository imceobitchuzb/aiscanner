import { Candle, MarketRegimeState, MarketRegimeType } from '../types';
import { QuantFeatureEngine, QuantFeatures } from './featureEngine';
import { DetailedMarketStructure, MarketStructureEngine } from './marketStructureEngine';

export class MarketRegimeEngine {
  /**
   * Deterministically classifies the market regime and computes dynamic confidence
   * based strictly on technical features and structural state.
   */
  public static classify(
    candles: Candle[],
    injectedFeatures?: QuantFeatures | null,
    injectedStructure?: DetailedMarketStructure | null
  ): MarketRegimeState {
    if (!candles || candles.length < 30) {
      return {
        regime: 'UNCERTAIN',
        confidence: 0,
        durationHours: 0,
        stability: 'LOW',
        transitionRisk: 'HIGH',
        transitionProbabilities: [
          { targetRegime: 'RANGE', probability: 34 },
          { targetRegime: 'TRENDING_BULL', probability: 33 },
          { targetRegime: 'TRENDING_BEAR', probability: 33 },
        ],
        explanation: 'Недостаточно исторических свечей для достоверной статистической классификации рыночного режима (требуется минимум 30 свечей).',
      };
    }

    const feat = injectedFeatures || QuantFeatureEngine.extractFeatures(candles);
    const struct = injectedStructure || MarketStructureEngine.analyze(candles);

    if (!feat) {
      return {
        regime: 'UNCERTAIN',
        confidence: 0,
        durationHours: 0,
        stability: 'LOW',
        transitionRisk: 'HIGH',
        transitionProbabilities: [],
        explanation: 'Не удалось извлечь статистические признаки из набора свечей.',
      };
    }

    const {
      price,
      ema20,
      ema50,
      ema200,
      adx,
      atrPercent,
      bollinger,
      volumeRatio,
      momentum10,
      trendSlope,
      returns,
    } = feat;

    // 1. Indicator Condition Checks
    const isADXTrending = adx.adx14 >= 25;
    const isADXExtreme = adx.adx14 >= 40;
    const isDirectionalBull = adx.plusDI > adx.minusDI && ema20 > ema50 && price > ema20 && trendSlope > 0;
    const isDirectionalBear = adx.minusDI > adx.plusDI && ema20 < ema50 && price < ema20 && trendSlope < 0;

    const isHighVol = atrPercent > 3.2 || bollinger.bandwidth > 6.0;
    const isLowVol = atrPercent < 1.0 && bollinger.bandwidth < 2.0;

    const isBreakout = struct.state === 'BREAKOUT' || (price > struct.recentSwingHigh && returns > 1.2 && volumeRatio > 1.1);
    const isBreakdown = struct.state === 'BREAKDOWN' || (price < struct.recentSwingLow && returns < -1.2 && volumeRatio > 1.1);

    let regime: MarketRegimeType = 'RANGE';
    let confidence = 50;
    let stability: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    let transitionRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    let explanation = '';

    if (isBreakout) {
      regime = 'BREAKOUT';
      // Confidence dynamically scales with ADX and volume ratio
      confidence = Math.min(92, Math.round(65 + Math.min(15, adx.adx14 * 0.4) + Math.min(12, volumeRatio * 6)));
      stability = 'LOW';
      transitionRisk = 'HIGH';
      explanation = `Импульсный пробой выше ключевого уровня $${struct.recentSwingHigh} с ростом объёма (${volumeRatio.toFixed(1)}x к среднему) и расширением диапазона.`;
    } else if (isBreakdown) {
      regime = 'BREAKDOWN';
      confidence = Math.min(92, Math.round(65 + Math.min(15, adx.adx14 * 0.4) + Math.min(12, volumeRatio * 6)));
      stability = 'LOW';
      transitionRisk = 'HIGH';
      explanation = `Импульсный пробой вниз поддержки $${struct.recentSwingLow} с преобладанием давления продавцов (-DI: ${adx.minusDI}).`;
    } else if (isDirectionalBull && isADXTrending) {
      regime = 'TRENDING_BULL';
      confidence = Math.min(95, Math.round(60 + (isADXExtreme ? 20 : 12) + Math.min(15, trendSlope * 10)));
      stability = 'HIGH';
      transitionRisk = price > ema20 * 1.04 ? 'HIGH' : 'LOW';
      explanation = `Устойчивый восходящий тренд: EMA20 ($${ema20.toFixed(2)}) > EMA50 ($${ema50.toFixed(2)}), ADX ${adx.adx14.toFixed(1)}, наклон +${trendSlope.toFixed(2)}% за бар.`;
    } else if (isDirectionalBear && isADXTrending) {
      regime = 'TRENDING_BEAR';
      confidence = Math.min(95, Math.round(60 + (isADXExtreme ? 20 : 12) + Math.min(15, Math.abs(trendSlope) * 10)));
      stability = 'HIGH';
      transitionRisk = price < ema20 * 0.96 ? 'HIGH' : 'LOW';
      explanation = `Устойчивый нисходящий тренд: отрицательный направленный индекс (-DI: ${adx.minusDI.toFixed(1)}), цена ниже EMA20 ($${ema20.toFixed(2)}).`;
    } else if (isHighVol) {
      regime = 'HIGH_VOLATILITY';
      confidence = Math.min(88, Math.round(62 + atrPercent * 6));
      stability = 'LOW';
      transitionRisk = 'HIGH';
      explanation = `Повышенная волатильность рынка (ATR: ${atrPercent.toFixed(2)}%, ширина полос Боллинджера: ${bollinger.bandwidth.toFixed(1)}%).`;
    } else if (isLowVol) {
      regime = 'LOW_VOLATILITY';
      confidence = Math.min(88, Math.round(65 + (2.0 - bollinger.bandwidth) * 10));
      stability = 'HIGH';
      transitionRisk = 'HIGH';
      explanation = `Сжатие диапазона / компрессия (ширина полос Боллинджера: ${bollinger.bandwidth.toFixed(1)}%). Ожидается импульсный выход из консолидации.`;
    } else if (struct.state === 'BULLISH_STRUCTURE' && momentum10 > 0) {
      regime = 'ACCUMULATION';
      confidence = 68;
      stability = 'MEDIUM';
      transitionRisk = 'MEDIUM';
      explanation = 'Фаза накопления: формирование повышающихся локальных минимумов в нижней половине диапазона.';
    } else if (struct.state === 'BEARISH_STRUCTURE' && momentum10 < 0) {
      regime = 'DISTRIBUTION';
      confidence = 68;
      stability = 'MEDIUM';
      transitionRisk = 'MEDIUM';
      explanation = 'Фаза распределения: отскоки затухают под давлением скрытых продаж около верхней границы.';
    } else {
      regime = 'RANGE';
      confidence = Math.max(50, Math.min(78, Math.round(75 - adx.adx14 * 0.5)));
      stability = 'MEDIUM';
      transitionRisk = 'LOW';
      explanation = `Боковой горизонтальный диапазон (Флэт): ADX ${adx.adx14.toFixed(1)} ниже порогового значения 25. Равновесие между спросом и предложением.`;
    }

    return {
      regime,
      confidence,
      durationHours: Math.max(4, Math.floor(10 + (adx.adx14 % 20))),
      stability,
      transitionRisk,
      transitionProbabilities: this.computeTransitionProbabilities(regime, adx.adx14),
      explanation,
    };
  }

  private static computeTransitionProbabilities(regime: MarketRegimeType, adx: number) {
    switch (regime) {
      case 'TRENDING_BULL':
        return [
          { targetRegime: 'RANGE' as MarketRegimeType, probability: Math.round(50 - adx * 0.2) },
          { targetRegime: 'DISTRIBUTION' as MarketRegimeType, probability: 30 },
          { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: Math.round(20 + adx * 0.2) },
        ];
      case 'TRENDING_BEAR':
        return [
          { targetRegime: 'ACCUMULATION' as MarketRegimeType, probability: 45 },
          { targetRegime: 'RANGE' as MarketRegimeType, probability: 35 },
          { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 20 },
        ];
      case 'RANGE':
        return [
          { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 42 },
          { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 38 },
          { targetRegime: 'LOW_VOLATILITY' as MarketRegimeType, probability: 20 },
        ];
      case 'LOW_VOLATILITY':
        return [
          { targetRegime: 'BREAKOUT' as MarketRegimeType, probability: 48 },
          { targetRegime: 'BREAKDOWN' as MarketRegimeType, probability: 44 },
          { targetRegime: 'RANGE' as MarketRegimeType, probability: 8 },
        ];
      case 'BREAKOUT':
        return [
          { targetRegime: 'TRENDING_BULL' as MarketRegimeType, probability: 65 },
          { targetRegime: 'RANGE' as MarketRegimeType, probability: 25 },
          { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 10 },
        ];
      case 'BREAKDOWN':
        return [
          { targetRegime: 'TRENDING_BEAR' as MarketRegimeType, probability: 65 },
          { targetRegime: 'RANGE' as MarketRegimeType, probability: 25 },
          { targetRegime: 'HIGH_VOLATILITY' as MarketRegimeType, probability: 10 },
        ];
      default:
        return [
          { targetRegime: 'RANGE' as MarketRegimeType, probability: 40 },
          { targetRegime: 'TRENDING_BULL' as MarketRegimeType, probability: 30 },
          { targetRegime: 'TRENDING_BEAR' as MarketRegimeType, probability: 30 },
        ];
    }
  }
}
