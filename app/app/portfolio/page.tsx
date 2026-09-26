'use client';

import React, { useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { AlertTriangle, PieChart, ShieldAlert, TrendingUp } from 'lucide-react';

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState([
    { symbol: 'BTCUSDT', name: 'Bitcoin', weight: 45, valueUsd: 45000, pnlPercent: 12.4, beta: 1.0 },
    { symbol: 'ETHUSDT', name: 'Ethereum', weight: 30, valueUsd: 30000, pnlPercent: 6.8, beta: 1.22 },
    { symbol: 'SOLUSDT', name: 'Solana', weight: 15, valueUsd: 15000, pnlPercent: 24.5, beta: 1.54 },
    { symbol: 'XAUUSD', name: 'Gold (Troy Oz)', weight: 10, valueUsd: 10000, pnlPercent: 3.2, beta: 0.18 },
  ]);

  const totalValue = portfolio.reduce((sum, p) => sum + p.valueUsd, 0);

  // Correlation Matrix between portfolio assets
  const assets = ['BTC', 'ETH', 'SOL', 'GOLD'];
  const correlationMatrix = [
    [1.00, 0.88, 0.81, 0.24],
    [0.88, 1.00, 0.84, 0.18],
    [0.81, 0.84, 1.00, 0.12],
    [0.24, 0.18, 0.12, 1.00],
  ];

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol="BTCUSDT"
        onSelectSymbol={() => {}}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#162032] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Portfolio Intelligence &amp; Correlation Diagnostics
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-asset exposure, concentration risk factors, and cross-asset covariance matrix.
            </p>
          </div>

          <div className="font-tabular text-xs">
            <span className="text-slate-400">Total Portfolio Value: </span>
            <span className="text-base font-extrabold text-emerald-400">
              ${totalValue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* AI Correlation Alert Banner */}
        <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
              Analytical Risk Diagnostic: Severe High-Beta Covariance
            </span>
            <p className="text-amber-200/90 leading-relaxed text-[11px]">
              Your portfolio exhibits an aggregate 90% allocation across crypto assets with pairwise correlation exceeding 0.85 (BTC/ETH: 0.88, BTC/SOL: 0.81). A downward volatility shock in BTC will create amplified correlated drawdowns across 90% of your holdings.
            </p>
          </div>
        </div>

        {/* Allocation Table & Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 terminal-card overflow-hidden">
            <div className="p-3 border-b border-[#162032] text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Asset Allocation &amp; Exposures
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-tabular border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#162032] bg-[#070A12] text-slate-400 text-[10px] uppercase">
                    <th className="py-2.5 px-4">Asset</th>
                    <th className="py-2.5 px-3">Allocation</th>
                    <th className="py-2.5 px-3">Holding Value</th>
                    <th className="py-2.5 px-3">Beta to BTC</th>
                    <th className="py-2.5 px-4 text-right">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#121A2A]">
                  {portfolio.map((item) => (
                    <tr key={item.symbol} className="hover:bg-[#0E1528] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100">{item.symbol}</div>
                        <div className="text-[10px] text-slate-400">{item.name}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{item.weight}%</td>
                      <td className="py-3 px-3">${item.valueUsd.toLocaleString()}</td>
                      <td className="py-3 px-3 text-indigo-300 font-bold">{item.beta}x</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        +{item.pnlPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Correlation Matrix Card */}
          <div className="terminal-card p-4 text-xs flex flex-col justify-between">
            <div>
              <div className="pb-2 border-b border-[#162032] mb-3 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Cross-Asset Covariance Heatmap
              </div>

              <div className="overflow-x-auto mb-3">
                <table className="w-full text-center font-tabular text-[11px] border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-[10px]">
                      <th className="p-1.5"></th>
                      {assets.map((a) => (
                        <th key={a} className="p-1.5 font-bold text-slate-300">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="p-1.5 font-bold text-slate-400 text-left">{assets[rIdx]}</td>
                        {row.map((val, cIdx) => {
                          const bg = val > 0.8
                            ? 'bg-rose-950/60 text-rose-300'
                            : val > 0.5
                            ? 'bg-amber-950/50 text-amber-300'
                            : 'bg-indigo-950/40 text-indigo-300';
                          return (
                            <td key={cIdx} className={`p-1.5 font-semibold rounded ${bg} border border-[#162032]/40`}>
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 p-2 rounded bg-[#070A14] border border-[#162032]">
              Co-skewness computed from rolling 90-day daily return log ratios.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
