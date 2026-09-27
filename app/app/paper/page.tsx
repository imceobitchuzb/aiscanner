'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { Asset, Timeframe } from '@/lib/types';
import { FROZEN_STRATEGY_CONFIG, FROZEN_STRATEGY_HASH, validateStrategyIntegrity } from '@/lib/quant/frozenStrategyConfig';
import { PaperTradingEngine, PaperAccountState, PaperPosition, PaperTradeRecord, LiveSignalJournalRecord } from '@/lib/quant/paperTradingEngine';
import { ForwardValidationEngine, DailyValidationStatistics, WeeklyValidationReport } from '@/lib/quant/forwardValidationEngine';
import { ForexABExperiment, ForexABExperimentReport } from '@/lib/quant/forexABExperiment';
import { clientMarketProvider } from '@/lib/providers/clientMarketProvider';
import { 
  ShieldCheck, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  BarChart2, 
  Layers, 
  Clock, 
  RefreshCw,
  FlaskConical,
  Lock,
  Zap,
  Info
} from 'lucide-react';

export default function PaperTradingPage() {
  const [currentSymbol, setCurrentSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [watchlist, setWatchlist] = useState<Asset[]>(DEFAULT_ASSETS);
  const [loading, setLoading] = useState<boolean>(false);
  const [engine] = useState<PaperTradingEngine>(() => PaperTradingEngine.getInstance());

  const [account, setAccount] = useState<PaperAccountState>(() => engine.getAccountState());
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<PaperTradeRecord[]>([]);
  const [signals, setSignals] = useState<LiveSignalJournalRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'trades' | 'journal' | 'ab_experiment' | 'forward_test'>('positions');
  const [abReport, setAbReport] = useState<ForexABExperimentReport | null>(null);

  const integrity = validateStrategyIntegrity(FROZEN_STRATEGY_CONFIG);

  // Sync state from paper trading engine
  const refreshState = () => {
    setAccount(engine.getAccountState());
    setOpenPositions(engine.getOpenPositions());
    setClosedTrades(engine.getClosedTrades());
    setSignals(engine.getSignalJournal(100));
  };

  // Run a single live step / evaluation
  const runLiveEvaluation = async () => {
    setLoading(true);
    try {
      const candles = await clientMarketProvider.getCandles(currentSymbol, timeframe, 150);
      if (candles && candles.length >= 50) {
        engine.processMarketTick(candles, currentSymbol, timeframe, true, true);
        refreshState();
      }
    } catch (err) {
      console.error('Error running live paper evaluation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run isolated Forex A/B experiment
  const runAbExperiment = async () => {
    setLoading(true);
    try {
      const candles = await clientMarketProvider.getCandles('EURUSD', '1h', 500);
      if (candles && candles.length >= 60) {
        const report = ForexABExperiment.runExperiment(candles, 'EURUSD', '1h');
        setAbReport(report);
      }
    } catch (err) {
      console.error('Error running A/B experiment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runLiveEvaluation();
  }, [currentSymbol, timeframe]);

  // Compute metrics from closed trades
  const wins = closedTrades.filter((t) => t.outcome === 'WIN').length;
  const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : '0.0';
  const totalR = closedTrades.reduce((s, t) => s + t.rMultiple, 0);
  const avgR = closedTrades.length > 0 ? (totalR / closedTrades.length).toFixed(2) : '0.00';
  const grossProfit = closedTrades.filter((t) => t.realizedPnlUsd > 0).reduce((s, t) => s + t.realizedPnlUsd, 0);
  const grossLoss = Math.abs(closedTrades.filter((t) => t.realizedPnlUsd < 0).reduce((s, t) => s + t.realizedPnlUsd, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '999' : '0.00';

  // Rejection counts
  const rejectedSignals = signals.filter((s) => s.decision === 'REJECT');
  const rejMap: Record<string, number> = {};
  for (const s of rejectedSignals) {
    const code = s.rejectionCode || 'OTHER';
    rejMap[code] = (rejMap[code] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-[#060911] text-slate-200 flex flex-col font-sans">
      <Header
        currentSymbol={currentSymbol}
        onSelectSymbol={setCurrentSymbol}
        watchlist={watchlist}
        isLiveFeed={true}
        dataSource="PAPER_TRADING_SANDBOX"
      />

      {/* Safety & Frozen Strategy Status Banner */}
      <div className="bg-[#0A101D] border-b border-[#1A263D] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">FROZEN STRATEGY:</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                {FROZEN_STRATEGY_CONFIG.strategyVersion}
              </span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                integrity.isValid 
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50' 
                  : 'bg-rose-950/60 text-rose-400 border-rose-700/50'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {integrity.isValid ? 'INTEGRITY VERIFIED' : 'HASH MISMATCH'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Hash: {FROZEN_STRATEGY_HASH.slice(0, 16)}... | 60-Day Forward Mode: Active
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">ISOLATION STATUS</div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              100% VIRTUAL SANDBOX (NO REAL ORDERS)
            </div>
          </div>

          <button
            onClick={runLiveEvaluation}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Evaluate Tick
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
        {/* Account Performance Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Virtual Equity</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-[10px] text-slate-500">Init: ${account.initialBalance}</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Realized PnL</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${account.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {account.realizedPnl >= 0 ? '+' : ''}${account.realizedPnl.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500">Unrealized: ${account.unrealizedPnl.toFixed(2)}</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Win Rate</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{winRate}%</div>
            <div className="text-[10px] text-slate-500">{wins}W / {closedTrades.length - wins}L</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Expectancy</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${parseFloat(avgR) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {avgR}R
            </div>
            <div className="text-[10px] text-slate-500">Mean R-Multiple</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Profit Factor</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{profitFactor}</div>
            <div className="text-[10px] text-slate-500">Gross: ${grossProfit.toFixed(0)} / ${grossLoss.toFixed(0)}</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Max Drawdown</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{account.maxDrawdownPercent.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500">${account.maxDrawdownUsd.toFixed(1)} USD</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Active Positions</div>
            <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">{openPositions.length}</div>
            <div className="text-[10px] text-slate-500">Total Closed: {closedTrades.length}</div>
          </div>

          <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Evaluated Signals</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{signals.length}</div>
            <div className="text-[10px] text-slate-500">Rejections: {rejectedSignals.length}</div>
          </div>
        </div>

        {/* Asset & Timeframe Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0B1120] border border-[#162238] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Validation Asset:</span>
            {['BTCUSDT', 'XAUUSD', 'ETHUSDT', 'EURUSD', 'GBPUSD'].map((sym) => (
              <button
                key={sym}
                onClick={() => setCurrentSymbol(sym)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentSymbol === sym
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-[#121B2E] text-slate-300 hover:bg-[#1A263F]'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Timeframe:</span>
            {(['15m', '1h', '4h'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  timeframe === tf
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-[#121B2E] text-slate-300 hover:bg-[#1A263F]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1A263D] gap-2">
          <button
            onClick={() => setActiveTab('positions')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'positions'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Open Paper Positions ({openPositions.length})
          </button>

          <button
            onClick={() => setActiveTab('trades')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'trades'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Closed Trades History ({closedTrades.length})
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'journal'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Live Signal Journal & Rejections ({signals.length})
          </button>

          <button
            onClick={() => setActiveTab('forward_test')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'forward_test'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            60-Day Forward Protocol
          </button>

          <button
            onClick={() => setActiveTab('ab_experiment')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'ab_experiment'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Forex A/B Research Experiment
          </button>
        </div>

        {/* Tab 1: Open Positions */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
            {openPositions.length === 0 ? (
              <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-8 text-center text-slate-400">
                <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No Active Paper Positions</p>
                <p className="text-xs text-slate-500 mt-1">
                  The frozen strategy is continuously monitoring {currentSymbol} {timeframe}. A position will be opened virtual only when all structural risk gates and HTF confirmations are satisfied.
                </p>
              </div>
            ) : (
              <div className="bg-[#0B1120] border border-[#162238] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0E1628] text-slate-400 border-b border-[#1A263D] text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Stop Loss</th>
                      <th className="py-2.5 px-3">TP1 (50%)</th>
                      <th className="py-2.5 px-3">TP2 (30%)</th>
                      <th className="py-2.5 px-3">TP3 (20%)</th>
                      <th className="py-2.5 px-3">Units</th>
                      <th className="py-2.5 px-3">MFE / MAE</th>
                      <th className="py-2.5 px-3">Holding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162238]">
                    {openPositions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-[#121B2E]">
                        <td className="py-3 px-4 font-bold text-white">{pos.symbol}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pos.direction === 'LONG' ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/70 text-rose-400 border border-rose-800/40'
                          }`}>
                            {pos.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-200">${pos.entryPrice}</td>
                        <td className="py-3 px-3 text-rose-400 font-bold">${pos.stopLoss}</td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">
                          ${pos.takeProfit1} {pos.tp1Executed && '✓'}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">
                          ${pos.takeProfit2} {pos.tp2Executed && '✓'}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">${pos.takeProfit3}</td>
                        <td className="py-3 px-3 text-slate-300">{pos.currentUnits.toFixed(4)}</td>
                        <td className="py-3 px-3">
                          <span className="text-emerald-400">+{pos.mfeR}R</span> / <span className="text-rose-400">-{pos.maeR}R</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{pos.barsHeld} bars</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Closed Trades History */}
        {activeTab === 'trades' && (
          <div className="space-y-4">
            {closedTrades.length === 0 ? (
              <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-8 text-center text-slate-400">
                <BarChart2 className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No Closed Paper Trades Yet</p>
                <p className="text-xs text-slate-500 mt-1">Execute live ticks or replay candles to accumulate forward trade statistics.</p>
              </div>
            ) : (
              <div className="bg-[#0B1120] border border-[#162238] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0E1628] text-slate-400 border-b border-[#1A263D] text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Entry</th>
                      <th className="py-2.5 px-3">Exit</th>
                      <th className="py-2.5 px-3">R-Multiple</th>
                      <th className="py-2.5 px-3">Realized PnL</th>
                      <th className="py-2.5 px-3">MFE / MAE</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Exit Reason</th>
                      <th className="py-2.5 px-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162238]">
                    {closedTrades.map((t) => (
                      <tr key={t.tradeId} className="hover:bg-[#121B2E]">
                        <td className="py-3 px-4 font-bold text-white">{t.symbol}</td>
                        <td className="py-3 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'LONG' ? 'text-emerald-400 bg-emerald-950/50' : 'text-rose-400 bg-rose-950/50'
                          }`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">${t.entryPrice}</td>
                        <td className="py-3 px-3 text-slate-300">${t.exitPrice}</td>
                        <td className={`py-3 px-3 font-bold ${t.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple}R
                        </td>
                        <td className={`py-3 px-3 font-bold ${t.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${t.realizedPnlUsd.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="text-emerald-400">+{t.mfeR}R</span> / <span className="text-rose-400">-{t.maeR}R</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{t.durationBars} bars</td>
                        <td className="py-3 px-3 text-slate-300">{t.exitReason}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.outcome === 'WIN' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                          }`}>
                            {t.outcome}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Live Signal Journal & Rejections */}
        {activeTab === 'journal' && (
          <div className="space-y-4">
            {/* Rejection Code Breakdown Pills */}
            <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Signal Rejection Breakdown by Exact Reason:</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  'BAD_RR',
                  'MTF_CONFLICT',
                  'LOW_VOLATILITY_BREAKOUT_REJECTED',
                  'LIQUIDITY_SWEEP_RISK',
                  'RANGE_BREAKOUT_REJECTED',
                  'WEAK_STRUCTURE',
                  'WEAK_MOMENTUM',
                ].map((code) => {
                  const count = rejMap[code] || 0;
                  return (
                    <div
                      key={code}
                      className="px-3 py-1.5 rounded-lg bg-[#121B2E] border border-[#1A263D] flex items-center gap-2 text-xs font-mono"
                    >
                      <span className="font-bold text-slate-300">{code}:</span>
                      <span className={`font-bold px-1.5 py-0.2 rounded ${count > 0 ? 'bg-indigo-950 text-indigo-400' : 'text-slate-500'}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signal Log Table */}
            <div className="bg-[#0B1120] border border-[#162238] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0E1628] text-slate-400 border-b border-[#1A263D] text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Decision</th>
                    <th className="py-2.5 px-3">Regime</th>
                    <th className="py-2.5 px-3">Quality</th>
                    <th className="py-2.5 px-3">MTF</th>
                    <th className="py-2.5 px-3">Sweep Risk</th>
                    <th className="py-2.5 px-3">Rejection Code & Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#162238]">
                  {signals.map((sig) => (
                    <tr key={sig.id} className="hover:bg-[#121B2E]">
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(sig.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{sig.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sig.decision === 'EXECUTE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : sig.decision === 'WATCH' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {sig.decision}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{sig.regime}</td>
                      <td className="py-3 px-3 font-bold text-slate-200">{sig.qualityScore}/100</td>
                      <td className="py-3 px-3 text-cyan-400">{sig.mtfAlignment}%</td>
                      <td className="py-3 px-3">
                        {sig.liquiditySweepState ? (
                          <span className="text-rose-400 font-bold">YES</span>
                        ) : (
                          <span className="text-slate-500">NO</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {sig.rejectionCode ? (
                          <span>
                            <span className="font-bold text-amber-400">[{sig.rejectionCode}]</span> {sig.rejectionReason}
                          </span>
                        ) : (
                          <span className="text-emerald-400">Qualified setup generated.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: 60-Day Forward Protocol */}
        {activeTab === 'forward_test' && (
          <div className="space-y-6">
            <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    60-Day Forward Validation Protocol
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Continuous out-of-sample forward evaluation on live market data without parameter adjustments.
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                    STATUS: ACTIVE (Day 1 / 60)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#0E1628] border border-[#1A263D]">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Primary Validation Assets (Statistical Edge Focus)</h4>
                  <ul className="text-xs space-y-2 text-slate-300">
                    <li className="flex items-center justify-between">
                      <span className="font-bold">BTCUSDT 1h</span>
                      <span className="text-slate-400">Phase 6 OOS: PF 2.25 | Exp +0.19R</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="font-bold">XAUUSD 1h</span>
                      <span className="text-slate-400">Phase 6 Rolling: PF 666.59 | Exp +0.32R</span>
                    </li>
                  </ul>
                  <p className="text-[11px] text-slate-500 mt-3">Target: Accumulate ≥ 30 independent trades per asset under frozen parameters.</p>
                </div>

                <div className="p-4 rounded-xl bg-[#0E1628] border border-[#1A263D]">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Secondary Observation Assets</h4>
                  <ul className="text-xs space-y-1.5 text-slate-300">
                    <li>ETHUSDT 1h & 15m (Overfitting audit observation)</li>
                    <li>BTCUSDT 15m (Sweep rejection verification)</li>
                    <li>EURUSD & GBPUSD 15m/1h (Pip-calibrated Forex observation)</li>
                  </ul>
                  <p className="text-[11px] text-slate-500 mt-2">Zero trades is an accepted statistical outcome for non-qualifying regimes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Isolated Forex A/B Research Experiment */}
        {activeTab === 'ab_experiment' && (
          <div className="space-y-6">
            <div className="bg-[#0B1120] border border-[#162238] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-cyan-400" />
                    Isolated Forex A/B Research Experiment
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Comparative evaluation of R:R thresholds (1.5R vs 1.4R vs 1.3R) strictly during London/NY Overlap (12:00-16:00 UTC).
                  </p>
                </div>
                <button
                  onClick={runAbExperiment}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
                >
                  Run Experiment
                </button>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Strict Isolation Notice:</strong> This experiment is purely exploratory and does NOT modify the frozen strategy parameters or affect live paper trading balances.
                </span>
              </div>

              {abReport ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Variant A */}
                    <div className="p-4 rounded-xl bg-[#0E1628] border border-indigo-700/40">
                      <div className="text-xs font-bold text-indigo-400">Variant A (Baseline)</div>
                      <div className="text-lg font-bold text-white mt-1">R:R ≥ 1.5R</div>
                      <div className="text-xs space-y-1 text-slate-300 mt-3 font-mono">
                        <div>Trades: {abReport.variants.variantA.trades}</div>
                        <div>Win Rate: {abReport.variants.variantA.winRate}%</div>
                        <div>Profit Factor: {abReport.variants.variantA.profitFactor}</div>
                        <div>Expectancy: {abReport.variants.variantA.expectancyR}R</div>
                        <div>Net PnL: ${abReport.variants.variantA.netPnlUsd}</div>
                      </div>
                    </div>

                    {/* Variant B */}
                    <div className="p-4 rounded-xl bg-[#0E1628] border border-cyan-700/40">
                      <div className="text-xs font-bold text-cyan-400">Variant B (Relaxed)</div>
                      <div className="text-lg font-bold text-white mt-1">R:R ≥ 1.4R</div>
                      <div className="text-xs space-y-1 text-slate-300 mt-3 font-mono">
                        <div>Trades: {abReport.variants.variantB.trades}</div>
                        <div>Win Rate: {abReport.variants.variantB.winRate}%</div>
                        <div>Profit Factor: {abReport.variants.variantB.profitFactor}</div>
                        <div>Expectancy: {abReport.variants.variantB.expectancyR}R</div>
                        <div>Net PnL: ${abReport.variants.variantB.netPnlUsd}</div>
                      </div>
                    </div>

                    {/* Variant C */}
                    <div className="p-4 rounded-xl bg-[#0E1628] border border-purple-700/40">
                      <div className="text-xs font-bold text-purple-400">Variant C (Aggressive Intraday)</div>
                      <div className="text-lg font-bold text-white mt-1">R:R ≥ 1.3R</div>
                      <div className="text-xs space-y-1 text-slate-300 mt-3 font-mono">
                        <div>Trades: {abReport.variants.variantC.trades}</div>
                        <div>Win Rate: {abReport.variants.variantC.winRate}%</div>
                        <div>Profit Factor: {abReport.variants.variantC.profitFactor}</div>
                        <div>Expectancy: {abReport.variants.variantC.expectancyR}R</div>
                        <div>Net PnL: ${abReport.variants.variantC.netPnlUsd}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0E1628] border border-[#1A263D] text-xs text-slate-300">
                    <span className="font-bold text-white">Conclusion: </span>
                    {abReport.hypothesisConclusion}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Click &ldquo;Run Experiment&rdquo; to execute the 3-way comparative simulation on EURUSD London/NY overlap candles.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
