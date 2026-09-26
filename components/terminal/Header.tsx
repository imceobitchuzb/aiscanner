'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  BarChart3, 
  Cpu, 
  Crosshair, 
  Layers, 
  PieChart, 
  Radio, 
  Search, 
  ShieldCheck, 
  Sliders, 
  Terminal, 
  Zap,
  Globe
} from 'lucide-react';
import { Asset } from '@/lib/types';

interface HeaderProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  watchlist: Asset[];
  isLiveFeed: boolean;
  isWsConnected?: boolean;
  dataSource?: string;
  latencyMs?: number;
  marketStatus?: string;
  freshness?: string;
  spread?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  onSelectSymbol,
  watchlist,
  isLiveFeed,
  isWsConnected = true,
  dataSource = 'LIVE_FEED',
  latencyMs = 0,
  marketStatus = 'OPEN',
  freshness = 'LIVE',
  spread,
}) => {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().slice(0, 8) + ' MSK');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { label: 'Терминал', href: '/app', icon: Terminal },
    { label: 'Сканер', href: '/app/scanner', icon: Crosshair },
    { label: 'Радар', href: '/app/radar', icon: Radio },
    { label: 'Симуляция', href: '/app/simulation', icon: Sliders },
    { label: 'Стратегии', href: '/app/strategies', icon: Layers },
    { label: 'Бэктест', href: '/app/backtest', icon: BarChart3 },
    { label: 'Портфель', href: '/app/portfolio', icon: PieChart },
    { label: 'AI Аналитик', href: '/app/ai', icon: Cpu },
    { label: 'Админ', href: '/app/admin', icon: ShieldCheck },
  ];

  const filteredAssets = watchlist.filter(
    (a) =>
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="border-b border-[#162032] bg-[#070A12]/95 backdrop-blur-md sticky top-0 z-50 text-xs">
      {/* Top Real-Time Ticker Tape */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#05070D] border-b border-[#121A2A] text-[11px] font-tabular">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-indigo-400 font-semibold uppercase tracking-wider text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            NEXUS ENGINE v2.4
          </div>

          <div className="h-3 w-px bg-[#1E293B]" />

          {watchlist.slice(0, 7).map((asset) => {
            const isUp = asset.change24h >= 0;
            return (
              <button
                key={asset.symbol}
                onClick={() => onSelectSymbol(asset.symbol)}
                className={`flex items-center gap-1.5 transition-colors px-1.5 py-0.5 rounded hover:bg-[#121A2A] ${
                  currentSymbol === asset.symbol ? 'text-indigo-300 font-medium bg-[#0E1528]' : 'text-slate-400'
                }`}
              >
                <span className="font-bold text-slate-200">{asset.symbol}</span>
                <span className="text-slate-100">
                  ${asset.price.toLocaleString(undefined, { 
                    minimumFractionDigits: asset.category === 'FOREX' ? 4 : 2,
                    maximumFractionDigits: asset.category === 'FOREX' ? 4 : 2 
                  })}
                </span>
                <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? '↗ +' : '↘ '}{asset.change24h}%
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 text-slate-400 shrink-0 pl-2">
          {/* Data Provenance & Freshness Badge */}
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 border ${
            freshness === 'LIVE'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-600/70 shadow-bull-glow'
              : freshness === 'RECENT'
              ? 'bg-cyan-950/50 text-cyan-300 border-cyan-700/60'
              : freshness === 'STALE'
              ? 'bg-amber-950/50 text-amber-300 border-amber-700/60'
              : 'bg-rose-950/50 text-rose-300 border-rose-700/60'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              freshness === 'LIVE' ? 'bg-emerald-400 animate-ping' : freshness === 'RECENT' ? 'bg-cyan-400' : 'bg-amber-400'
            }`} />
            <span>
              {freshness} • {dataSource} {latencyMs > 0 ? `(${latencyMs}ms)` : ''}
              {marketStatus !== 'OPEN' ? ` • ${marketStatus === 'CLOSED' ? 'РЫНОК ЗАКРЫТ' : marketStatus}` : ''}
              {spread ? ` • СПРЕД: $${spread}` : ''}
            </span>
          </div>

          <span className="text-slate-300 font-tabular font-bold">{timeStr}</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-ai-glow">
              <Zap className="h-4 w-4 fill-white" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-slate-100 uppercase">NEXUS</span>
              <span className="text-[10px] font-bold text-indigo-400 ml-1.5 px-1 py-0.2 bg-indigo-950/70 border border-indigo-700/50 rounded">AI</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-all text-[11px] ${
                    isActive
                      ? 'bg-[#162032] text-white font-bold border border-[#243350]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0E1424]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center bg-[#0B0F19] border border-[#1E293B] rounded-md px-2.5 py-1 text-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all w-56 md:w-72">
              <Search className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Поиск актива (BTCUSDT, ETH, NVDA)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                className="bg-transparent border-none outline-none text-xs w-full text-slate-200 placeholder:text-slate-500"
              />
              <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] bg-[#162032] text-slate-400 rounded border border-[#243350]">
                /
              </kbd>
            </div>

            {/* Quick Search Dropdown */}
            {searchOpen && searchQuery.length > 0 && (
              <div 
                className="absolute right-0 mt-1 w-72 bg-[#0A0E1A] border border-[#1E293B] rounded-lg shadow-terminal z-50 max-h-72 overflow-y-auto"
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              >
                <div className="p-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#162032]">
                  Найденные инструменты
                </div>
                {filteredAssets.length === 0 ? (
                  <div className="p-3 text-center text-slate-400">Инструмент не найден</div>
                ) : (
                  filteredAssets.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => {
                        onSelectSymbol(asset.symbol);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#121A2A] transition-colors border-b border-[#121A2A]/50 last:border-none"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{asset.symbol}</div>
                        <div className="text-[10px] text-slate-400">{asset.name}</div>
                      </div>
                      <div className="text-right font-tabular">
                        <div className="text-slate-200 font-bold">${asset.price.toLocaleString()}</div>
                        <div className={`text-[10px] font-bold ${asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {asset.change24h >= 0 ? '↗ +' : '↘ '}{asset.change24h}%
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <Link
            href="/app/ai"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 transition-colors"
          >
            <Activity className="h-3 w-3" />
            <span className="font-semibold text-[11px]">AI Анализ</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
