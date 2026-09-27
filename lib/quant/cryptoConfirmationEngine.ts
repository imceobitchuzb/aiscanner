import { Candle, Timeframe } from '../types';
import { DetailedMarketStructure, MarketStructureEngine } from './marketStructureEngine';
import { MultiTimeframeEngine } from './multiTimeframeEngine';
import { MarketRegimeState } from '../types';
import { QuantFeatures } from './featureEngine';

export type CryptoConfirmationVerdict =
  | 'CONFIRMED'
  | 'VALIDATED_PULLBACK'
  | 'HTF_STRUCTURE_CONFLICT'
  | 'RANGE_BREAKOUT_REJECTED'
  | 'LOW_VOLATILITY_BREAKOUT_REJECTED'
  | 'LIQUIDITY_SWEEP_RISK';

export interface CryptoConfirmationResult {
  verdict: CryptoConfirmationVerdict;
  isApproved: boolean;
  reason: string;
  isPullback: boolean;
  isLiquiditySweepRisk: boolean;
  structure1h: DetailedMarketStructure;
  structure4h: DetailedMarketStructure;
  sweepDetails?: {
    piercedLevel: number;
    rejectionWickRatio: number;
  };
}

export class CryptoConfirmationEngine {
  /**
   * Deterministically validates short-timeframe Crypto (15m/5m) breakout and trend entries
   * against higher-timeframe 1h and 4h structural alignment, liquidity sweeps, and regime chop.
   * Zero lookahead bias: only candles up to time T are resampled and analyzed.
   */
  public static validateShortTimeframeCrypto(
    candles15m: Candle[],
    direction: 'LONG' | 'SHORT',
    localStructure: DetailedMarketStructure,
    localRegime: MarketRegimeState,
    localFeatures: QuantFeatures,
    symbol = 'BTCUSDT',
    timeframe: Timeframe = '15m'
  ): CryptoConfirmationResult {
    // Only apply higher-timeframe gate to short-timeframe crypto
    const isCrypto = symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH');
    const isShortTf = timeframe === '15m' || timeframe === '5m' || timeframe === '1m';

    // 1. Resample 1h and 4h candles strictly causally
    const factor1h = timeframe === '5m' ? 12 : 4;
    const factor4h = timeframe === '5m' ? 48 : 16;

    const candles1h = MultiTimeframeEngine.aggregateCandles(candles15m, factor1h);
    const candles4h = MultiTimeframeEngine.aggregateCandles(candles15m, factor4h);

    const structure1h = MarketStructureEngine.analyze(candles1h);
    const structure4h = MarketStructureEngine.analyze(candles4h);

    if (!isCrypto || !isShortTf) {
      return {
        verdict: 'CONFIRMED',
        isApproved: true,
        reason: 'Higher-timeframe crypto gate not applicable for this asset/timeframe.',
        isPullback: false,
        isLiquiditySweepRisk: false,
        structure1h,
        structure4h,
      };
    }

    const n = candles15m.length;
    const currentBar = candles15m[n - 1];
    const isLong = direction === 'LONG';
    const isBreakoutAttempt = isLong
      ? localStructure.state === 'BREAKOUT' || currentBar.high >= localStructure.recentSwingHigh
      : localStructure.state === 'BREAKDOWN' || currentBar.low <= localStructure.recentSwingLow;

    // 2. Liquidity Sweep Detection
    // For Long: bar pierced above swing high, but close is below swing high or prints a large upper rejection wick (> 45% of candle range)
    // For Short: bar pierced below swing low, but close is above swing low or prints a large lower rejection wick (> 45% of candle range)
    const candleRange = Math.max(0.0001, currentBar.high - currentBar.low);

    if (isLong && currentBar.high > localStructure.recentSwingHigh) {
      const upperWick = currentBar.high - Math.max(currentBar.open, currentBar.close);
      const wickRatio = upperWick / candleRange;
      const closedBelow = currentBar.close <= localStructure.recentSwingHigh;

      if (closedBelow || wickRatio >= 0.45) {
        return {
          verdict: 'LIQUIDITY_SWEEP_RISK',
          isApproved: false,
          reason: `Обнаружен риск захвата ликвидности: ложный прокол максимума ($${localStructure.recentSwingHigh.toFixed(2)}) с верхней тенью ${(wickRatio * 100).toFixed(1)}%.`,
          isPullback: false,
          isLiquiditySweepRisk: true,
          structure1h,
          structure4h,
          sweepDetails: {
            piercedLevel: localStructure.recentSwingHigh,
            rejectionWickRatio: Math.round(wickRatio * 100) / 100,
          },
        };
      }
    } else if (!isLong && currentBar.low < localStructure.recentSwingLow) {
      const lowerWick = Math.min(currentBar.open, currentBar.close) - currentBar.low;
      const wickRatio = lowerWick / candleRange;
      const closedAbove = currentBar.close >= localStructure.recentSwingLow;

      if (closedAbove || wickRatio >= 0.45) {
        return {
          verdict: 'LIQUIDITY_SWEEP_RISK',
          isApproved: false,
          reason: `Обнаружен риск захвата ликвидности: ложный прокол минимума ($${localStructure.recentSwingLow.toFixed(2)}) с нижней тенью ${(wickRatio * 100).toFixed(1)}%.`,
          isPullback: false,
          isLiquiditySweepRisk: true,
          structure1h,
          structure4h,
          sweepDetails: {
            piercedLevel: localStructure.recentSwingLow,
            rejectionWickRatio: Math.round(wickRatio * 100) / 100,
          },
        };
      }
    }

    // 3. Breakout in Range or Low Volatility Gating
    if (isBreakoutAttempt) {
      const regimeName = localRegime.regime as string;
      if (regimeName === 'RANGE' || regimeName === 'RANGING' || regimeName === 'ACCUMULATION' || regimeName === 'DISTRIBUTION') {
        return {
          verdict: 'RANGE_BREAKOUT_REJECTED',
          isApproved: false,
          reason: `Попытка пробоя в боковом режиме (${regimeName}) отклонена: повышенный риск ложного пробоя и распила позиции.`,
          isPullback: false,
          isLiquiditySweepRisk: false,
          structure1h,
          structure4h,
        };
      }

      if (regimeName === 'LOW_VOLATILITY' || localFeatures.atrPercent < 0.6) {
        return {
          verdict: 'LOW_VOLATILITY_BREAKOUT_REJECTED',
          isApproved: false,
          reason: `Пробой при пониженной волатильности (ATR ${localFeatures.atrPercent.toFixed(2)}% < 0.6%) отклонен: нехватка импульса для устойчивого движения.`,
          isPullback: false,
          isLiquiditySweepRisk: false,
          structure1h,
          structure4h,
        };
      }

      // 4. Higher-Timeframe Structural Confirmation
      // 1h structural alignment is strictly required for 15m breakout entries
      if (isLong) {
        if (structure1h.state === 'BEARISH_STRUCTURE' || structure1h.state === 'BREAKDOWN') {
          return {
            verdict: 'HTF_STRUCTURE_CONFLICT',
            isApproved: false,
            reason: `15m бычий пробой противоречит нисходящей 1h структуре (${structure1h.state}).`,
            isPullback: false,
            isLiquiditySweepRisk: false,
            structure1h,
            structure4h,
          };
        }
        if (structure4h.state === 'BEARISH_STRUCTURE') {
          return {
            verdict: 'HTF_STRUCTURE_CONFLICT',
            isApproved: false,
            reason: `15m бычий пробой противоречит медвежьему 4h макро-тренда.`,
            isPullback: false,
            isLiquiditySweepRisk: false,
            structure1h,
            structure4h,
          };
        }
      } else {
        if (structure1h.state === 'BULLISH_STRUCTURE' || structure1h.state === 'BREAKOUT') {
          return {
            verdict: 'HTF_STRUCTURE_CONFLICT',
            isApproved: false,
            reason: `15m медвежий пробой противоречит восходящей 1h структуре (${structure1h.state}).`,
            isPullback: false,
            isLiquiditySweepRisk: false,
            structure1h,
            structure4h,
          };
        }
        if (structure4h.state === 'BULLISH_STRUCTURE') {
          return {
            verdict: 'HTF_STRUCTURE_CONFLICT',
            isApproved: false,
            reason: `15m медвежий пробой противоречит бычьему 4h макро-тренда.`,
            isPullback: false,
            isLiquiditySweepRisk: false,
            structure1h,
            structure4h,
          };
        }
      }
    }

    // 5. Pullback / Retest Validation
    // Valid pullback:
    // Higher-timeframe structure is trending in setup direction (1h is BULLISH / BEARISH).
    // Price recently retraced towards EMA20 or broken swing level and is printing a reversal candle in trend direction.
    let isValidPullback = false;
    if (isLong && (structure1h.state === 'BULLISH_STRUCTURE' || structure1h.state === 'BREAKOUT')) {
      const nearEma20 = Math.abs(currentBar.close - localFeatures.ema20) < localFeatures.atr14 * 1.0;
      const isBullishCandle = currentBar.close > currentBar.open;
      const rsiRecovering = localFeatures.rsi14 >= 42 && localFeatures.rsi14 <= 62;

      if (nearEma20 && isBullishCandle && rsiRecovering) {
        isValidPullback = true;
      }
    } else if (!isLong && (structure1h.state === 'BEARISH_STRUCTURE' || structure1h.state === 'BREAKDOWN')) {
      const nearEma20 = Math.abs(currentBar.close - localFeatures.ema20) < localFeatures.atr14 * 1.0;
      const isBearishCandle = currentBar.close < currentBar.open;
      const rsiRecovering = localFeatures.rsi14 >= 38 && localFeatures.rsi14 <= 58;

      if (nearEma20 && isBearishCandle && rsiRecovering) {
        isValidPullback = true;
      }
    }

    if (isValidPullback) {
      return {
        verdict: 'VALIDATED_PULLBACK',
        isApproved: true,
        reason: 'Подтверждённый вход на откате в сторону 1h тренда: отскок от зоны поддержки/EMA с благоприятным профилем R:R.',
        isPullback: true,
        isLiquiditySweepRisk: false,
        structure1h,
        structure4h,
      };
    }

    return {
      verdict: 'CONFIRMED',
      isApproved: true,
      reason: '15m сетап подтверждён со стороны старших таймфреймов (1h/4h).',
      isPullback: false,
      isLiquiditySweepRisk: false,
      structure1h,
      structure4h,
    };
  }
}
