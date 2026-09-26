'use client';

import React, { useState } from 'react';
import { Asset } from '@/lib/types';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';

interface WatchlistProps {
  assets: Asset[];
  currentSymbol: string;
  onSelect: (symbol: string) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  assets,
  currentSymbol,
  onSelect,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const categories: { label: string; value: string }[] = [
    { label: 'ВСЕ', value: 'ALL' },
    { label: 'КРИПТА', value: 'CRYPTO' },
    { label: 'МЕТАЛЛЫ', value: 'METALS' },
    { label: 'ВАЛЮТЫ', value: 'FOREX' },
    { label: 'АКЦИИ', value: 'EQUITIES' },
  ];

  const filtered = activeCategory === 'ALL'
    ? assets
    : assets.filter((a) => a.category === activeCategory || (activeCategory === 'METALS' && (a.category === 'METALS' || a.category === 'COMMODITIES')));

  const getRegimeLabel = (regime: string) => {
    switch (regime) {
      case 'TRENDING_BULL': return 'ТРЕНД ВВЕРХ (РОСТ)';
      case 'TRENDING_BEAR': return 'ТРЕНД ВНИЗ (СПАД)';
      case 'RANGE': return 'БОКОВОЙ РЫНОК (ФЛЭТ)';
      case 'BREAKOUT': return 'ИМПУЛЬСНЫЙ ПРОБОЙ ВВЕРХ';
      case 'BREAKDOWN': return 'ИМПУЛЬСНЫЙ ПРОБОЙ ВНИЗ';
      case 'HIGH_VOLATILITY': return 'ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ';
      case 'LOW_VOLATILITY': return 'СЖАТИЕ / ЗАТИШЬЕ';
      case 'ACCUMULATION': return 'НАКОПЛЕНИЕ ОБЪЁМА';
      case 'DISTRIBUTION': return 'РАСПРЕДЕЛЕНИЕ';
      default: return 'НЕОПРЕДЕЛЁННОСТЬ';
    }
  };

  const getRegimeColor = (regime: string) => {
    if (regime.includes('BULL') || regime === 'BREAKOUT' || regime === 'ACCUMULATION') {
      return 'text-emerald-400 bg-emerald-950/50 border-emerald-700/60 font-bold';
    }
    if (regime.includes('BEAR') || regime === 'BREAKDOWN' || regime === 'DISTRIBUTION') {
      return 'text-rose-400 bg-rose-950/50 border-rose-700/60 font-bold';
    }
    return 'text-amber-400 bg-amber-950/40 border-amber-800/40 font-semibold';
  };

  const getSignalBadge = (signal: string) => {
    if (signal === 'LONG') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
          ВВЕРХ ↗
        </span>
      );
    }
    if (signal === 'SHORT') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/50">
          ВНИЗ ↘
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400">
        БОКОВИК
      </span>
    );
  };

  return (
    <aside className="w-full lg:w-72 xl:w-80 flex flex-col bg-[#070B14] border-r border-[#162032] shrink-0 text-xs h-full">
      {/* Watchlist Header */}
      <div className="p-3 border-b border-[#162032] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-400" />
          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
            Рыночный Watchlist (Котировки)
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-tabular">
          {filtered.length} инструментов
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#162032] bg-[#050810] overflow-x-auto no-scrollbar">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveCategory(c.value)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all whitespace-nowrap ${
              activeCategory === c.value
                ? 'bg-[#1E293B] text-indigo-300 border border-[#2D3F5E]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0E1424]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Assets List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#121A2A]/60">
        {filtered.map((asset) => {
          const isSelected = asset.symbol === currentSymbol;
          const isUp = asset.change24h >= 0;

          return (
            <button
              key={asset.symbol}
              onClick={() => onSelect(asset.symbol)}
              className={`w-full text-left p-3 transition-all hover:bg-[#0C1222] relative group ${
                isSelected ? 'bg-[#0E1528] border-l-2 border-indigo-500' : ''
              }`}
            >
              {/* Row 1: Symbol & Price */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-100 text-sm tracking-wide">
                    {asset.symbol}
                  </span>
                  {asset.isLiveSupported && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Прямая трансляция цен" />
                  )}
                </div>

                <div className="font-tabular font-extrabold text-slate-100 text-sm">
                  ${asset.price.toLocaleString(undefined, {
                    minimumFractionDigits: asset.price < 10 ? 4 : 2,
                    maximumFractionDigits: asset.price < 10 ? 4 : 2,
                  })}
                </div>
              </div>

              {/* Row 2: Name & 24h Change */}
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-slate-400 truncate max-w-[140px]">
                  {asset.name}
                </span>

                <div className={`flex items-center gap-0.5 font-tabular font-bold ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  <span>{isUp ? '+' : ''}{asset.change24h}%</span>
                </div>
              </div>

              {/* Row 3: Regime Badge & Signal */}
              <div className="flex items-center justify-between pt-1 border-t border-[#121A2A]/80 text-[10px]">
                <div className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-wide ${getRegimeColor(asset.regime)}`}>
                  {getRegimeLabel(asset.regime)}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[10px] font-tabular">
                    Волат: {asset.volatility}%
                  </span>
                  {getSignalBadge(asset.signalState)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
