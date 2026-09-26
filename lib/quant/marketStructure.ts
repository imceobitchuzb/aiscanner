import { Candle, MarketStructure } from '../types';

export function detectMarketStructure(candles: Candle[]): MarketStructure {
  if (candles.length < 20) {
    const p = candles[candles.length - 1]?.close || 100;
    return {
      trend: 'SIDEWAYS',
      keySupport: p * 0.98,
      keyResistance: p * 1.02,
      fairValueGaps: [],
      orderBlocks: [],
      liquidityPools: [],
      pivotPoints: { r2: p * 1.04, r1: p * 1.02, pp: p, s1: p * 0.98, s2: p * 0.96 },
    };
  }

  const swingHighs: { index: number; price: number }[] = [];
  const swingLows: { index: number; price: number }[] = [];

  // Fractal swing detection (window = 3)
  for (let i = 3; i < candles.length - 3; i++) {
    const c = candles[i];
    const isHigh =
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high;

    const isLow =
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low;

    if (isHigh) swingHighs.push({ index: i, price: c.high });
    if (isLow) swingLows.push({ index: i, price: c.low });
  }

  // Determine structural trend based on Higher Highs / Higher Lows
  let trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1].price;
    const prevHigh = swingHighs[swingHighs.length - 2].price;
    const lastLow = swingLows[swingLows.length - 1].price;
    const prevLow = swingLows[swingLows.length - 2].price;

    if (lastHigh > prevHigh && lastLow > prevLow) {
      trend = 'UPTREND';
    } else if (lastHigh < prevHigh && lastLow < prevLow) {
      trend = 'DOWNTREND';
    }
  }

  const currentPrice = candles[candles.length - 1].close;

  // Key Support & Resistance (nearest swings)
  const supportsBelow = swingLows.filter((s) => s.price < currentPrice).map((s) => s.price);
  const resistancesAbove = swingHighs.filter((s) => s.price > currentPrice).map((s) => s.price);

  const keySupport = supportsBelow.length > 0 
    ? Math.max(...supportsBelow) 
    : currentPrice * 0.97;

  const keyResistance = resistancesAbove.length > 0 
    ? Math.min(...resistancesAbove) 
    : currentPrice * 1.03;

  // Fair Value Gaps (FVG)
  const fairValueGaps: MarketStructure['fairValueGaps'] = [];
  for (let i = candles.length - 20; i < candles.length; i++) {
    if (i < 2) continue;
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG: candle 1 high < candle 3 low
    if (c3.low > c1.high) {
      fairValueGaps.push({
        high: c3.low,
        low: c1.high,
        type: 'BULLISH',
      });
    }
    // Bearish FVG: candle 1 low > candle 3 high
    else if (c1.low > c3.high) {
      fairValueGaps.push({
        high: c1.low,
        low: c3.high,
        type: 'BEARISH',
      });
    }
  }

  // Order Blocks (OB)
  const orderBlocks: MarketStructure['orderBlocks'] = [];
  for (let i = Math.max(5, candles.length - 25); i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];

    // Bullish Order Block: down candle followed by strong upward impulse
    if (c.close < c.open && (next.close - next.open) > (c.high - c.low) * 1.3) {
      orderBlocks.push({
        high: c.high,
        low: c.low,
        type: 'BULLISH',
      });
    }
    // Bearish Order Block: up candle followed by strong downward impulse
    else if (c.close > c.open && (next.open - next.close) > (c.high - c.low) * 1.3) {
      orderBlocks.push({
        high: c.high,
        low: c.low,
        type: 'BEARISH',
      });
    }
  }

  // Liquidity pools (clustering of highs / lows)
  const liquidityPools: MarketStructure['liquidityPools'] = [];
  if (swingHighs.length > 0) {
    const topHigh = Math.max(...swingHighs.map((s) => s.price));
    liquidityPools.push({ price: topHigh, type: 'BUY_SIDE' });
  }
  if (swingLows.length > 0) {
    const bottomLow = Math.min(...swingLows.map((s) => s.price));
    liquidityPools.push({ price: bottomLow, type: 'SELL_SIDE' });
  }

  // Classical Floor Trader Pivot Points
  const lastCompleted = candles[candles.length - 2] || candles[candles.length - 1];
  const high = lastCompleted.high;
  const low = lastCompleted.low;
  const close = lastCompleted.close;

  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  const r2 = pp + (high - low);
  const s2 = pp - (high - low);

  return {
    trend,
    keySupport,
    keyResistance,
    fairValueGaps: fairValueGaps.slice(-4),
    orderBlocks: orderBlocks.slice(-4),
    liquidityPools,
    pivotPoints: { r2, r1, pp, s1, s2 },
  };
}
