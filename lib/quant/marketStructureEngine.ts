import { Candle } from '../types';

export type StructureType =
  | 'BULLISH_STRUCTURE'
  | 'BEARISH_STRUCTURE'
  | 'RANGE'
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'UNCERTAIN';

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'HIGH' | 'LOW';
  tag?: 'HH' | 'HL' | 'LH' | 'LL';
}

export interface DetailedMarketStructure {
  state: StructureType;
  confidence: number; // 0 - 100 based on swing clarity
  recentSwingHigh: number;
  recentSwingLow: number;
  keySupport: number;
  keyResistance: number;
  supportLevels: number[];
  resistanceLevels: number[];
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  lastBreakType: 'NONE' | 'BULLISH_BOS' | 'BEARISH_BOS';
  distanceToSupportPct: number;
  distanceToResistancePct: number;
}

export class MarketStructureEngine {
  /**
   * Deterministically analyzes market structure, fractal swings, and authentic S/R levels.
   * Completely avoids arbitrary price * 0.97 / 1.03 heuristics.
   */
  public static analyze(candles: Candle[], fractalWindow = 3): DetailedMarketStructure {
    if (!candles || candles.length < 15) {
      const p = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
      return {
        state: 'UNCERTAIN',
        confidence: 0,
        recentSwingHigh: p,
        recentSwingLow: p,
        keySupport: p,
        keyResistance: p,
        supportLevels: [],
        resistanceLevels: [],
        swingHighs: [],
        swingLows: [],
        lastBreakType: 'NONE',
        distanceToSupportPct: 0,
        distanceToResistancePct: 0,
      };
    }

    const n = candles.length;
    const currentPrice = candles[n - 1].close;
    const swingHighs: SwingPoint[] = [];
    const swingLows: SwingPoint[] = [];

    // 1. Identify fractal extrema
    const w = Math.max(2, fractalWindow);
    for (let i = w; i < n - w; i++) {
      const cur = candles[i];

      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= w; j++) {
        if (candles[i - j].high >= cur.high || candles[i + j].high > cur.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= cur.low || candles[i + j].low < cur.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        swingHighs.push({
          index: i,
          time: cur.time,
          price: cur.high,
          type: 'HIGH',
        });
      }
      if (isLow) {
        swingLows.push({
          index: i,
          time: cur.time,
          price: cur.low,
          type: 'LOW',
        });
      }
    }

    // 2. Classify HH, HL, LH, LL
    for (let i = 1; i < swingHighs.length; i++) {
      swingHighs[i].tag = swingHighs[i].price >= swingHighs[i - 1].price ? 'HH' : 'LH';
    }
    for (let i = 1; i < swingLows.length; i++) {
      swingLows[i].tag = swingLows[i].price >= swingLows[i - 1].price ? 'HL' : 'LL';
    }

    const recentHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : currentPrice;
    const recentLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : currentPrice;

    // 3. Determine authentic Support and Resistance clusters
    const allLowsBelow = swingLows.filter((s) => s.price < currentPrice).map((s) => s.price);
    const allHighsAbove = swingHighs.filter((s) => s.price > currentPrice).map((s) => s.price);

    const supportLevels = Array.from(new Set(allLowsBelow)).sort((a, b) => b - a); // descending
    const resistanceLevels = Array.from(new Set(allHighsAbove)).sort((a, b) => a - b); // ascending

    const keySupport = supportLevels.length > 0 ? supportLevels[0] : recentLow;
    const keyResistance = resistanceLevels.length > 0 ? resistanceLevels[0] : recentHigh;

    const distanceToSupportPct = keySupport > 0 ? Math.round(((currentPrice - keySupport) / currentPrice) * 10000) / 100 : 0;
    const distanceToResistancePct = currentPrice > 0 ? Math.round(((keyResistance - currentPrice) / currentPrice) * 10000) / 100 : 0;

    // 4. Structural Break of Structure (BOS) and state detection
    let state: StructureType = 'RANGE';
    let lastBreakType: 'NONE' | 'BULLISH_BOS' | 'BEARISH_BOS' = 'NONE';
    let confidence = 50;

    const hasEnoughSwings = swingHighs.length >= 2 && swingLows.length >= 2;

    if (!hasEnoughSwings) {
      state = 'UNCERTAIN';
      confidence = 25;
    } else {
      const lastHigh = swingHighs[swingHighs.length - 1];
      const prevHigh = swingHighs[swingHighs.length - 2];
      const lastLow = swingLows[swingLows.length - 1];
      const prevLow = swingLows[swingLows.length - 2];

      const isHH = lastHigh.price > prevHigh.price;
      const isHL = lastLow.price > prevLow.price;
      const isLH = lastHigh.price < prevHigh.price;
      const isLL = lastLow.price < prevLow.price;

      // Breakout thrust check
      if (currentPrice > lastHigh.price && currentPrice > prevHigh.price) {
        state = 'BREAKOUT';
        lastBreakType = 'BULLISH_BOS';
        confidence = 82;
      } else if (currentPrice < lastLow.price && currentPrice < prevLow.price) {
        state = 'BREAKDOWN';
        lastBreakType = 'BEARISH_BOS';
        confidence = 82;
      } else if (isHH && isHL) {
        state = 'BULLISH_STRUCTURE';
        lastBreakType = 'BULLISH_BOS';
        confidence = 78;
      } else if (isLH && isLL) {
        state = 'BEARISH_STRUCTURE';
        lastBreakType = 'BEARISH_BOS';
        confidence = 78;
      } else {
        state = 'RANGE';
        confidence = 65;
      }
    }

    return {
      state,
      confidence,
      recentSwingHigh: Math.round(recentHigh * 10000) / 10000,
      recentSwingLow: Math.round(recentLow * 10000) / 10000,
      keySupport: Math.round(keySupport * 10000) / 10000,
      keyResistance: Math.round(keyResistance * 10000) / 10000,
      supportLevels: supportLevels.slice(0, 3).map((p) => Math.round(p * 10000) / 10000),
      resistanceLevels: resistanceLevels.slice(0, 3).map((p) => Math.round(p * 10000) / 10000),
      swingHighs,
      swingLows,
      lastBreakType,
      distanceToSupportPct,
      distanceToResistancePct,
    };
  }
}
