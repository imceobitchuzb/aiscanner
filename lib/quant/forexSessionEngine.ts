import { Candle, Timeframe } from '../types';

export type ForexSession = 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OFF_HOURS';

export interface ForexSessionState {
  symbol: string;
  timestamp: number;
  sessionHourUtc: number;
  sessionMinuteUtc: number;
  activeSessions: ForexSession[];
  activeSession: 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OVERLAP' | 'OFF_HOURS';
  isOverlap: boolean; // London & New York overlap (12:00 - 16:00 UTC)
  isKillzone: boolean; // London Open (07:00-09:00 UTC) or NY Open (12:00-14:00 UTC)
  liquidityTier: 'LOW' | 'MEDIUM' | 'HIGH';
  currentSessionRange: {
    high: number;
    low: number;
    rangePips: number;
    barsInSession: number;
  } | null;
  openingRange: {
    session: 'LONDON' | 'NEW_YORK' | null;
    high: number;
    low: number;
    rangePips: number;
    isFormed: boolean;
  } | null;
  openingRangeBreakout: 'BULLISH' | 'BEARISH' | 'BULLISH_BREAKOUT' | 'BEARISH_BREAKOUT' | 'NONE';
  sessionRecommendation: string;
}

export class ForexSessionEngine {
  /**
   * Deterministically calculates session context, opening ranges, and overlap
   * for Forex instruments (EURUSD, GBPUSD, USDJPY) using UTC timestamps.
   * Zero future-data leakage: only candles up to T are evaluated.
   */
  public static analyzeSession(
    candles: Candle[],
    symbol = 'EURUSD',
    timeframe: Timeframe = '1h'
  ): ForexSessionState {
    if (!candles || candles.length === 0) {
      return this.createDefaultState(symbol, Date.now());
    }

    const currentBar = candles[candles.length - 1];
    const timestampSec = currentBar.time;
    const dateUtc = new Date(timestampSec * 1000);
    const hourUtc = dateUtc.getUTCHours();
    const minuteUtc = dateUtc.getUTCMinutes();
    const currentPrice = currentBar.close;

    // Detect Active Sessions in UTC:
    // Asian: 00:00 - 08:00 UTC
    // London: 07:00 - 16:00 UTC
    // New York: 12:00 - 21:00 UTC
    // Overlap: 12:00 - 16:00 UTC
    // Killzones: London Open (07-09 UTC), NY Open (12-14 UTC)
    const activeSessions: ForexSession[] = [];
    if (hourUtc >= 0 && hourUtc < 8) activeSessions.push('ASIAN');
    if (hourUtc >= 7 && hourUtc < 16) activeSessions.push('LONDON');
    if (hourUtc >= 12 && hourUtc < 21) activeSessions.push('NEW_YORK');
    if (activeSessions.length === 0) activeSessions.push('OFF_HOURS');

    const isOverlap = hourUtc >= 12 && hourUtc < 16;
    const isLondonKillzone = hourUtc >= 7 && hourUtc < 9;
    const isNyKillzone = hourUtc >= 12 && hourUtc < 14;
    const isKillzone = isLondonKillzone || isNyKillzone;

    let activeSession: ForexSessionState['activeSession'] = 'OFF_HOURS';
    if (isOverlap) {
      activeSession = 'OVERLAP';
    } else if (hourUtc >= 12 && hourUtc < 21) {
      activeSession = 'NEW_YORK';
    } else if (hourUtc >= 7 && hourUtc < 16) {
      activeSession = 'LONDON';
    } else if (hourUtc >= 0 && hourUtc < 8) {
      activeSession = 'ASIAN';
    }

    const liquidityTier: 'LOW' | 'MEDIUM' | 'HIGH' = isOverlap || isKillzone
      ? 'HIGH'
      : activeSessions.includes('LONDON') || activeSessions.includes('NEW_YORK')
      ? 'MEDIUM'
      : 'LOW';

    // Pip size resolution
    const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;

    // Session Range Tracking:
    let sessionStartHourUtc = 0;
    if (hourUtc >= 12 && hourUtc < 21) sessionStartHourUtc = 12;
    else if (hourUtc >= 7 && hourUtc < 16) sessionStartHourUtc = 7;
    else if (hourUtc >= 0 && hourUtc < 8) sessionStartHourUtc = 0;
    else sessionStartHourUtc = 21;

    // Find candles in current active day session
    const currentDayMidnight = Math.floor(timestampSec / 86400) * 86400;
    const sessionStartTime = currentDayMidnight + sessionStartHourUtc * 3600;

    const sessionCandles = candles.filter((c) => c.time >= sessionStartTime && c.time <= timestampSec);

    let sessionRange: ForexSessionState['currentSessionRange'] = null;
    if (sessionCandles.length > 0) {
      let high = -Infinity;
      let low = Infinity;
      for (const c of sessionCandles) {
        if (c.high > high) high = c.high;
        if (c.low < low) low = c.low;
      }
      sessionRange = {
        high: Math.round(high * 100000) / 100000,
        low: Math.round(low * 100000) / 100000,
        rangePips: Math.round((high - low) * pipMultiplier * 10) / 10,
        barsInSession: sessionCandles.length,
      };
    }

    // Opening Range (OR) Calculation:
    // London OR: 07:00 - 08:00 UTC (first 60 minutes)
    // New York OR: 12:00 - 13:00 UTC (first 60 minutes)
    let openingRange: ForexSessionState['openingRange'] = null;
    let openingRangeBreakout: ForexSessionState['openingRangeBreakout'] = 'NONE';

    let orStartHour = -1;
    let orSession: 'LONDON' | 'NEW_YORK' | null = null;
    if (hourUtc >= 7 && hourUtc < 12) {
      orStartHour = 7;
      orSession = 'LONDON';
    } else if (hourUtc >= 12 && hourUtc < 21) {
      orStartHour = 12;
      orSession = 'NEW_YORK';
    }

    if (orStartHour !== -1 && orSession !== null) {
      const orStartTime = currentDayMidnight + orStartHour * 3600;
      const orEndTime = orStartTime + 3600; // 60 minutes
      const orCandles = candles.filter((c) => c.time >= orStartTime && c.time < orEndTime);

      if (orCandles.length > 0) {
        let orHigh = -Infinity;
        let orLow = Infinity;
        for (const c of orCandles) {
          if (c.high > orHigh) orHigh = c.high;
          if (c.low < orLow) orLow = c.low;
        }

        const isFormed = timestampSec >= orEndTime;
        openingRange = {
          session: orSession,
          high: Math.round(orHigh * 100000) / 100000,
          low: Math.round(orLow * 100000) / 100000,
          rangePips: Math.round((orHigh - orLow) * pipMultiplier * 10) / 10,
          isFormed,
        };

        if (isFormed) {
          if (currentPrice > orHigh) {
            openingRangeBreakout = 'BULLISH_BREAKOUT';
          } else if (currentPrice < orLow) {
            openingRangeBreakout = 'BEARISH_BREAKOUT';
          }
        }
      }
    }

    // Session recommendation
    let sessionRecommendation = '';
    if (isOverlap) {
      sessionRecommendation = 'London/NY Overlap: Максимальная ликвидность и направленный импульс. Оптимальное окно для исполнения импульсных сетапов.';
    } else if (isKillzone) {
      sessionRecommendation = 'Session Killzone (Open): Формирование сессионного диапазона и манипуляции ликвидностью. Следить за пробоем Opening Range.';
    } else if (activeSessions.includes('ASIAN')) {
      sessionRecommendation = 'Азиатская сессия: Пониженная волатильность и консолидация. Рекомендуется ожидать открытия Лондона (07:00 UTC).';
    } else if (activeSessions.includes('OFF_HOURS')) {
      sessionRecommendation = 'Внебиржевые часы / клиринг: Минимальная ликвидность, риск расширения спредов. Входы заблокированы.';
    } else {
      sessionRecommendation = 'Стандартная сессионная активность.';
    }

    return {
      symbol,
      timestamp: timestampSec,
      sessionHourUtc: hourUtc,
      sessionMinuteUtc: minuteUtc,
      activeSessions,
      activeSession,
      isOverlap,
      isKillzone,
      liquidityTier,
      currentSessionRange: sessionRange,
      openingRange,
      openingRangeBreakout,
      sessionRecommendation,
    };
  }

