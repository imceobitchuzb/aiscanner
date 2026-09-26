'use client';

import React, { useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { Bell, BellRing, Check, Plus, Send, ShieldAlert, Trash2, Zap } from 'lucide-react';

interface AlertItem {
  id: string;
  symbol: string;
  timeframe: string;
  minConfidence: number;
  minRR: number;
  direction: 'LONG' | 'SHORT' | 'ANY';
  channel: 'BROWSER' | 'TELEGRAM' | 'EMAIL';
  active: boolean;
  lastTriggered?: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'al-1',
      symbol: 'BTCUSDT',
      timeframe: '1H',
      minConfidence: 75,
      minRR: 2.0,
      direction: 'LONG',
      channel: 'TELEGRAM',
      active: true,
      lastTriggered: '14m ago (Setup Detected: +OB Retest)',
    },
    {
      id: 'al-2',
      symbol: 'ETHUSDT',
      timeframe: '4H',
      minConfidence: 80,
      minRR: 2.5,
      direction: 'LONG',
      channel: 'BROWSER',
      active: true,
      lastTriggered: '2h ago (Breakout Confirmed)',
    },
    {
      id: 'al-3',
      symbol: 'SOLUSDT',
      timeframe: '15m',
      minConfidence: 70,
      minRR: 2.0,
      direction: 'ANY',
      channel: 'TELEGRAM',
      active: true,
    },
  ]);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1H');
  const [minConfidence, setMinConfidence] = useState(75);
  const [minRR, setMinRR] = useState(2.0);
  const [direction, setDirection] = useState<'LONG' | 'SHORT' | 'ANY'>('LONG');
  const [channel, setChannel] = useState<'BROWSER' | 'TELEGRAM' | 'EMAIL'>('TELEGRAM');

  const addAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const newAlert: AlertItem = {
      id: `al-${Date.now()}`,
      symbol,
      timeframe,
      minConfidence,
      minRR,
      direction,
      channel,
      active: true,
    };
    setAlerts([newAlert, ...alerts]);
  };

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol="BTCUSDT"
        onSelectSymbol={() => {}}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-[#162032]">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
              Real-Time Alert Dispatcher &amp; Webhooks
            </h1>
          </div>
          <span className="text-xs text-slate-400 font-tabular">
            {alerts.filter((a) => a.active).length} Active Watchers
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Create Alert Form */}
          <div className="terminal-card p-4 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-[#162032] mb-3 font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              <Plus className="h-4 w-4 text-indigo-400" />
              <span>Configure New Setup Trigger</span>
            </div>

            <form onSubmit={addAlert} className="space-y-3 font-tabular">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Instrument</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-[#050810] border border-[#162032] rounded py-1.5 px-2 text-slate-200 outline-none text-xs"
                >
                  {DEFAULT_ASSETS.map((a) => (
                    <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full bg-[#050810] border border-[#162032] rounded py-1.5 px-2 text-slate-200 outline-none text-xs"
                  >
                    {['15m', '1H', '4H', '1D'].map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as any)}
                    className="w-full bg-[#050810] border border-[#162032] rounded py-1.5 px-2 text-slate-200 outline-none text-xs"
                  >
                    <option value="LONG">LONG Only</option>
                    <option value="SHORT">SHORT Only</option>
                    <option value="ANY">Any Direction</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Minimum Confidence: {minConfidence}%
                </label>
                <input
                  type="range"
                  min="60"
                  max="90"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Minimum Reward/Risk: {minRR}x
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.1"
                  value={minRR}
                  onChange={(e) => setMinRR(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Notification Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full bg-[#050810] border border-[#162032] rounded py-1.5 px-2 text-slate-200 outline-none text-xs"
                >
                  <option value="TELEGRAM">Telegram Bot Webhook</option>
                  <option value="BROWSER">Browser Push Notification</option>
                  <option value="EMAIL">Verified Email Notification</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-ai-glow transition-all"
              >
                Create Alert Rule
              </button>
            </form>
          </div>

          {/* Alert Watchlist */}
          <div className="lg:col-span-2 terminal-card p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Active Trigger Rules
            </span>

            <div className="space-y-2">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className="p-3 rounded-lg bg-[#070B14] border border-[#162032] flex items-center justify-between text-xs font-tabular group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleAlert(al.id)}
                      className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-all ${
                        al.active
                          ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                          : 'bg-[#121826] border-[#1E293B] text-slate-500'
                      }`}
                    >
                      <Bell className="h-3.5 w-3.5" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{al.symbol}</span>
                        <span className="px-1.5 py-0.2 bg-[#162032] text-slate-300 rounded text-[10px]">
                          {al.timeframe}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          al.direction === 'LONG'
                            ? 'text-emerald-400 bg-emerald-950/40'
                            : 'text-rose-400 bg-rose-950/40'
                        }`}>
                          {al.direction}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Confidence &ge; {al.minConfidence}% • R:R &ge; {al.minRR}x • Channel: {al.channel}
                      </div>

                      {al.lastTriggered && (
                        <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                          ⚡ Triggered: {al.lastTriggered}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteAlert(al.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
