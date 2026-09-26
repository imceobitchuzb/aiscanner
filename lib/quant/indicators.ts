import { Candle, IndicatorSnapshot } from '../types';

export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let ema = data[0] || 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[0]);
      ema = data[0];
    } else {
      ema = data[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

export function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return closes.map(() => 50);

  const rsi: number[] = new Array(closes.length).fill(NaN);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2) {
  const sma = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(sma[i])) {
      upper.push(NaN);
      lower.push(NaN);
      bandwidth.push(NaN);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const up = mean + multiplier * stdDev;
    const low = mean - multiplier * stdDev;
    upper.push(up);
    lower.push(low);
    bandwidth.push(mean !== 0 ? ((up - low) / mean) * 100 : 0);
  }

  return { sma, middle: sma, upper, lower, bandwidth };
}

export function calculateATR(candles: Candle[], period = 14): number[] {
  if (candles.length === 0) return [];
  const tr: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const highLow = candles[i].high - candles[i].low;
      const highClose = Math.abs(candles[i].high - candles[i - 1].close);
      const lowClose = Math.abs(candles[i].low - candles[i - 1].close);
      tr.push(Math.max(highLow, highClose, lowClose));
    }
  }

  const atr: number[] = [];
  let sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let currentAtr = sum / period;

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      atr.push(NaN);
    } else if (i === period - 1) {
      atr.push(currentAtr);
    } else {
      currentAtr = (currentAtr * (period - 1) + tr[i]) / period;
      atr.push(currentAtr);
    }
  }

  return atr;
}

export function calculateADX(candles: Candle[], period = 14) {
  const n = candles.length;
  if (n < period * 2) {
    return {
      adx: new Array(n).fill(20),
      plusDI: new Array(n).fill(20),
      minusDI: new Array(n).fill(20),
    };
  }

  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < n; i++) {
    const highDiff = candles[i].high - candles[i - 1].high;
    const lowDiff = candles[i - 1].low - candles[i].low;

    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

    const highLow = candles[i].high - candles[i].low;
    const highClose = Math.abs(candles[i].high - candles[i - 1].close);
    const lowClose = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(highLow, highClose, lowClose));
  }

  let trSmooth = 0;
  let plusDMSmooth = 0;
  let minusDMSmooth = 0;
  for (let i = 1; i <= period; i++) {
    trSmooth += tr[i];
    plusDMSmooth += plusDM[i];
    minusDMSmooth += minusDM[i];
  }

  const plusDI: number[] = new Array(period).fill(NaN);
  const minusDI: number[] = new Array(period).fill(NaN);
  const dx: number[] = new Array(period).fill(NaN);

  const initialPDI = (plusDMSmooth / (trSmooth || 1)) * 100;
  const initialMDI = (minusDMSmooth / (trSmooth || 1)) * 100;
  plusDI.push(initialPDI);
  minusDI.push(initialMDI);
  dx.push((Math.abs(initialPDI - initialMDI) / ((initialPDI + initialMDI) || 1)) * 100);

  for (let i = period + 1; i < n; i++) {
    trSmooth = trSmooth - trSmooth / period + tr[i];
    plusDMSmooth = plusDMSmooth - plusDMSmooth / period + plusDM[i];
    minusDMSmooth = minusDMSmooth - minusDMSmooth / period + minusDM[i];

    const pDI = (plusDMSmooth / (trSmooth || 1)) * 100;
    const mDI = (minusDMSmooth / (trSmooth || 1)) * 100;
    const currentDx = (Math.abs(pDI - mDI) / ((pDI + mDI) || 1)) * 100;

    plusDI.push(pDI);
    minusDI.push(mDI);
    dx.push(currentDx);
  }

  const adx: number[] = new Array(period * 2 - 1).fill(NaN);
  let dxSum = 0;
  for (let i = period; i < period * 2; i++) {
    dxSum += dx[i] || 0;
  }
  let adxSmooth = dxSum / period;
  adx.push(adxSmooth);

  for (let i = period * 2; i < n; i++) {
    adxSmooth = (adxSmooth * (period - 1) + (dx[i] || 0)) / period;
    adx.push(adxSmooth);
  }

  while (adx.length < n) adx.push(adxSmooth || 20);
  while (plusDI.length < n) plusDI.push(20);
  while (minusDI.length < n) minusDI.push(20);

  return { adx, plusDI, minusDI };
}

