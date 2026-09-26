'use client';

import React from 'react';
import { SignalQualityBreakdown } from '@/lib/types';
import { Gauge, ShieldCheck } from 'lucide-react';

interface SignalQualityMeterProps {
  quality: SignalQualityBreakdown;
}

export const SignalQualityMeter: React.FC<SignalQualityMeterProps> = ({ quality }) => {
  const factors = [
    { label: 'Trend Alignment', val: quality.trendScore, max: 20, isPositive: true },
    { label: 'Momentum Velocity', val: quality.momentumScore, max: 20, isPositive: true },
    { label: 'Market Structure & OB', val: quality.structureScore, max: 20, isPositive: true },
    { label: 'Volume Expansion', val: quality.volumeScore, max: 15, isPositive: true },
    { label: 'MTF Synchronization', val: quality.mtfScore, max: 15, isPositive: true },
    { label: 'Volatility / Liquidity Penalty', val: -quality.riskPenalty, max: 10, isPositive: false },
    { label: 'Macro / News Event Risk', val: -quality.newsPenalty, max: 5, isPositive: false },
  ];

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Signal Quality Engine
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-tabular">
            <span className="text-base font-extrabold text-slate-100">{quality.overallScore}</span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#050810] h-2 rounded-full overflow-hidden mb-3 border border-[#162032]">
          <div
            className={`h-full transition-all duration-700 ${
              quality.overallScore >= 75
                ? 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                : quality.overallScore >= 60
                ? 'bg-gradient-to-r from-amber-500 to-indigo-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${quality.overallScore}%` }}
          />
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-1.5">
          {factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] font-tabular">
              <span className="text-slate-400">{f.label}</span>
              <span className={`font-semibold ${
                f.isPositive 
                  ? 'text-emerald-400' 
                  : f.val < 0 
                  ? 'text-rose-400' 
                  : 'text-slate-400'
              }`}>
                {f.val > 0 ? `+${f.val}` : f.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Threshold Condition */}
      <div className="p-2 rounded bg-[#070A14] border border-[#162032] text-slate-400 text-[10px] mt-3">
        Threshold filter: Setups requiring <strong className="text-slate-200">≥ 60 score</strong> for automated signal validation.
      </div>
    </div>
  );
};
