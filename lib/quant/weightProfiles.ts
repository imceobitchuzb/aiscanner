import { MarketRegimeType } from '../types';

export interface FactorWeights {
  trend: number;
  structure: number;
  momentum: number;
  volume: number;
  volatility: number;
  mtf: number;
  supportResistance: number;
  liquidity: number;
  riskReward: number;
}

export interface WeightProfile {
  profileName?: string;
  regime: MarketRegimeType;
  weights: FactorWeights;
  description: string;
}

/**
 * Institutional Factor Weight Profiles per Market Regime.
 * Ensures the scoring engine adapts to whether the market is trending, ranging, breaking out, or volatile.
 * All profiles are normalized to sum to 100.
 */
export const REGIME_WEIGHT_PROFILES: Record<MarketRegimeType, WeightProfile> = {
  TRENDING_BULL: {
    profileName: 'TRENDING_BULL_PROFILE',
    regime: 'TRENDING_BULL',
    weights: {
      trend: 25,
      structure: 20,
      momentum: 20,
      volume: 10,
      mtf: 10,
      supportResistance: 5,
      volatility: 5,
      riskReward: 5,
      liquidity: 0,
    },
    description: 'Бычий тренд: приоритет отдаётся синхронизации скользящих средних, сохранению структуры higher highs/lows и импульсу.',
  },

  TRENDING_BEAR: {
    regime: 'TRENDING_BEAR',
    weights: {
      trend: 25,
      structure: 20,
      momentum: 20,
      volume: 10,
      mtf: 10,
      supportResistance: 5,
      volatility: 5,
      riskReward: 5,
      liquidity: 0,
    },
    description: 'Медвежий тренд: приоритет нисходящему вееру средних, пробою поддержек вниз и давлению продавцов.',
  },

  RANGE: {
    regime: 'RANGE',
    weights: {
      supportResistance: 25,
      structure: 20,
      volatility: 15,
      momentum: 15,
      trend: 5,
      volume: 5,
      mtf: 5,
      liquidity: 5,
      riskReward: 5,
    },
    description: 'Боковой диапазон (флэт): приоритет границам поддержки/сопротивления, возврату к среднему (mean reversion) и контролю волатильности.',
  },

  BREAKOUT: {
    regime: 'BREAKOUT',
    weights: {
      momentum: 25,
      volume: 20,
      structure: 20,
      volatility: 15,
      trend: 10,
      supportResistance: 5,
      mtf: 5,
      liquidity: 0,
      riskReward: 0,
    },
    description: 'Импульсный пробой вверх: ключевыми факторами являются всплеск институционального объёма, расширение спреда и пробитие уровня.',
  },

  BREAKDOWN: {
    regime: 'BREAKDOWN',
    weights: {
      momentum: 25,
      volume: 20,
      structure: 20,
      volatility: 15,
      trend: 10,
      supportResistance: 5,
      mtf: 5,
      liquidity: 0,
      riskReward: 0,
    },
    description: 'Импульсный пробой вниз: взрывной объём на продажу, пробитие ключевой поддержки и ускорение нисходящего моментума.',
  },

  HIGH_VOLATILITY: {
    regime: 'HIGH_VOLATILITY',
    weights: {
      volatility: 25,
      riskReward: 25,
      structure: 15,
      supportResistance: 10,
      trend: 10,
      momentum: 10,
      volume: 5,
      mtf: 0,
      liquidity: 0,
    },
    description: 'Экстремальная волатильность: максимальный приоритет контролю риска, адекватному R:R и защите от каскадных сквизов.',
  },

  LOW_VOLATILITY: {
    regime: 'LOW_VOLATILITY',
    weights: {
      structure: 25,
      supportResistance: 20,
      trend: 15,
      momentum: 15,
      mtf: 10,
      volume: 5,
      volatility: 5,
      liquidity: 5,
      riskReward: 0,
    },
    description: 'Низкая волатильность (компрессия): акцент на структурное накопление и уровни консолидации перед фазой расширения.',
  },

  ACCUMULATION: {
    regime: 'ACCUMULATION',
    weights: {
      supportResistance: 25,
      structure: 20,
      volume: 15,
      momentum: 15,
      trend: 10,
      volatility: 5,
      mtf: 5,
      liquidity: 5,
      riskReward: 0,
    },
    description: 'Накопление (Вайкофф): удержание дна диапазона, рост скрытого спроса на пониженных объёмах.',
  },

  DISTRIBUTION: {
    regime: 'DISTRIBUTION',
    weights: {
      supportResistance: 25,
      structure: 20,
      volume: 15,
      momentum: 15,
      trend: 10,
      volatility: 5,
      mtf: 5,
      liquidity: 5,
      riskReward: 0,
    },
    description: 'Распределение (Вайкофф): слабость спроса у верхней границы, скрытое закрытие позиций крупными игроками.',
  },

  UNCERTAIN: {
    regime: 'UNCERTAIN',
    weights: {
      structure: 15,
      trend: 15,
      momentum: 15,
      supportResistance: 15,
      volume: 10,
      volatility: 10,
      mtf: 10,
      liquidity: 5,
      riskReward: 5,
    },
    description: 'Неопределённость: сбалансированный консервативный профиль с пониженной агрессивностью входа.',
  },
};

export class AdaptiveWeightEngine {
  /**
   * Retrieves the dynamic factor weight profile tailored for the given regime.
   * If useStaticWeights is specified, returns an even baseline profile.
   */
  public static getProfile(regime: MarketRegimeType, useStaticWeights = false): WeightProfile {
    if (useStaticWeights) {
      return {
        profileName: 'STATIC_WEIGHTS_FALLBACK',
        regime,
        weights: {
          trend: 20,
          structure: 20,
          momentum: 20,
          volume: 15,
          mtf: 10,
          supportResistance: 5,
          volatility: 5,
          riskReward: 5,
          liquidity: 0,
        },
        description: 'Статический эталонный профиль (без учёта режима рынка).',
      };
    }

    const base = REGIME_WEIGHT_PROFILES[regime] || REGIME_WEIGHT_PROFILES.UNCERTAIN;
    return {
      profileName: `${base.regime}_PROFILE`,
      ...base,
    };
  }
}
