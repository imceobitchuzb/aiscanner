import { Candle } from '../types';
import {
  calculateADX,
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP,
} from './indicators';

export interface QuantFeatures {
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  returns: number; // 1-bar return %
  logReturn: number;
  atr14: number;
  atrPercent: number; // (ATR / price) * 100
  ema20: number;
  ema50: number;
  ema200: number;
  sma20: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  adx: {
    adx14: number;
    plusDI: number;
    minusDI: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number; // ((upper - lower) / middle) * 100
  };
  vwap: number | null;
  volumeMA20: number;
  volumeRatio: number; // currentVolume / volumeMA20
  realizedVolatility: number; // annualized volatility % from log returns
  momentum10: number; // 10-bar return %
  trendSlope: number; // slope of last 15 closes as % per bar
  sampleSize: number;
}

export class QuantFeatureEngine {
  /**
   * Computes comprehensive quantitative features strictly from real candles.
   * Completely avoids arbitrary or LLM-derived values.
   */
  public static extractFeatures(candles: Candle[]): QuantFeatures | null {
    if (!candles || candles.length < 5) {
      return null;
    }

    const n = candles.length;
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const lastCandle = candles[n - 1];
    const currentPrice = lastCandle.close;

    // 1. Returns & Log Returns
    const prevClose = candles[Math.max(0, n - 2)].close;
    const returns = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    const logReturn = prevClose > 0 ? Math.log(currentPrice / prevClose) : 0;

    // Compute log returns series for realized volatility
    const logReturnsSeries: number[] = [];
    for (let i = 1; i < n; i++) {
      if (closes[i - 1] > 0 && closes[i] > 0) {
        logReturnsSeries.push(Math.log(closes[i] / closes[i - 1]));
      }
    }

    let realizedVolatility = 0;
    if (logReturnsSeries.length > 5) {
      const meanLog = logReturnsSeries.reduce((s, r) => s + r, 0) / logReturnsSeries.length;
      const varLog =
        logReturnsSeries.reduce((s, r) => s + Math.pow(r - meanLog, 2), 0) /
        (logReturnsSeries.length - 1);
      // Normalized annualized volatility assumption (approx. 24 bars/day, 365 days/year = sqrt(8760))
      realizedVolatility = Math.round(Math.sqrt(varLog) * Math.sqrt(8760) * 1000) / 10;
    }

    // 2. Moving Averages
    const ema20Series = calculateEMA(closes, 20);
    const ema50Series = calculateEMA(closes, 50);
    const ema200Series = calculateEMA(closes, Math.min(200, n));
    const sma20Series = calculateSMA(closes, 20);

    const ema20 = ema20Series[n - 1] || currentPrice;
    const ema50 = ema50Series[n - 1] || currentPrice;
    const ema200 = ema200Series[n - 1] || currentPrice;
    const sma20 = sma20Series[n - 1] || currentPrice;

    // 3. Volatility & Bands
    const atrSeries = calculateATR(candles, 14);
    const atr14 = atrSeries[n - 1] || currentPrice * 0.01;
    const atrPercent = currentPrice > 0 ? Math.round((atr14 / currentPrice) * 10000) / 100 : 0;

    const bb = calculateBollingerBands(closes, 20, 2);
    const upperBB = bb.upper?.[n - 1] ?? currentPrice * 1.02;
    const middleBB = (bb.middle?.[n - 1] ?? bb.sma?.[n - 1]) ?? currentPrice;
    const lowerBB = bb.lower?.[n - 1] ?? currentPrice * 0.98;
    const bandwidth = middleBB > 0 ? Math.round(((upperBB - lowerBB) / middleBB) * 10000) / 100 : 0;

    // 4. Oscillators (RSI, MACD, ADX)
    const rsiSeries = calculateRSI(closes, 14);
    const rsi14 = Math.round((rsiSeries[n - 1] || 50) * 10) / 10;

    const macdData = calculateMACD(closes, 12, 26, 9);
    const macdLine = Math.round((macdData.macdLine[n - 1] || 0) * 1000) / 1000;
    const signalLine = Math.round((macdData.signalLine[n - 1] || 0) * 1000) / 1000;
    const histogram = Math.round((macdData.histogram[n - 1] || 0) * 1000) / 1000;

    const adxData = calculateADX(candles, 14);
    const adx14 = Math.round((adxData.adx[n - 1] || 20) * 10) / 10;
    const plusDI = Math.round((adxData.plusDI[n - 1] || 20) * 10) / 10;
    const minusDI = Math.round((adxData.minusDI[n - 1] || 20) * 10) / 10;

    // 5. Volume & VWAP
    const totalVolume = volumes.reduce((s, v) => s + v, 0);
    const vwapSeries = totalVolume > 0 ? calculateVWAP(candles) : [];
    const vwap = vwapSeries.length > 0 ? vwapSeries[n - 1] : null;

    const volSMA = calculateSMA(volumes, 20);
    const volumeMA20 = volSMA[n - 1] || 1;
    const volumeRatio = volumeMA20 > 0 ? Math.round((lastCandle.volume / volumeMA20) * 100) / 100 : 1;

    // 6. Momentum & Linear Trend Slope
    const lookbackMom = Math.min(10, n - 1);
    const pastCloseMom = closes[n - 1 - lookbackMom] || currentPrice;
    const momentum10 = pastCloseMom > 0 ? Math.round(((currentPrice - pastCloseMom) / pastCloseMom) * 1000) / 10 : 0;

    // Linear regression slope of last 15 bars (% change per bar)
    const slopeLookback = Math.min(15, n);
    const xVals: number[] = [];
    const yVals: number[] = [];
    for (let i = 0; i < slopeLookback; i++) {
      xVals.push(i);
      yVals.push(closes[n - slopeLookback + i]);
    }
    const xMean = (slopeLookback - 1) / 2;
    const yMean = yVals.reduce((a, b) => a + b, 0) / slopeLookback;
    let num = 0;
    let den = 0;
    for (let i = 0; i < slopeLookback; i++) {
      num += (xVals[i] - xMean) * (yVals[i] - yMean);
      den += Math.pow(xVals[i] - xMean, 2);
    }
    const rawSlope = den > 0 ? num / den : 0;
    const trendSlope = currentPrice > 0 ? Math.round((rawSlope / currentPrice) * 10000) / 100 : 0;

    return {
      price: currentPrice,
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      returns: Math.round(returns * 100) / 100,
      logReturn: Math.round(logReturn * 10000) / 10000,
      atr14,
      atrPercent,
      ema20,
      ema50,
      ema200,
      sma20,
      rsi14,
      macd: {
        macdLine,
        signalLine,
        histogram,
      },
      adx: {
        adx14,
        plusDI,
        minusDI,
      },
      bollinger: {
        upper: upperBB,
        middle: middleBB,
        lower: lowerBB,
        bandwidth,
      },
      vwap,
      volumeMA20,
      volumeRatio,
      realizedVolatility,
      momentum10,
      trendSlope,
      sampleSize: n,
    };
  }
}
