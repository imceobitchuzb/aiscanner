'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { ArrowDownRight, ArrowUpRight, Crosshair, Filter, RefreshCw, ShieldAlert, SlidersHorizontal, TrendingUp } from 'lucide-react';

interface ScannerItem {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change24h: number;
  source: string;
  marketStatus: string;
  freshness: string;
  setupState: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  setupGrade: string;
  setupQuality: number;
  modelConfidence: number;
  riskRewardRatio: number;
  regime: string;
  rejectionReason?: string;
}

export default function ScannerPage() {
  const [items, setItems] = useState<ScannerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT' | 'NO_SETUP'>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [minRR, setMinRR] = useState<number>(1.5);
  const [regimeFilter, setRegimeFilter] = useState<string>('ALL');

  useEffect(() => {
    let isMounted = true;
    const loadScan = async () => {
      try {
        const res = await fetch('/api/scanner?timeframe=1h', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.items) {
            setItems(data.items);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to load scanner results:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadScan();
    const interval = setInterval(loadScan, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const filtered = items.filter((row) => {
    if (directionFilter === 'LONG' && row.direction !== 'LONG') return false;
    if (directionFilter === 'SHORT' && row.direction !== 'SHORT') return false;
    if (directionFilter === 'NO_SETUP' && row.direction !== 'NEUTRAL' && row.setupState !== 'NO_SETUP') return false;
    if (row.modelConfidence < minConfidence && row.direction !== 'NEUTRAL') return false;
    if (row.riskRewardRatio < minRR && row.direction !== 'NEUTRAL') return false;
    if (regimeFilter !== 'ALL' && !row.regime.includes(regimeFilter)) return false;
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
                Multi-Asset Opportunity Scanner (SignalDecisionEngine)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Институциональный детерминированный сканер возможностей на базе единого алгоритмического пайплайна (Crypto, Metals, FX, Equities).
            </p>
          </div>

          <div className="flex items-center gap-2 font-tabular text-xs">
            <span className="text-slate-400">Найдено сетапов:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold">
              {filtered.filter((f) => f.direction !== 'NEUTRAL').length} активных / {items.length} просканировано
            </span>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="terminal-card p-4 text-xs">
          <div className="flex items-center gap-2 mb-3 text-slate-300 font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
            <span>Параметры фильтрации сетапов</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Direction */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Направление</label>
              <div className="flex bg-[#050810] p-0.5 rounded border border-[#162032]">
                {(['ALL', 'LONG', 'SHORT', 'NO_SETUP'] as const).map((dir) => (
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
                Мин. Уверенность: {minConfidence}%
              </label>
              <input
                type="range"
                min="40"
                max="90"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
              />
            </div>

            {/* Min R:R */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Мин. R:R (Прибыль/Риск): {minRR}x
              </label>
              <input
                type="range"
                min="1.2"
                max="3.5"
                step="0.1"
                value={minRR}
                onChange={(e) => setMinRR(Number(e.target.value))}
                className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2"
              />
            </div>

            {/* Regime */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Рыночный режим</label>
              <select
                value={regimeFilter}
                onChange={(e) => setRegimeFilter(e.target.value)}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 text-xs outline-none"
              >
                <option value="ALL">Все режимы</option>
                <option value="BULL">Trending Bull / Breakout</option>
                <option value="BEAR">Trending Bear / Breakdown</option>
                <option value="RANGE">Range / Horizontal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scanner Results Table */}
        <div className="terminal-card overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Выполнение квант-скрининга через SignalDecisionEngine...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-tabular border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#162032] bg-[#070A12] text-slate-400 text-[10px] uppercase">
                    <th className="py-2.5 px-4">Инструмент</th>
                    <th className="py-2.5 px-3">Котировка</th>
                    <th className="py-2.5 px-3">Источник / Статус</th>
                    <th className="py-2.5 px-3">Сетап / Статус</th>
                    <th className="py-2.5 px-3">Качество</th>
                    <th className="py-2.5 px-3">Уверенность</th>
                    <th className="py-2.5 px-3">R:R</th>
                    <th className="py-2.5 px-3">Режим рынка</th>
                    <th className="py-2.5 px-3">Детализация / Причина</th>
                    <th className="py-2.5 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#121A2A]">
                  {filtered.map((row) => {
                    const isLong = row.direction === 'LONG';
                    const isShort = row.direction === 'SHORT';
                    const isNoSetup = row.direction === 'NEUTRAL' || row.setupState === 'NO_SETUP';

                    return (
                      <tr key={row.symbol} className="hover:bg-[#0E1528] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100 text-sm">{row.symbol}</div>
                          <div className="text-[10px] text-slate-400">{row.name}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          ${row.price.toLocaleString(undefined, {
                            minimumFractionDigits: row.category === 'FOREX' ? 4 : 2,
                            maximumFractionDigits: row.category === 'FOREX' ? 4 : 2,
                          })}
                        </td>
                        <td className="py-3 px-3 text-[10px]">
                          <span className="text-slate-300 font-mono block">{row.source}</span>
                          <span className={`font-semibold ${row.freshness === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {row.freshness} • {row.marketStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLong
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isShort
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {isNoSetup ? 'NO SETUP' : `${row.direction} (${row.setupState})`}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-100">
                          {row.setupQuality > 0 ? `${row.setupQuality}/100` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          {row.modelConfidence > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">{row.modelConfidence}%</span>
                              <div className="w-12 bg-[#121826] h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div className="bg-indigo-500 h-full" style={{ width: `${row.modelConfidence}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-indigo-300">
                          {row.riskRewardRatio > 0 ? `${row.riskRewardRatio.toFixed(1)}x` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-slate-300">
                            {row.regime.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                          {row.rejectionReason || 'Подтверждён институциональный сетап с защитным стопом.'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/app`}
                            className="px-2.5 py-1 rounded bg-[#162032] hover:bg-indigo-600 text-slate-200 hover:text-white font-medium text-[11px] transition-all"
                          >
                            Терминал →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
