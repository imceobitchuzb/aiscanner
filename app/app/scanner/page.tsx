'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { ArrowDownRight, ArrowUpRight, Crosshair, Filter, SlidersHorizontal, TrendingUp } from 'lucide-react';

export default function ScannerPage() {
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(70);
  const [minRR, setMinRR] = useState<number>(2.0);
  const [regimeFilter, setRegimeFilter] = useState<string>('ALL');

  // Generate enriched scanner table from assets
  const scannerRows = DEFAULT_ASSETS.map((asset) => {
    const isBull = asset.regime.includes('BULL') || asset.regime === 'BREAKOUT';
    const direction: 'LONG' | 'SHORT' | 'NEUTRAL' = isBull ? 'LONG' : asset.regime.includes('BEAR') ? 'SHORT' : 'NEUTRAL';
    const confidence = isBull ? 78 : asset.regime.includes('BEAR') ? 74 : 62;
    const rr = isBull ? 2.6 : 2.2;
    const entry = asset.price;
    const sl = isBull ? asset.price * 0.97 : asset.price * 1.03;
    const tp = isBull ? asset.price * 1.065 : asset.price * 0.935;

    return {
      asset,
      direction,
      confidence,
      rr,
      entry,
      sl,
      tp,
      setupAge: '32m ago',
    };
  });

  const filtered = scannerRows.filter((row) => {
    if (directionFilter !== 'ALL' && row.direction !== directionFilter) return false;
    if (row.confidence < minConfidence) return false;
    if (row.rr < minRR) return false;
    if (regimeFilter !== 'ALL' && !row.asset.regime.includes(regimeFilter)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol="BTCUSDT"
        onSelectSymbol={() => {}}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Title & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#162032] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Multi-Asset Opportunity Scanner
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live quantitative algorithmic scanner tracking high-probability setups across crypto, equities, and FX.
            </p>
          </div>

          <div className="flex items-center gap-2 font-tabular text-xs">
            <span className="text-slate-400">Total Matches:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold">
              {filtered.length} Setups
            </span>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="terminal-card p-4 text-xs">
          <div className="flex items-center gap-2 mb-3 text-slate-300 font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
            <span>Quantitative Filter Parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Direction */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Direction</label>
              <div className="flex bg-[#050810] p-0.5 rounded border border-[#162032]">
                {(['ALL', 'LONG', 'SHORT'] as const).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setDirectionFilter(dir)}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                      directionFilter === dir ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Confidence */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Min Confidence: {minConfidence}%
              </label>
              <input
                type="range"
                min="50"
                max="90"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
              />
            </div>

            {/* Min R:R */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Min Reward/Risk: {minRR}x
              </label>
              <input
                type="range"
                min="1.5"
                max="4.0"
                step="0.1"
                value={minRR}
                onChange={(e) => setMinRR(Number(e.target.value))}
                className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
              />
            </div>

            {/* Regime */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Regime Filter</label>
              <select
                value={regimeFilter}
                onChange={(e) => setRegimeFilter(e.target.value)}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 text-xs outline-none"
              >
                <option value="ALL">All Regimes</option>
                <option value="BULL">Trending Bull / Breakout</option>
                <option value="BEAR">Trending Bear / Breakdown</option>
                <option value="RANGE">Range / Mean Reversion</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scanner Results Table */}
        <div className="terminal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-tabular border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#162032] bg-[#070A12] text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-4">Instrument</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">R:R</th>
                  <th className="py-2.5 px-3">Regime</th>
                  <th className="py-2.5 px-3">Volatility</th>
                  <th className="py-2.5 px-3">Entry Zone</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">Target TP</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121A2A]">
                {filtered.map((row) => {
                  const isLong = row.direction === 'LONG';
                  return (
                    <tr key={row.asset.symbol} className="hover:bg-[#0E1528] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 text-sm">{row.asset.symbol}</div>
                        <div className="text-[10px] text-slate-400">{row.asset.name}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        ${row.asset.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLong
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          {row.direction}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{row.confidence}%</span>
                          <div className="w-12 bg-[#121826] h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div className="bg-indigo-500 h-full" style={{ width: `${row.confidence}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-300">{row.rr}x</td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] text-slate-300">
                          {row.asset.regime.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{row.asset.volatility}%</td>
                      <td className="py-3 px-3 text-slate-300">${row.entry.toLocaleString()}</td>
                      <td className="py-3 px-3 text-rose-400">${Math.round(row.sl * 100) / 100}</td>
                      <td className="py-3 px-3 text-emerald-400">${Math.round(row.tp * 100) / 100}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/app`}
                          className="px-2.5 py-1 rounded bg-[#162032] hover:bg-indigo-600 text-slate-200 hover:text-white font-medium text-[11px] transition-all"
                        >
                          Terminal →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
