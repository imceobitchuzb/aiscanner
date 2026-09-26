'use client';

import React from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { Activity, CheckCircle2, Cpu, Database, Server, ShieldCheck, Zap } from 'lucide-react';

export default function AdminPage() {
  const systemHealth = [
    { service: 'Binance Public Market API', status: 'ONLINE', latency: '42ms', uptime: '99.98%' },
    { service: 'PostgreSQL Operational DB', status: 'ONLINE', latency: '2ms', uptime: '100.0%' },
    { service: 'Redis State & Order Cache', status: 'ONLINE', latency: '0.8ms', uptime: '100.0%' },
    { service: 'NEXUS Quantitative ML Engine', status: 'ONLINE', latency: '14ms', uptime: '99.95%' },
    { service: 'Real-time WebSocket Gateway', status: 'ONLINE', latency: '18ms', uptime: '99.99%' },
  ];

  const adminStats = [
    { label: 'Active Terminal Users', val: '4,892' },
    { label: 'Calculated Signals Today', val: '1,420' },
    { label: 'Backtests Executed', val: '18,650' },
    { label: 'Active Price / Regime Alerts', val: '842' },
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
        <div className="flex items-center justify-between pb-3 border-b border-[#162032]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
              NEXUS System Health &amp; Operator Dashboard
            </h1>
          </div>
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ALL SYSTEMS OPERATIONAL
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-tabular text-xs">
          {adminStats.map((st) => (
            <div key={st.label} className="terminal-card p-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{st.label}</span>
              <div className="text-xl font-extrabold text-slate-100">{st.val}</div>
            </div>
          ))}
        </div>

        {/* System Services Health Table */}
        <div className="terminal-card overflow-hidden">
          <div className="p-3 border-b border-[#162032] text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-400" />
            <span>Infrastructure Health Status</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-tabular border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#162032] bg-[#070A12] text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-4">Service Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Round-Trip Latency</th>
                  <th className="py-2.5 px-4 text-right">30-Day Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121A2A]">
                {systemHealth.map((item) => (
                  <tr key={item.service} className="hover:bg-[#0E1528] transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200">{item.service}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{item.latency}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">{item.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
