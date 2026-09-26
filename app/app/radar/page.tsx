'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { ArrowUpRight, Crosshair, Radio, Sparkles } from 'lucide-react';

export default function OpportunityRadarPage() {
  const [selectedAsset, setSelectedAsset] = useState<string>('BTCUSDT');

  // Enriched radar points
  const radarPoints = DEFAULT_ASSETS.map((asset) => {
    // Momentum calculation relative to 24h change & volatility
    const momentum = asset.change24h; // X: -5% to +10%
    const volatility = asset.volatility; // Y: 0.5% to 6%
    const size = asset.category === 'CRYPTO' ? 48 : asset.category === 'EQUITIES' ? 40 : 36;
    const isBull = asset.change24h >= 0;

    return {
      asset,
      momentum,
      volatility,
      size,
      isBull,
    };
  });

  const activeAssetData = radarPoints.find((r) => r.asset.symbol === selectedAsset) || radarPoints[0];

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol={selectedAsset}
        onSelectSymbol={setSelectedAsset}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#162032] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Opportunity Radar &amp; Market Dispersion Map
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              2D cross-asset mapping: X-Axis = Directional Momentum, Y-Axis = ATR Volatility, Bubble Size = Volume / Depth.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Bullish Momentum
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Bearish Drag
            </span>
          </div>
        </div>

        {/* 2D Canvas / Map Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 terminal-card p-6 min-h-[460px] relative overflow-hidden flex flex-col justify-between">
            {/* Quadrant Watermarks */}
            <div className="absolute top-4 left-6 text-[10px] uppercase font-bold text-slate-400 pointer-events-none">
              High Volatility / Pullback Risk
            </div>
            <div className="absolute top-4 right-6 text-[10px] uppercase font-bold text-emerald-500/40 pointer-events-none">
              High Volatility / Aggressive Expansion
            </div>
            <div className="absolute bottom-6 left-6 text-[10px] uppercase font-bold text-slate-400 pointer-events-none">
              Compression / Low Conviction
            </div>
            <div className="absolute bottom-6 right-6 text-[10px] uppercase font-bold text-indigo-500/40 pointer-events-none">
              Stable Drift / Accumulation
            </div>

            {/* Grid Crosshair Axis Lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#162032]" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#162032]" />

            {/* Interactive Bubbles */}
            <div className="relative w-full h-[380px]">
              {radarPoints.map((pt) => {
                // Map momentum (-6 to +6) to 5% - 95% X
                const normX = Math.max(8, Math.min(92, 50 + pt.momentum * 7.5));
                // Map volatility (0 to 6) to 90% - 10% Y (higher vol = top)
                const normY = Math.max(10, Math.min(90, 85 - (pt.volatility / 6.0) * 75));
                const isSelected = pt.asset.symbol === selectedAsset;

                return (
                  <button
                    key={pt.asset.symbol}
                    onClick={() => setSelectedAsset(pt.asset.symbol)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-all duration-300 hover:scale-125 z-10 ${
                      isSelected ? 'ring-2 ring-indigo-400 shadow-ai-glow scale-110 z-20' : ''
                    } ${
                      pt.isBull
                        ? 'bg-emerald-950/80 border-2 border-emerald-500 text-emerald-300'
                        : 'bg-rose-950/80 border-2 border-rose-500 text-rose-300'
                    }`}
                    style={{
                      left: `${normX}%`,
                      top: `${normY}%`,
                      width: `${pt.size}px`,
                      height: `${pt.size}px`,
                    }}
                  >
                    <span className="font-extrabold text-[10px] tracking-tight">{pt.asset.symbol.slice(0, 4)}</span>
                    <span className="text-[8px] font-tabular font-bold">
                      {pt.momentum >= 0 ? '+' : ''}{pt.momentum}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Axis Labels */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-[#162032] z-10">
              <span>← Bearish Outflow</span>
              <span className="font-bold text-slate-300 uppercase">Momentum Velocity (X)</span>
              <span>Bullish Expansion →</span>
            </div>
          </div>

          {/* Selected Asset Deep Dive Card */}
          <div className="terminal-card p-5 text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#162032] mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Radar Focus Inspector
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold text-[10px]">
                  {activeAssetData.asset.category}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xl font-black text-slate-100">{activeAssetData.asset.symbol}</h2>
                  <div className="text-right font-tabular">
                    <div className="text-base font-bold text-slate-100">
                      ${activeAssetData.asset.price.toLocaleString()}
                    </div>
                    <div className={`text-xs font-semibold ${
                      activeAssetData.isBull ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {activeAssetData.isBull ? '+' : ''}{activeAssetData.asset.change24h}%
                    </div>
                  </div>
                </div>
                <p className="text-slate-400 text-[11px]">{activeAssetData.asset.name}</p>
              </div>

              <div className="space-y-2.5 font-tabular border-t border-[#162032] pt-3 mb-4">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Current Regime:</span>
                  <span className="font-semibold text-emerald-400">
                    {activeAssetData.asset.regime.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">ATR Volatility Index:</span>
                  <span className="font-semibold text-slate-200">{activeAssetData.asset.volatility}%</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">24H Trading Volume:</span>
                  <span className="font-semibold text-slate-200">{activeAssetData.asset.volume24h}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Directional Bias:</span>
                  <span className="font-semibold text-indigo-300">{activeAssetData.asset.signalState}</span>
                </div>
              </div>
            </div>

            <Link
              href="/app"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-center text-xs flex items-center justify-center gap-1.5 shadow-ai-glow transition-all"
            >
              <span>Load in Full Intelligence Terminal</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
