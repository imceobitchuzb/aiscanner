'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { ArrowRight, Check, Code, Layers, Plus, Sparkles, Trash2, Zap } from 'lucide-react';

interface StrategyRule {
  id: string;
  indicator: string;
  operator: string;
  value: string;
  timeframe: string;
}

const AVAILABLE_BLOCKS = [
  'EMA Cross (50 > 200)',
  'RSI Threshold (> 55)',
  'Volume Expansion (> 1.25x Avg)',
  'Market Structure (Higher High)',
  'Order Block Retest (+OB Demand)',
  'Fair Value Gap Fill (Bullish FVG)',
  'Regime Filter (Trending Bull)',
  'Bollinger Band Squeeze Breakout',
  'ADX Trend Strength (> 25)',
  'VWAP Mean Reversion (Price > VWAP)',
  'Macro News Filter (Net Bullish)',
];

export default function StrategyBuilderPage() {
  const [strategyName, setStrategyName] = useState('Institutional Multi-Factor Trend Following');
  const [targetDirection, setTargetDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [activeRules, setActiveRules] = useState<StrategyRule[]>([
    { id: '1', indicator: 'EMA 50', operator: '>', value: 'EMA 200', timeframe: '4H' },
    { id: '2', indicator: 'RSI(14)', operator: '>', value: '55.0', timeframe: '1H' },
    { id: '3', indicator: 'Volume', operator: '>', value: '20-Period Avg', timeframe: '15m' },
    { id: '4', indicator: 'Market Regime', operator: '==', value: 'Trending Bull', timeframe: '1D' },
  ]);

  const addRule = (blockText: string) => {
    setActiveRules([
      ...activeRules,
      {
        id: Date.now().toString(),
        indicator: blockText,
        operator: 'CONFIRMED',
        value: 'TRUE',
        timeframe: '1H',
      },
    ]);
  };

  const removeRule = (id: string) => {
    setActiveRules(activeRules.filter((r) => r.id !== id));
  };

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
              <Layers className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Visual No-Code Strategy Laboratory
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Compose multi-timeframe quantitative logic blocks, market structure conditions, and AI filters.
            </p>
          </div>

          <Link
            href="/app/backtest"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-ai-glow transition-all"
          >
            <span>Run Backtest in Lab</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Active Canvas / Builder Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Strategy Meta Card */}
            <div className="terminal-card p-4 text-xs">
              <div className="flex items-center justify-between gap-4 mb-3">
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="bg-[#050810] border border-[#162032] focus:border-indigo-500 rounded py-1.5 px-3 text-slate-100 font-bold text-sm w-full outline-none"
                />

                <div className="flex bg-[#050810] p-0.5 rounded border border-[#162032] shrink-0">
                  <button
                    onClick={() => setTargetDirection('LONG')}
                    className={`px-3 py-1 rounded text-[10px] font-bold ${
                      targetDirection === 'LONG' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    LONG LOGIC
                  </button>
                  <button
                    onClick={() => setTargetDirection('SHORT')}
                    className={`px-3 py-1 rounded text-[10px] font-bold ${
                      targetDirection === 'SHORT' ? 'bg-rose-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    SHORT LOGIC
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-tabular">
                Signal executes when <strong className="text-indigo-400">ALL {activeRules.length} conditions</strong> are concurrently verified on candle close.
              </div>
            </div>

            {/* Rule Chain Visualizer */}
            <div className="terminal-card p-4 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Execution Logic Blocks
              </span>

              {activeRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-lg bg-[#070B14] border border-[#162032] flex items-center justify-between text-xs font-tabular group"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded bg-[#162032] flex items-center justify-center font-bold text-slate-400 text-[10px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-200">{rule.indicator}</div>
                      <div className="text-[10px] text-slate-400">
                        Condition: <span className="text-indigo-400">{rule.operator} {rule.value}</span> • TF: <span className="text-slate-300 font-bold">{rule.timeframe}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeRule(rule.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Block Library Palette */}
          <div className="terminal-card p-4 text-xs flex flex-col justify-between">
            <div>
              <div className="pb-2 border-b border-[#162032] mb-3 font-bold text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Available Condition Blocks</span>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[460px] pr-1">
                {AVAILABLE_BLOCKS.map((block) => (
                  <button
                    key={block}
                    onClick={() => addRule(block)}
                    className="w-full text-left p-2 rounded bg-[#070A14] border border-[#162032] hover:border-indigo-500/50 hover:bg-[#0E1528] text-slate-300 transition-all flex items-center justify-between text-[11px] group"
                  >
                    <span>{block}</span>
                    <Plus className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#0A0E1A] border border-[#162032] text-slate-400 text-[10px] mt-4">
              Add blocks with a single click. Connected conditions compile directly into quantitative backtest logic.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
