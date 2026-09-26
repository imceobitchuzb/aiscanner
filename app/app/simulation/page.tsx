'use client';

import React, { useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { DigitalTwinSimulator } from '@/components/terminal/DigitalTwinSimulator';
import { Activity, Layers, ShieldCheck, Sliders, Zap } from 'lucide-react';

export default function SimulationPage() {
  const [selectedAsset, setSelectedAsset] = useState<string>('BTCUSDT');
  const asset = DEFAULT_ASSETS.find((a) => a.symbol === selectedAsset) || DEFAULT_ASSETS[0];

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol={selectedAsset}
        onSelectSymbol={setSelectedAsset}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#162032] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Scenario Simulation &amp; Digital Twin Lab
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate extreme price volatility swings, liquidation thresholds, and portfolio spillover dynamics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Selected Instrument:</span>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="bg-[#0A0E1A] border border-[#162032] rounded py-1 px-3 text-xs text-slate-200 outline-none font-bold"
            >
              {DEFAULT_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>{a.symbol} (${a.price.toLocaleString()})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Digital Twin Simulator Main Component */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DigitalTwinSimulator
              currentPrice={asset.price}
              symbol={asset.symbol}
            />
          </div>

          {/* Theoretical Foundations & Guide */}
          <div className="terminal-card p-5 text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-[#162032] mb-3 font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                <Activity className="h-4 w-4 text-indigo-400" />
                <span>Simulation Mathematics</span>
              </div>

              <div className="space-y-3 text-slate-300 text-[11px] leading-relaxed">
                <p>
                  The <strong className="text-slate-100">Digital Twin Engine</strong> computes deterministic non-linear margin curves based on exchange cross-margin liquidation models:
                </p>

                <div className="p-2.5 rounded bg-[#070A14] border border-[#162032] font-mono text-[10px] text-slate-300">
                  Liq_Price = P_0 * (1 - 1/Lev + Maint_Margin)
                </div>

                <p>
                  Cross-asset spillover calculates immediate portfolio beta transmission into correlated liquidity pairs (ETH, SOL, NVDA, Gold).
                </p>
              </div>
            </div>

            <div className="p-3 rounded bg-indigo-950/30 border border-indigo-800/40 text-[10px] text-indigo-200 mt-4">
              Use this laboratory to stress-test your open positions before major macroeconomic releases or high-volatility sessions.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