  /**
   * Helper alias accepting either timestamp (seconds) or candle array.
   */
  public static getSessionContext(
    timeOrCandles: number | Candle[],
    symbol = 'EURUSD',
    candles?: Candle[]
  ): ForexSessionState {
    if (typeof timeOrCandles === 'number') {
      const timestampSec = timeOrCandles;
      const c = candles && candles.length > 0 ? candles : [{
        time: timestampSec,
        open: 1.0800,
        high: 1.0800,
        low: 1.0800,
        close: 1.0800,
        volume: 1000,
      }];
      return this.analyzeSession(c, symbol);
    } else {
      return this.analyzeSession(timeOrCandles, symbol);
    }
  }

  private static createDefaultState(symbol: string, timestampMs: number): ForexSessionState {
    const dateUtc = new Date(timestampMs);
    const hourUtc = dateUtc.getUTCHours();
    const minuteUtc = dateUtc.getUTCMinutes();

    return {
      symbol,
      timestamp: Math.floor(timestampMs / 1000),
      sessionHourUtc: hourUtc,
      sessionMinuteUtc: minuteUtc,
      activeSessions: ['OFF_HOURS'],
      activeSession: 'OFF_HOURS',
      isOverlap: false,
      isKillzone: false,
      liquidityTier: 'LOW',
      currentSessionRange: null,
      openingRange: null,
      openingRangeBreakout: 'NONE',
      sessionRecommendation: 'Недостаточно данных для сессионного анализа.',
    };
  }
}
