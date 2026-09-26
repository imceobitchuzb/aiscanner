'use client';

import React, { useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { ASSET_CATALOG } from '@/lib/market/assetMetadata';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { Timeframe } from '@/lib/market/types';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle2, 
  Dices, 
  Download, 
  Layers, 
  LineChart, 
  Play, 
  RefreshCw, 
  Scale, 
  ShieldAlert, 
  SlidersHorizontal, 
  TrendingDown, 
  TrendingUp, 
  Zap 
} from 'lucide-react';

export default function BacktestPage() {
  const [asset, setAsset] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candleLimit, setCandleLimit] = useState<number>(300);
  const [initialBalance, setInitialBalance] = useState<number>(10000);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [feesBps, setFeesBps] = useState<number>(5);
  const [slippageBps, setSlippageBps] = useState<number>(3);
  const [collisionRule, setCollisionRule] = useState<'SL_FIRST' | 'TP_FIRST'>('SL_FIRST');
  const [minRiskReward, setMinRiskReward] = useState<number>(1.5);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runHistoricalTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          timeframe,
          limit: candleLimit,
          initialBalance,
          riskPerTradePercent: riskPerTrade,
          feesBps,
          slippageBps,
          collisionRule,
          minRiskReward,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP error ${res.status}`);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска исторического тестирования.');
    } finally {
      setLoading(false);
    }
  };

  const replay = result?.replay;
  const walkForward = result?.walkForward;
  const monteCarlo = result?.monteCarlo;
  const sensitivity = result?.sensitivity;
  const calibration = result?.calibration;
  const ablation = result?.ablation;

  return (
    <div className="min-h-screen bg-[#06090e] text-[#e1e7ec] flex flex-col font-mono text-xs">
      <Header
        currentSymbol={asset}
        onSelectSymbol={(sym) => setAsset(sym)}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Title Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b2533] pb-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-base tracking-wider uppercase">
              <Scale className="w-5 h-5" />
              <span>Historical Replay & Quant Verification Engine</span>
            </div>
            <p className="text-[#8899a6] text-xs mt-1">
              Последовательное воспроизведение рынка свеча-за-свечой без заглядывания в будущее (Zero Look-Ahead Bias). Строго на реальных котировках.
            </p>
          </div>

          <button
            onClick={runHistoricalTest}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider rounded transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {loading ? 'Воспроизведение...' : 'Запустить Historical Test'}
          </button>
        </div>

        {/* Configuration Panel */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Инструмент</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white font-bold"
            >
              {Object.keys(ASSET_CATALOG).map((sym) => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Таймфрейм</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            >
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
            </select>
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Свечей истории</label>
            <input
              type="number"
              value={candleLimit}
              onChange={(e) => setCandleLimit(Number(e.target.value))}
              min={60}
              max={1000}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            />
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Капитал ($)</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            />
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Риск / трейд (%)</label>
            <input
              type="number"
              step={0.5}
              value={riskPerTrade}
              onChange={(e) => setRiskPerTrade(Number(e.target.value))}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            />
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Комиссия (bps)</label>
            <input
              type="number"
              value={feesBps}
              onChange={(e) => setFeesBps(Number(e.target.value))}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            />
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Проскальзывание</label>
            <input
              type="number"
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            />
          </div>

          <div>
            <label className="text-[#8899a6] text-[10px] uppercase font-bold">Правило коллизий</label>
            <select
              value={collisionRule}
              onChange={(e) => setCollisionRule(e.target.value as any)}
              className="mt-1 w-full bg-[#121b24] border border-[#233142] rounded px-2 py-1.5 text-white"
            >
              <option value="SL_FIRST">SL First (Консервативно)</option>
              <option value="TP_FIRST">TP First</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/50 p-4 rounded text-red-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-bold">Ошибка бэктеста:</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Results Overview */}
        {replay && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Всего сделок</div>
                <div className="text-xl font-bold text-white mt-1">{replay.totalTradesExecuted}</div>
                <div className="text-[10px] text-[#8899a6]">Long: {replay.longTrades} | Short: {replay.shortTrades}</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Win Rate</div>
                <div className={`text-xl font-bold mt-1 ${replay.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {replay.winRate}%
                </div>
                <div className="text-[10px] text-[#8899a6]">Wins: {replay.wins} | Losses: {replay.losses}</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Profit Factor</div>
                <div className={`text-xl font-bold mt-1 ${replay.profitFactor >= 1.5 ? 'text-emerald-400' : replay.profitFactor >= 1.0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {replay.profitFactor}
                </div>
                <div className="text-[10px] text-[#8899a6]">Gross Wins / Losses</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Expectancy (R)</div>
                <div className={`text-xl font-bold mt-1 ${replay.expectancyR > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {replay.expectancyR > 0 ? `+${replay.expectancyR}` : replay.expectancyR}R
                </div>
                <div className="text-[10px] text-[#8899a6]">Avg R: {replay.averageR}R</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Net PnL</div>
                <div className={`text-xl font-bold mt-1 ${replay.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {replay.netPnlUsd >= 0 ? `+$${replay.netPnlUsd}` : `-$${Math.abs(replay.netPnlUsd)}`}
                </div>
                <div className="text-[10px] text-[#8899a6]">Комиссии: -${replay.totalFeesUsd}</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Max Drawdown</div>
                <div className="text-xl font-bold text-red-400 mt-1">
                  -{replay.maxDrawdownPercent}%
                </div>
                <div className="text-[10px] text-[#8899a6]">-${replay.maxDrawdownUsd}</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Sharpe / Sortino</div>
                <div className="text-xl font-bold text-white mt-1">
                  {replay.sharpeRatio} / {replay.sortinoRatio}
                </div>
                <div className="text-[10px] text-[#8899a6]">Risk-adjusted</div>
              </div>

              <div className="bg-[#0d131a] p-3 rounded border border-[#1b2533]">
                <div className="text-[#8899a6] text-[10px] uppercase font-bold">Avg MFE / MAE</div>
                <div className="text-xl font-bold text-cyan-300 mt-1">
                  +{replay.averageMfePercent}% / -{replay.averageMaePercent}%
                </div>
                <div className="text-[10px] text-[#8899a6]">Excursion stats</div>
              </div>
            </div>

            {/* Equity Curve & Drawdown View */}
            <div className="bg-[#0d131a] p-5 rounded-lg border border-[#1b2533]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-bold text-white uppercase tracking-wider">
                  <LineChart className="w-4 h-4 text-cyan-400" />
                  <span>Кривая капитала (Equity Curve) & Просадки</span>
                </div>
                <div className="text-xs text-[#8899a6]">
                  Баланс: <span className="text-white font-bold">${replay.finalBalance}</span> (Старт: ${replay.config.initialBalance})
                </div>
              </div>

              {/* Simple ASCII / Visual Equity Chart representation */}
              <div className="h-44 bg-[#080d12] rounded border border-[#17222e] p-3 flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between text-[10px] text-[#556677] border-b border-[#141d27] pb-1">
                  <span>Start: ${replay.config.initialBalance}</span>
                  <span>Peak: ${Math.max(...replay.equityCurve.map((e: any) => e.equity))}</span>
                  <span>End: ${replay.finalBalance}</span>
                </div>

                <div className="flex-1 flex items-end gap-1 pt-2 pb-2">
                  {replay.equityCurve.map((pt: any, i: number) => {
                    const minEq = Math.min(...replay.equityCurve.map((e: any) => e.equity)) * 0.98;
                    const maxEq = Math.max(...replay.equityCurve.map((e: any) => e.equity)) * 1.02;
                    const range = Math.max(1, maxEq - minEq);
                    const heightPct = Math.max(5, Math.min(100, ((pt.equity - minEq) / range) * 100));
                    const isProfit = pt.equity >= replay.config.initialBalance;

                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end items-center group relative h-full"
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t transition-all ${isProfit ? 'bg-cyan-500/80 group-hover:bg-cyan-400' : 'bg-red-500/80 group-hover:bg-red-400'}`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-[#556677] flex justify-between border-t border-[#141d27] pt-1">
                  <span>Свеча: {replay.totalCandles} шт.</span>
                  <span>Max Drawdown: -{replay.maxDrawdownPercent}%</span>
                  <span>Сделок: {replay.totalTradesExecuted}</span>
                </div>
              </div>
            </div>

            {/* Quality Breakdowns (Regime, Confidence, R:R, Direction) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Regime Breakdown */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Эффективность по рыночным режимам (Regimes)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-[#8899a6] border-b border-[#1b2533]">
                        <th className="pb-2">Режим</th>
                        <th className="pb-2">Сделок</th>
                        <th className="pb-2">Win Rate</th>
                        <th className="pb-2">Profit Factor</th>
                        <th className="pb-2">Expectancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141d27]">
                      {Object.entries(replay.breakdownByRegime).map(([reg, m]: [string, any]) => (
                        <tr key={reg} className="hover:bg-[#121a24]">
                          <td className="py-2 text-white font-bold">{reg}</td>
                          {m === 'INSUFFICIENT_SAMPLE' ? (
                            <td colSpan={4} className="py-2 text-[#667788] italic">INSUFFICIENT_SAMPLE (&lt; 3 трейдов)</td>
                          ) : (
                            <>
                              <td className="py-2">{m.signals}</td>
                              <td className={`py-2 font-bold ${m.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{m.winRate}%</td>
                              <td className="py-2">{m.profitFactor}</td>
                              <td className="py-2">{m.expectancyR}R</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confidence Calibration */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Калибровка уверенности (Confidence Buckets)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-[#8899a6] border-b border-[#1b2533]">
                        <th className="pb-2">Диапазон</th>
                        <th className="pb-2">Сделок</th>
                        <th className="pb-2">Факт. Win Rate</th>
                        <th className="pb-2">Дельта</th>
                        <th className="pb-2">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141d27]">
                      {calibration?.buckets?.map((b: any) => (
                        <tr key={b.bucketRange} className="hover:bg-[#121a24]">
                          <td className="py-2 text-white font-bold">{b.bucketRange}</td>
                          <td className="py-2">{b.sampleCount}</td>
                          {b.status === 'INSUFFICIENT_SAMPLE' ? (
                            <td colSpan={3} className="py-2 text-[#667788] italic">INSUFFICIENT_SAMPLE</td>
                          ) : (
                            <>
                              <td className="py-2 font-bold text-cyan-300">{b.realizedWinRate}%</td>
                              <td className="py-2">{b.calibrationDelta > 0 ? `+${b.calibrationDelta}` : b.calibrationDelta}%</td>
                              <td className="py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${b.status === 'CALIBRATED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                                  {b.status}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-[11px] text-[#8899a6] border-t border-[#1b2533] pt-2">
                  Вердикт: <span className="text-white">{calibration?.verdict}</span> (ECE: {calibration?.expectedCalibrationError}%)
                </div>
              </div>
            </div>

            {/* Phase 4: Signal Attribution, Rejection Funnel & Regime Coverage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rejection Funnel & Histogram */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                    <span>Воронка отбора сигналов (Rejection Funnel)</span>
                  </div>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    Свечей: {replay.rejectionFunnel?.potentialBars || 0}
                  </span>
                </div>

                {replay.rejectionFunnel && (
                  <div className="space-y-2 mb-4 bg-[#080d12] p-3 rounded border border-[#17222e]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8899a6]">1. Потенциальные бары:</span>
                      <span className="font-bold text-white">{replay.rejectionFunnel.potentialBars}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8899a6]">2. Прошли структуру (Swing S/R):</span>
                      <span className="font-bold text-blue-300">{replay.rejectionFunnel.structurePassed}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8899a6]">3. Прошли режим рынка (Regime):</span>
                      <span className="font-bold text-indigo-300">{replay.rejectionFunnel.regimePassed}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8899a6]">4. Прошли MTF синхронизацию:</span>
                      <span className="font-bold text-purple-300">{replay.rejectionFunnel.mtfPassed}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8899a6]">5. Прошли риск-фильтры (R:R &gt;= 1.5, SL &lt;= 3.5 ATR):</span>
                      <span className="font-bold text-amber-300">{replay.rejectionFunnel.riskPassed}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] border-t border-[#1a2636] pt-1 font-bold">
                      <span className="text-emerald-400">6. Финальные подтверждённые сигналы:</span>
                      <span className="text-emerald-400">{replay.rejectionFunnel.finalSignals}</span>
                    </div>
                  </div>
                )}

                <div className="text-[10px] uppercase font-bold text-[#8899a6] mb-2">Причины отклонения сетапов:</div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {replay.rejectionHistogram && Object.entries(replay.rejectionHistogram).map(([code, count]: [string, any]) => (
                    <div key={code} className="bg-[#101721] p-1.5 rounded flex justify-between items-center border border-[#182330]">
                      <span className="text-[#778899] truncate mr-1">{code}</span>
                      <span className="font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Quality & Market Regime Coverage */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Аудит качества датасета & Покрытие режимов</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${replay.dataQuality?.status === 'DATASET_VALID' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                    {replay.dataQuality?.status || 'VALID'}
                  </span>
                </div>

                {replay.dataQuality && (
                  <div className="grid grid-cols-4 gap-2 text-center bg-[#080d12] p-2.5 rounded border border-[#17222e] mb-4">
                    <div>
                      <div className="text-[#667788] text-[9px]">Покрытие</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">{replay.dataQuality.coveragePercent}%</div>
                    </div>
                    <div>
                      <div className="text-[#667788] text-[9px]">Пропусков</div>
                      <div className="text-xs font-bold text-white mt-0.5">{replay.dataQuality.timestampGapsCount}</div>
                    </div>
                    <div>
                      <div className="text-[#667788] text-[9px]">Дубликатов</div>
                      <div className="text-xs font-bold text-white mt-0.5">{replay.dataQuality.duplicateCount}</div>
                    </div>
                    <div>
                      <div className="text-[#667788] text-[9px]">OHLC ошибок</div>
                      <div className="text-xs font-bold text-white mt-0.5">{replay.dataQuality.ohlcViolationCount}</div>
                    </div>
                  </div>
                )}

                <div className="text-[10px] uppercase font-bold text-[#8899a6] mb-2">Распределение рыночных режимов:</div>
                <div className="space-y-1.5">
                  {replay.regimeCoverage && Object.entries(replay.regimeCoverage).map(([reg, item]: [string, any]) => (
                    <div key={reg} className="text-[10px] flex items-center justify-between bg-[#101721] p-1.5 rounded border border-[#182330]">
                      <span className="text-white font-bold">{reg}</span>
                      <span className="text-[#8899a6]">{item.count} свечей ({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Phase 4: Filter Ablation Analysis Table */}
            {ablation && (
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-cyan-400" />
                    <span>Filter Ablation Analysis (Маржинальная полезность фильтров)</span>
                  </div>
                  <span className="text-[10px] text-[#8899a6]">
                    Baseline vs Scenarios
                  </span>
                </div>
                <div className="text-[11px] text-[#8899a6] mb-3">
                  {ablation.summaryConclusion}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-[#8899a6] border-b border-[#1b2533]">
                        <th className="pb-2">Сценарий</th>
                        <th className="pb-2">Отключённый фильтр</th>
                        <th className="pb-2">Сигналов</th>
                        <th className="pb-2">Сделок</th>
                        <th className="pb-2">Win Rate</th>
                        <th className="pb-2">Expectancy</th>
                        <th className="pb-2">Profit Factor</th>
                        <th className="pb-2">Max DD</th>
                        <th className="pb-2">Вердикт</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141d27]">
                      {ablation.scenarios.map((sc: any) => (
                        <tr key={sc.scenarioId} className="hover:bg-[#121a24]">
                          <td className="py-2 text-white font-bold">{sc.name}</td>
                          <td className="py-2 text-[#8899a6]">{sc.filterDisabled}</td>
                          <td className="py-2 font-mono text-cyan-300">{sc.signalsCount}</td>
                          <td className="py-2 font-mono">{sc.tradesCount}</td>
                          <td className="py-2 font-mono">{sc.winRate}%</td>
                          <td className="py-2 font-mono font-bold">{sc.expectancyR > 0 ? `+${sc.expectancyR}` : sc.expectancyR} R</td>
                          <td className="py-2 font-mono">{sc.profitFactor}</td>
                          <td className="py-2 font-mono text-red-400">-{sc.maxDrawdownPercent}%</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              sc.verdict === 'CRITICAL_PROTECTOR'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : sc.verdict === 'HARMFUL_DRAG'
                                ? 'bg-red-950 text-red-300 border border-red-500/40'
                                : 'bg-slate-900 text-slate-300 border border-slate-700'
                            }`}>
                              {sc.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Walk Forward & Monte Carlo Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Walk Forward */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Walk-Forward Rolling Analysis (In-Sample vs Unseen OOS)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${walkForward?.robustnessGrade === 'ROBUST' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                    {walkForward?.robustnessGrade}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 bg-[#080d12] p-3 rounded border border-[#17222e]">
                  <div>
                    <div className="text-[#8899a6] text-[10px] uppercase">In-Sample (Train)</div>
                    <div className="text-sm font-bold text-white mt-0.5">WR: {walkForward?.aggregateInSample?.winRate}% | PF: {walkForward?.aggregateInSample?.profitFactor}</div>
                  </div>
                  <div>
                    <div className="text-[#8899a6] text-[10px] uppercase">Out-Of-Sample (Unseen)</div>
                    <div className="text-sm font-bold text-cyan-300 mt-0.5">WR: {walkForward?.aggregateOutOfSample?.winRate}% | PF: {walkForward?.aggregateOutOfSample?.profitFactor}</div>
                  </div>
                </div>

                <div className="text-[11px] text-[#8899a6]">
                  Walk-Forward Efficiency (WFE): <span className="text-white font-bold">{walkForward?.meanWFE}</span>. {walkForward?.verdict}
                </div>
              </div>

              {/* Monte Carlo */}
              <div className="bg-[#0d131a] p-4 rounded-lg border border-[#1b2533]">
                <div className="font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dices className="w-4 h-4 text-purple-400" />
                    <span>Monte Carlo 10,000 Bootstrap (Реальные сделки)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${monteCarlo?.riskOfRuinVerdict === 'LOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                    Ruin Risk: {monteCarlo?.riskOfRuinVerdict}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center bg-[#080d12] p-2.5 rounded border border-[#17222e] mb-3">
                  <div>
                    <div className="text-[#667788] text-[9px]">P5 (Worst)</div>
                    <div className="text-xs font-bold text-red-400 mt-0.5">${monteCarlo?.finalEquity?.p5}</div>
                  </div>
                  <div>
                    <div className="text-[#667788] text-[9px]">P25</div>
                    <div className="text-xs font-bold text-amber-400 mt-0.5">${monteCarlo?.finalEquity?.p25}</div>
                  </div>
                  <div>
                    <div className="text-[#667788] text-[9px]">P50 (Median)</div>
                    <div className="text-xs font-bold text-white mt-0.5">${monteCarlo?.finalEquity?.p50}</div>
                  </div>
                  <div>
                    <div className="text-[#667788] text-[9px]">P75</div>
                    <div className="text-xs font-bold text-cyan-300 mt-0.5">${monteCarlo?.finalEquity?.p75}</div>
                  </div>
                  <div>
                    <div className="text-[#667788] text-[9px]">P95 (Best)</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">${monteCarlo?.finalEquity?.p95}</div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-[#8899a6]">
                  <span>Вероятность отриц. исхода: <strong className="text-white">{monteCarlo?.probabilityOfNegativeReturn}%</strong></span>
                  <span>Риск разорения (&gt;50% DD): <strong className="text-red-400">{monteCarlo?.probabilityOfRuin}%</strong></span>
                </div>
              </div>
            </div>

            {/* Limitations & Disclaimers */}
            <div className="bg-[#121820] border border-[#233142] p-4 rounded-lg">
              <div className="flex items-center gap-2 font-bold text-amber-300 mb-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Ограничения модели и раскрытие информации (Anti-Overfitting Rules)</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[#8899a6] text-[11px]">
                {replay.limitations.map((lim: string, idx: number) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
