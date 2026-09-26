'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Candle, IndicatorSnapshot, MarketStructure, Timeframe } from '@/lib/types';
import { 
  BarChart2, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  Settings2, 
  SlidersHorizontal 
} from 'lucide-react';
import { 
  calculateBollingerBands, 
  calculateEMA, 
  calculateMACD, 
  calculateRSI, 
  calculateSupertrend, 
  calculateVWAP 
} from '@/lib/quant/indicators';

interface AdvancedChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  structure: MarketStructure;
  snapshot: IndicatorSnapshot;
}

export const AdvancedChart: React.FC<AdvancedChartProps> = ({
  candles,
  symbol,
  timeframe,
  onTimeframeChange,
  structure,
  snapshot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Indicator Visibility Toggles
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showSupertrend, setShowSupertrend] = useState(true);
  const [showStructure, setShowStructure] = useState(true);
  const [showPivots, setShowPivots] = useState(false);
  const [bottomOscillator, setBottomOscillator] = useState<'RSI' | 'MACD' | 'NONE'>('RSI');
  const [indicatorsMenuOpen, setIndicatorsMenuOpen] = useState(false);

  // Mouse hover crosshair state
  const [hoverData, setHoverData] = useState<{
    candle: Candle | null;
    x: number;
    y: number;
    price: number;
  }>({ candle: null, x: -1, y: -1, price: 0 });

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

  // Render chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 480;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Layout configuration
    const oscillatorHeight = bottomOscillator === 'NONE' ? 0 : 100;
    const mainHeight = height - oscillatorHeight - 24; // 24 for time axis
    const rightPriceAxisWidth = 65;
    const chartWidth = width - rightPriceAxisWidth;

    // Clear canvas
    ctx.fillStyle = '#06080F';
    ctx.fillRect(0, 0, width, height);

    // Compute price range
    const closes = candles.map((c) => c.close);
    let minPrice = Math.min(...candles.map((c) => c.low));
    let maxPrice = Math.max(...candles.map((c) => c.high));

    // Pad price range
    const pricePadding = (maxPrice - minPrice) * 0.05 || 1;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice || 1;

    // Helper: price to Y coordinate
    const priceToY = (price: number) => {
      return mainHeight - ((price - minPrice) / priceRange) * mainHeight;
    };

    // Helper: candle index to X coordinate
    const candleWidth = chartWidth / candles.length;
    const indexToX = (index: number) => index * candleWidth + candleWidth / 2;

    // 1. Draw Background Grid
    ctx.strokeStyle = '#121826';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal price grid lines
    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange / gridSteps) * i;
      const y = priceToY(p);
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);

      // Price label on right axis
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, chartWidth + 6, y + 3);
    }
    ctx.stroke();

    // 2. Market Structure Overlays (Order Blocks & Fair Value Gaps)
    if (showStructure) {
      // Order blocks
      structure.orderBlocks.forEach((ob) => {
        const topY = priceToY(ob.high);
        const botY = priceToY(ob.low);
        const obHeight = Math.max(2, botY - topY);

        ctx.fillStyle = ob.type === 'BULLISH' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
        ctx.fillRect(chartWidth * 0.45, topY, chartWidth * 0.55, obHeight);
        ctx.strokeStyle = ob.type === 'BULLISH' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartWidth * 0.45, topY, chartWidth * 0.55, obHeight);

        ctx.fillStyle = ob.type === 'BULLISH' ? '#34D399' : '#FB7185';
        ctx.font = '9px sans-serif';
        ctx.fillText(ob.type === 'BULLISH' ? '+OB (Demand)' : '-OB (Supply)', chartWidth * 0.47, topY + 10);
      });

      // Support & Resistance horizontal lines
      ctx.setLineDash([4, 4]);
      // Key Resistance
      ctx.strokeStyle = '#F43F5E';
      const resY = priceToY(structure.keyResistance);
      ctx.beginPath();
      ctx.moveTo(0, resY);
      ctx.lineTo(chartWidth, resY);
      ctx.stroke();

      // Key Support
      ctx.strokeStyle = '#10B981';
      const supY = priceToY(structure.keySupport);
      ctx.beginPath();
      ctx.moveTo(0, supY);
      ctx.lineTo(chartWidth, supY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Bollinger Bands
    if (showBollinger) {
      const bb = calculateBollingerBands(closes, 20, 2);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < candles.length; i++) {
        if (!isNaN(bb.upper[i])) {
          const x = indexToX(i);
          const y = priceToY(bb.upper[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < candles.length; i++) {
        if (!isNaN(bb.lower[i])) {
          const x = indexToX(i);
          const y = priceToY(bb.lower[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 4. Moving Averages & VWAP
    const drawIndicatorLine = (data: number[], color: string, widthPx = 1.5) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      let started = false;
      for (let i = 0; i < candles.length; i++) {
        if (!isNaN(data[i])) {
          const x = indexToX(i);
          const y = priceToY(data[i]);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    };

    if (showEMA20) drawIndicatorLine(calculateEMA(closes, 20), '#38BDF8', 1.5); // Sky Blue
    if (showEMA50) drawIndicatorLine(calculateEMA(closes, 50), '#F59E0B', 1.5); // Amber
    if (showEMA200) drawIndicatorLine(calculateEMA(closes, 200), '#EC4899', 1.5); // Pink
    if (showVWAP) drawIndicatorLine(calculateVWAP(candles), '#A855F7', 1.5); // Purple

    // 5. Volume bars at bottom of main chart
    const maxVolume = Math.max(...candles.map((c) => c.volume)) || 1;
    const volHeight = mainHeight * 0.2;
    candles.forEach((c, i) => {
      const isUp = c.close >= c.open;
      const x = indexToX(i);
      const barH = (c.volume / maxVolume) * volHeight;
      const y = mainHeight - barH;
      ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.22)';
      ctx.fillRect(x - candleWidth * 0.35, y, candleWidth * 0.7, barH);
    });

    // 6. Candlesticks (Wicks + Bodies)
    candles.forEach((c, i) => {
      const isUp = c.close >= c.open;
      const x = indexToX(i);
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);

      const color = isUp ? '#10B981' : '#F43F5E';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Wick
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      const bodyWidth = Math.max(2, candleWidth * 0.7);
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // 7. Current Price Horizontal Marker
    const lastPrice = candles[candles.length - 1].close;
    const currentPriceY = priceToY(lastPrice);
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, currentPriceY);
    ctx.lineTo(chartWidth, currentPriceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current price badge on axis
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(chartWidth + 1, currentPriceY - 9, rightPriceAxisWidth - 2, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`$${lastPrice.toFixed(2)}`, chartWidth + 5, currentPriceY + 4);

    // 8. Oscillator Panel (RSI or MACD)
    if (bottomOscillator !== 'NONE') {
      const oscTopY = mainHeight + 20;
      const oscInnerHeight = oscillatorHeight - 20;

      // Divider line
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mainHeight);
      ctx.lineTo(width, mainHeight);
      ctx.stroke();

      if (bottomOscillator === 'RSI') {
        const rsiValues = calculateRSI(closes, 14);

        // RSI 70 and 30 reference lines
        const rsiToY = (val: number) => oscTopY + oscInnerHeight - (val / 100) * oscInnerHeight;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, rsiToY(70));
        ctx.lineTo(chartWidth, rsiToY(70));
        ctx.stroke();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, rsiToY(30));
        ctx.lineTo(chartWidth, rsiToY(30));
        ctx.stroke();

        // RSI Line
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let rsiStarted = false;
        for (let i = 0; i < candles.length; i++) {
          if (!isNaN(rsiValues[i])) {
            const x = indexToX(i);
            const y = rsiToY(rsiValues[i]);
            if (!rsiStarted) {
              ctx.moveTo(x, y);
              rsiStarted = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();

        // Label
        const lastRsi = rsiValues[rsiValues.length - 1] || 50;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px monospace';
        ctx.fillText(`RSI(14): ${lastRsi.toFixed(1)}`, 8, oscTopY + 12);
      } else if (bottomOscillator === 'MACD') {
        const { macdLine, signalLine, histogram } = calculateMACD(closes);
        const maxMacd = Math.max(...histogram.map((h) => Math.abs(h))) || 1;
        const macdCenterY = oscTopY + oscInnerHeight / 2;

        // Histogram bars
        candles.forEach((_, i) => {
          const h = histogram[i];
          if (!isNaN(h)) {
            const x = indexToX(i);
            const barH = (h / maxMacd) * (oscInnerHeight / 2);
            ctx.fillStyle = h >= 0 ? '#10B981' : '#F43F5E';
            ctx.fillRect(x - candleWidth * 0.3, macdCenterY - barH, candleWidth * 0.6, barH);
          }
        });

        // Label
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px monospace';
        ctx.fillText(`MACD(12,26,9)`, 8, oscTopY + 12);
      }
    }

    // 9. Interactive Crosshair Hover
    if (hoverData.x > 0 && hoverData.x < chartWidth && hoverData.y > 0 && hoverData.y < mainHeight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverData.x, 0);
      ctx.lineTo(hoverData.x, height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, hoverData.y);
      ctx.lineTo(chartWidth, hoverData.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    candles,
    bottomOscillator,
    showEMA20,
    showEMA50,
    showEMA200,
    showVWAP,
    showBollinger,
    showSupertrend,
    showStructure,
    showPivots,
    hoverData,
  ]);

  // Handle canvas mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = rect.width - 65;
    const candleWidth = chartWidth / candles.length;
    const index = Math.floor(x / candleWidth);

    if (index >= 0 && index < candles.length) {
      setHoverData({
        candle: candles[index],
        x,
        y,
        price: 0,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverData({ candle: null, x: -1, y: -1, price: 0 });
  };

  const activeCandle = hoverData.candle || candles[candles.length - 1];

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#070B14] select-none text-xs relative">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-[#162032] bg-[#090E1A] gap-2">
        {/* Left: Symbol & Timeframes */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-100">{symbol}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-700/50 text-[10px] text-indigo-300 font-semibold">
              INDEX
            </span>
          </div>

          <div className="h-3 w-px bg-[#1E293B]" />

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-0.5 bg-[#050810] p-0.5 rounded border border-[#162032]">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  timeframe === tf
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#121A2A]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live Hover OHLCV */}
        {activeCandle && (
          <div className="hidden md:flex items-center gap-3 font-tabular text-[11px] text-slate-400">
            <span>O: <strong className="text-slate-200">${activeCandle.open.toFixed(2)}</strong></span>
            <span>H: <strong className="text-emerald-400">${activeCandle.high.toFixed(2)}</strong></span>
            <span>L: <strong className="text-rose-400">${activeCandle.low.toFixed(2)}</strong></span>
            <span>C: <strong className="text-slate-200">${activeCandle.close.toFixed(2)}</strong></span>
            <span>V: <strong className="text-slate-300">{activeCandle.volume.toLocaleString()}</strong></span>
          </div>
        )}

        {/* Right: Indicator Controls & Sub-panels */}
        <div className="flex items-center gap-2">
          {/* Bottom Oscillator Switcher */}
          <div className="flex items-center bg-[#050810] rounded border border-[#162032] p-0.5 text-[10px]">
            <button
              onClick={() => setBottomOscillator('RSI')}
              className={`px-2 py-0.5 rounded font-medium ${
                bottomOscillator === 'RSI' ? 'bg-[#1E293B] text-indigo-300' : 'text-slate-400'
              }`}
            >
              RSI
            </button>
            <button
              onClick={() => setBottomOscillator('MACD')}
              className={`px-2 py-0.5 rounded font-medium ${
                bottomOscillator === 'MACD' ? 'bg-[#1E293B] text-indigo-300' : 'text-slate-400'
              }`}
            >
              MACD
            </button>
            <button
              onClick={() => setBottomOscillator('NONE')}
              className={`px-2 py-0.5 rounded font-medium ${
                bottomOscillator === 'NONE' ? 'bg-[#1E293B] text-slate-200' : 'text-slate-500'
              }`}
            >
              OFF
            </button>
          </div>

          {/* Indicators Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIndicatorsMenuOpen(!indicatorsMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0B0F19] border border-[#1E293B] text-slate-300 hover:bg-[#121A2A]"
            >
              <SlidersHorizontal className="h-3 w-3 text-indigo-400" />
              <span className="font-bold text-[11px]">Индикаторы</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {indicatorsMenuOpen && (
              <div 
                className="absolute right-0 mt-1 w-64 bg-[#0A0E1A] border border-[#1E293B] rounded-lg shadow-terminal p-2 z-50 space-y-1"
                onMouseLeave={() => setIndicatorsMenuOpen(false)}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 border-b border-[#162032]">
                  Слои индикаторов и структуры
                </div>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-sky-400 font-medium">EMA 20 (Быстрая скользящая)</span>
                  <input
                    type="checkbox"
                    checked={showEMA20}
                    onChange={(e) => setShowEMA20(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-amber-400 font-medium">EMA 50 (Средний тренд)</span>
                  <input
                    type="checkbox"
                    checked={showEMA50}
                    onChange={(e) => setShowEMA50(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-pink-400 font-medium">EMA 200 (Базовый тренд)</span>
                  <input
                    type="checkbox"
                    checked={showEMA200}
                    onChange={(e) => setShowEMA200(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-purple-400 font-medium">VWAP (Средневзвешенная)</span>
                  <input
                    type="checkbox"
                    checked={showVWAP}
                    onChange={(e) => setShowVWAP(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-indigo-400 font-medium">Полосы Боллинджера (20, 2)</span>
                  <input
                    type="checkbox"
                    checked={showBollinger}
                    onChange={(e) => setShowBollinger(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>

                <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#121A2A] cursor-pointer">
                  <span className="text-emerald-400 font-medium">Структура и Order Blocks</span>
                  <input
                    type="checkbox"
                    checked={showStructure}
                    onChange={(e) => setShowStructure(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 w-full relative min-h-[380px] overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Legend Overlay */}
        <div className="absolute top-2 left-3 flex items-center gap-3 bg-[#070A12]/80 px-2 py-1 rounded border border-[#162032] text-[10px] pointer-events-none">
          {showEMA20 && <span className="text-sky-400 font-medium">EMA 20: ${snapshot.ema20.toFixed(2)}</span>}
          {showEMA50 && <span className="text-amber-400 font-medium">EMA 50: ${snapshot.ema50.toFixed(2)}</span>}
          {showVWAP && <span className="text-purple-400 font-medium">VWAP: ${snapshot.vwap.toFixed(2)}</span>}
          <span className="text-slate-400">ATR(14): ${snapshot.atr14.toFixed(2)}</span>
          <span className="text-slate-400">ADX: {snapshot.adx14.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
