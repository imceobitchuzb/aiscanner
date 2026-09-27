import { Timeframe } from '../types';

export interface ForexVolatilityAssessment {
  symbol: string;
  timeframe: Timeframe;
  atrPrice: number;
  atrPips: number;
  isOptimal: boolean;
  score: number; // 0 - 100
  reason: string;
}

export interface ForexHeadroomAssessment {
  symbol: string;
  headroomPrice: number;
  headroomPips: number;
  stopDistancePrice: number;
  stopDistancePips: number;
  riskReward: number;
  hasValidRr: boolean;
  score: number; // 0 - 100
  reason: string;
}

export class ForexPipEngine {
  /**
   * Identifies whether a given symbol is an FX currency pair.
   */
  public static isForexPair(symbol: string): boolean {
    const s = symbol.toUpperCase();
    return (
      (s.includes('EUR') || s.includes('GBP') || s.includes('USD') || s.includes('JPY') || s.includes('AUD') || s.includes('CAD') || s.includes('CHF')) &&
      !s.includes('USDT') &&
      !s.includes('BTC') &&
      !s.includes('ETH') &&
      !s.includes('XAU')
    );
  }

  /**
   * Resolves the pip unit value for a symbol:
   * 4-decimal currency pairs (EURUSD, GBPUSD, etc.) = 0.0001
   * JPY currency pairs = 0.01
   * Gold (XAUUSD) point = 0.10
   */
  public static getPipSize(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s.includes('JPY')) return 0.01;
    if (s.includes('XAU')) return 0.10;
    if (this.isForexPair(s)) return 0.0001;
    return 1.0;
  }

  /**
   * Converts a raw price distance into pips.
   */
  public static priceToPips(priceDistance: number, symbol = 'EURUSD'): number {
    const pipSize = this.getPipSize(symbol);
    return Math.round((Math.abs(priceDistance) / pipSize) * 10) / 10;
  }

  /**
   * Converts pips into a price difference.
   */
  public static pipsToPrice(pips: number, symbol = 'EURUSD'): number {
    const pipSize = this.getPipSize(symbol);
    return Math.round(pips * pipSize * 100000) / 100000;
  }

  /**
   * Computes authentic ATR in pips.
   */
  public static calculateAtrInPips(atrPrice: number, symbol = 'EURUSD'): number {
    return this.priceToPips(atrPrice, symbol);
  }

  /**
   * Evaluates FX volatility calibrated in pips rather than crypto percentages.
   * On EURUSD, 15m ATR of 10 pips is 0.09% of price, which is optimal for FX.
   */
  public static evaluateForexVolatility(
    symbol: string,
    atrPrice: number,
    timeframe: Timeframe = '1h'
  ): ForexVolatilityAssessment {
    const atrPips = this.calculateAtrInPips(atrPrice, symbol);

    let optimalMinPips = 10;
    let optimalMaxPips = 45;
    let extremePips = 75;

    if (timeframe === '15m' || timeframe === '5m') {
      optimalMinPips = 6;
      optimalMaxPips = 25;
      extremePips = 40;
    } else if (timeframe === '4h' || timeframe === '1D') {
      optimalMinPips = 25;
      optimalMaxPips = 100;
      extremePips = 160;
    }

    let isOptimal = false;
    let score = 60;
    let reason = '';

    if (atrPips >= optimalMinPips && atrPips <= optimalMaxPips) {
      isOptimal = true;
      score = 85;
      reason = `Оптимальная сессионная волатильность: ATR составляет ${atrPips.toFixed(1)} пипсов.`;
    } else if (atrPips > extremePips) {
      isOptimal = false;
      score = 35;
      reason = `Повышенная волатильность (${atrPips.toFixed(1)} пипсов): риск расширения спреда и проскальзывания.`;
    } else if (atrPips < optimalMinPips * 0.6) {
      isOptimal = false;
      score = 45;
      reason = `Низкая волатильность (${atrPips.toFixed(1)} пипсов): боковой дрейф без направленного импульса.`;
    } else {
      isOptimal = true;
      score = 65;
      reason = `Умеренная волатильность (${atrPips.toFixed(1)} пипсов): в пределах допустимого диапазона.`;
    }

    return {
      symbol,
      timeframe,
      atrPrice,
      atrPips,
      isOptimal,
      score,
      reason,
    };
  }

  /**
   * Evaluates distance to support/resistance and validates structural R:R in pip units.
   */
  public static evaluateForexHeadroom(
    symbol: string,
    headroomPrice: number,
    stopDistancePrice: number,
    minRiskRewardThreshold = 1.5
  ): ForexHeadroomAssessment {
    const headroomPips = this.priceToPips(headroomPrice, symbol);
    const stopDistancePips = Math.max(1, this.priceToPips(stopDistancePrice, symbol));
    const riskReward = Math.round((headroomPips / stopDistancePips) * 100) / 100;
    const hasValidRr = riskReward >= minRiskRewardThreshold;

    let score = 60;
    let reason = '';

    if (headroomPips >= 25 && hasValidRr) {
      score = 90;
      reason = `Широкий запас хода: до преграды ${headroomPips.toFixed(1)} пипсов (R:R ${riskReward.toFixed(2)}).`;
    } else if (hasValidRr) {
      score = 75;
      reason = `Достаточный запас хода: ${headroomPips.toFixed(1)} пипсов до целевого уровня (R:R ${riskReward.toFixed(2)}).`;
    } else if (headroomPips <= 8) {
      score = 25;
      reason = `Критическая близость преграды: до сопротивления/поддержки всего ${headroomPips.toFixed(1)} пипсов.`;
    } else {
      score = 45;
      reason = `Недостаточный R:R (${riskReward.toFixed(2)} < ${minRiskRewardThreshold.toFixed(1)}): цель ${headroomPips.toFixed(1)} пипсов при риске ${stopDistancePips.toFixed(1)} пипсов.`;
    }

    return {
      symbol,
      headroomPrice,
      headroomPips,
      stopDistancePrice,
      stopDistancePips,
      riskReward,
      hasValidRr,
      score,
      reason,
    };
  }
}