export function calculateVWAP(candles: Candle[]): number[] {
  const result: number[] = [];
  let cumulativeTypicalVol = 0;
  let cumulativeVol = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativeTypicalVol += typicalPrice * c.volume;
    cumulativeVol += c.volume;
    result.push(cumulativeVol > 0 ? cumulativeTypicalVol / cumulativeVol : c.close);
  }
  return result;
}

export function calculateSupertrend(candles: Candle[], period = 10, multiplier = 3) {
  const atr = calculateATR(candles, period);
  const supertrend: number[] = [];
  const direction: ('BULL' | 'BEAR')[] = [];

  let prevUpper = 0;
  let prevLower = 0;
  let prevDir: 'BULL' | 'BEAR' = 'BULL';

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const a = atr[i] || (c.high - c.low);
    const hl2 = (c.high + c.low) / 2;

    let basicUpper = hl2 + multiplier * a;
    let basicLower = hl2 - multiplier * a;

    let finalUpper = (basicUpper < prevUpper || candles[i - 1]?.close > prevUpper) ? basicUpper : prevUpper;
    let finalLower = (basicLower > prevLower || candles[i - 1]?.close < prevLower) ? basicLower : prevLower;

    let currentDir: 'BULL' | 'BEAR' = prevDir;
    if (prevDir === 'BULL' && c.close < finalLower) {
      currentDir = 'BEAR';
    } else if (prevDir === 'BEAR' && c.close > finalUpper) {
      currentDir = 'BULL';
    }

    const value = currentDir === 'BULL' ? finalLower : finalUpper;
    supertrend.push(value);
    direction.push(currentDir);

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevDir = currentDir;
  }

  return { supertrend, direction };
}

export function getIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  if (candles.length === 0) {
    return {
      rsi14: 50,
      macd: { macd: 0, signal: 0, histogram: 0 },
      ema20: 0,
      ema50: 0,
      ema200: 0,
      vwap: 0,
      bollinger: { upper: 0, middle: 0, lower: 0, bandwidth: 0 },
      atr14: 0,
      adx14: 25,
      supertrend: { value: 0, direction: 'BULL' },
    };
  }

  const closes = candles.map((c) => c.close);
  const lastIdx = closes.length - 1;

  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr = calculateATR(candles, 14);
  const adxResult = calculateADX(candles, 14);
  const vwap = calculateVWAP(candles);
  const supertrend = calculateSupertrend(candles, 10, 3);

  const cleanLast = (arr: number[], fallback: number) => {
    const val = arr[lastIdx];
    return isNaN(val) || val === undefined ? fallback : val;
  };

  return {
    rsi14: cleanLast(rsi, 50),
    macd: {
      macd: cleanLast(macd.macdLine, 0),
      signal: cleanLast(macd.signalLine, 0),
      histogram: cleanLast(macd.histogram, 0),
    },
    ema20: cleanLast(ema20, closes[lastIdx]),
    ema50: cleanLast(ema50, closes[lastIdx]),
    ema200: cleanLast(ema200, closes[lastIdx]),
    vwap: cleanLast(vwap, closes[lastIdx]),
    bollinger: {
      upper: cleanLast(bb.upper, closes[lastIdx] * 1.02),
      middle: cleanLast(bb.sma, closes[lastIdx]),
      lower: cleanLast(bb.lower, closes[lastIdx] * 0.98),
      bandwidth: cleanLast(bb.bandwidth, 4.0),
    },
    atr14: cleanLast(atr, closes[lastIdx] * 0.015),
    adx14: cleanLast(adxResult.adx, 24),
    supertrend: {
      value: cleanLast(supertrend.supertrend, closes[lastIdx]),
      direction: supertrend.direction[lastIdx] || 'BULL',
    },
  };
}
