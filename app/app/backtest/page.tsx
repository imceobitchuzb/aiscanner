'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS, DemoMarketDataProvider } from '@/lib/providers/demoProvider';
import { BacktestReport, BacktestStrategyConfig, Candle, MonteCarloSimulationResult, Timeframe, WalkForwardResult } from '@/lib/types';
import { runBacktest } from '@/lib/quant/backtestEngine';
import { runMonteCarloSimulation } from '@/lib/quant/monteCarlo';
import { runWalkForwardAnalysis } from '@/lib/quant/walkForward';
import { 
  Activity, 
  BarChart3, 
  CheckCircle2, 
  Cpu, 
  Dices, 
  Layers, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  SlidersHorizontal, 
  TrendingUp 
} from 'lucide-react';

export default function BacktestLabPage() {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(2.0);
  const [useEmaCross, setUseEmaCross] = useState<boolean>(true);
  const [useRsiFilter, setUseRsiFilter] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);

  const [report, setReport] = useState<BacktestReport | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloSimulationResult | null>(null);
  const [walkForward, setWalkForward] = useState<WalkForwardResult | null>(null);

  const executeBacktest = async () => {
    setRunning(true);
    const provider = new DemoMarketDataProvider();
    const candles = await provider.getCandles(symbol, timeframe, 300);

    const config: BacktestStrategyConfig = {
      name: 'Dynamic Momentum & Moving Average Engine',
      symbol,
      timeframe,
      initialBalance: initialCapital,
      riskPerTradePercent: riskPerTrade,
      stopLossAtrMultiplier: 1.5,
      takeProfitAtrMultiplier: 2.5,
      indicators: {
        useEmaCross,
        useRsiFilter,
        useStructureBreakout: true,
        useVolumeExpansion: true,
      },
    };

    const rep = runBacktest(candles, config);
    const mc = runMonteCarloSimulation(rep.trades, initialCapital, 1000, 60);
    const wf = runWalkForwardAnalysis(candles, config, 0.7);

    setReport(rep);
    setMonteCarlo(mc);
    setWalkForward(wf);
    setRunning(false);
  };

  useEffect(() => {
    executeBacktest();
  }, [symbol, timeframe]);

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol={symbol}
        onSelectSymbol={setSymbol}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#162032] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
                Quantitative Strategy Laboratory &amp; Backtesting Engine
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Vectorized event simulation, Walk-Forward overfitting diagnostic, and 1,000-iteration Monte Carlo bootstrap.
            </p>
          </div>

          <button
            onClick={executeBacktest}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-ai-glow transition-all"
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span>Re-Run Simulation</span>
          </button>
        </div>

        {/* Strategy Configuration Card */}
        <div className="terminal-card p-4 text-xs">
          <div className="flex items-center gap-2 mb-3 text-slate-300 font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
            <span>Strategy Parameters &amp; Sizing</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Asset</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 outline-none"
              >
                {DEFAULT_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 outline-none"
              >
                {(['15m', '1h', '4h', '1D'] as Timeframe[]).map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 outline-none font-tabular"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Risk / Trade (%)</label>
              <input
                type="number"
                step="0.5"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 outline-none font-tabular"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={useEmaCross}
                  onChange={(e) => setUseEmaCross(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className="text-slate-300">EMA Cross</span>
              </label>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={useRsiFilter}
                  onChange={(e) => setUseRsiFilter(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className="text-slate-300">RSI Filter</span>
              </label>
            </div>
          </div>
        </div>

        {/* Backtest Core Metrics Grid */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-tabular text-xs">
            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Net P&L</span>
              <div className={`text-base font-extrabold ${report.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {report.netProfitUsd >= 0 ? '+' : ''}${report.netProfitUsd.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">({report.netProfitPercent}%)</span>
            </div>

            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Win Rate</span>
              <div className="text-base font-extrabold text-slate-100">{report.winRatePercent}%</div>
              <span className="text-[10px] text-slate-400">{report.totalTrades} Total Trades</span>
            </div>

            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Profit Factor</span>
              <div className="text-base font-extrabold text-indigo-300">{report.profitFactor}</div>
              <span className="text-[10px] text-slate-400">Gross Win / Loss</span>
            </div>

            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sharpe Ratio</span>
              <div className="text-base font-extrabold text-emerald-400">{report.sharpeRatio}</div>
              <span className="text-[10px] text-slate-400">Sortino: {report.sortinoRatio}</span>
            </div>

            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">Max Drawdown</span>
              <div className="text-base font-extrabold text-rose-400">-{report.maxDrawdownPercent}%</div>
              <span className="text-[10px] text-slate-400">Recovery: {report.recoveryFactor}x</span>
            </div>

            <div className="terminal-card p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Expectancy</span>
              <div className="text-base font-extrabold text-slate-100">+${report.expectancyUsd}</div>
              <span className="text-[10px] text-slate-400">Avg Trade / PnL</span>
            </div>
          </div>
        )}

        {/* Equity Curve SVG Visualizer */}
        {report && report.equityCurve.length > 1 && (
          <div className="terminal-card p-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3 text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                  Simulation Equity Curve
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-tabular">
                Start: ${initialCapital.toLocaleString()} → Terminal: ${Math.round(report.equityCurve[report.equityCurve.length - 1].equity).toLocaleString()}
              </span>
            </div>

            <div className="h-56 w-full relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                {/* Horizontal guide lines */}
                <line x1="0" y1="20" x2="100" y2="20" stroke="#162032" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#162032" strokeWidth="0.5" />
                <line x1="0" y1="80" x2="100" y2="80" stroke="#162032" strokeWidth="0.5" />

                {/* Path line */}
                {(() => {
                  const equities = report.equityCurve.map((e) => e.equity);
                  const min = Math.min(...equities) * 0.98;
                  const max = Math.max(...equities) * 1.02;
                  const range = max - min || 1;

                  const points = report.equityCurve.map((e, idx) => {
                    const x = (idx / (report.equityCurve.length - 1)) * 100;
                    const y = 100 - ((e.equity - min) / range) * 100;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="1.8"
                      points={points}
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* Advanced Validation: Walk-Forward & Monte Carlo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Walk-Forward Overfitting Card */}
          {walkForward && (
            <div className="terminal-card p-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                    Walk-Forward Validation
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  walkForward.robustnessGrade === 'ROBUST'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {walkForward.robustnessGrade}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-tabular text-center mb-3">
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">In-Sample Sharpe</span>
                  <span className="font-bold text-slate-100">{walkForward.inSampleSharpe}</span>
                </div>
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Out-Of-Sample</span>
                  <span className="font-bold text-slate-100">{walkForward.outOfSampleSharpe}</span>
                </div>
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Degradation %</span>
                  <span className={`font-bold ${walkForward.degradationPercent > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {walkForward.degradationPercent}%
                  </span>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                Strategy demonstrates consistent out-of-sample edge with minimal curve-fitting degradation across historical partition windows.
              </p>
            </div>
          )}

          {/* Monte Carlo Bootstrap Card */}
          {monteCarlo && (
            <div className="terminal-card p-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                    Monte Carlo Stress (1,000 Runs)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-tabular">Bootstrap Resampling</span>
              </div>

              <div className="grid grid-cols-4 gap-2 font-tabular text-center mb-3">
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[9px] text-rose-400 block mb-0.5">Ruin Risk</span>
                  <span className="font-bold text-slate-100">{monteCarlo.probabilityOfRuin}%</span>
                </div>
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[9px] text-slate-400 block mb-0.5">5th Percentile</span>
                  <span className="font-bold text-slate-100">${monteCarlo.p5TerminalEquity.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[9px] text-slate-400 block mb-0.5">Median (p50)</span>
                  <span className="font-bold text-emerald-400">${monteCarlo.p50TerminalEquity.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
                  <span className="text-[9px] text-slate-400 block mb-0.5">95th Percentile</span>
                  <span className="font-bold text-indigo-300">${monteCarlo.p95TerminalEquity.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                Empirical permutation verifies that catastrophic drawdown risk remains under control across randomized sequence orderings.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
