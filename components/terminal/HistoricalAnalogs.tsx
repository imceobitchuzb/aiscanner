'use client';

import React from 'react';
import { HistoricalAnalogResult } from '@/lib/types';
import { History } from 'lucide-react';

interface HistoricalAnalogsProps {
  analogs: HistoricalAnalogResult;
}

export const HistoricalAnalogs: React.FC<HistoricalAnalogsProps> = ({ analogs }) => {
  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Исторический аналоговый поиск
            </span>
          </div>

          <span className="px-2 py-0.5 rounded bg-[#162032] text-indigo-300 font-tabular text-[10px] font-bold">
            Найдено ситуаций: {analogs.similarSetupsFound}
          </span>
        </div>

        {/* Aggregated Outcome Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3 font-tabular text-center">
          <div className="p-2 rounded bg-emerald-950/30 border border-emerald-700/50">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Цель взята (TP)</span>
            <span className="text-sm font-black text-emerald-300">{analogs.winRateTP}%</span>
          </div>

          <div className="p-2 rounded bg-rose-950/30 border border-rose-700/50">
            <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">Сработал Stop</span>
            <span className="text-sm font-black text-rose-300">{analogs.lossRateSL}%</span>
          </div>

          <div className="p-2 rounded bg-[#0A0E1A] border border-[#162032]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Флэт / Выход</span>
            <span className="text-sm font-black text-slate-300">{analogs.neutralRate}%</span>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3 font-tabular text-[10px] text-slate-400">
          <div className="p-1.5 rounded bg-[#070A14] border border-[#162032] text-center">
            <span>Средний рост</span>
            <strong className="text-emerald-400 block text-xs mt-0.5 font-bold">+{analogs.averageMovePercent}%</strong>
          </div>
          <div className="p-1.5 rounded bg-[#070A14] border border-[#162032] text-center">
            <span>Макс. просадка</span>
            <strong className="text-rose-400 block text-xs mt-0.5 font-bold">{analogs.averageAdverseMovePercent}%</strong>
          </div>
          <div className="p-1.5 rounded bg-[#070A14] border border-[#162032] text-center">
            <span>Среднее время</span>
            <strong className="text-slate-100 block text-xs mt-0.5 font-bold">{analogs.medianDurationHours} ч</strong>
          </div>
        </div>

        {/* Top Matches Table */}
        <div className="mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Ключевые совпадения в истории
          </span>

          <div className="space-y-1 font-tabular text-[11px]">
            {analogs.topMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2 rounded bg-[#070B14] border border-[#121A2A] hover:bg-[#0E1528] transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-200">{m.date}</div>
                  <div className="text-[10px] text-slate-400">{m.regime}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-indigo-400 font-bold">{m.similarity}% сходство</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                    m.outcome === 'TP'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-700'
                  }`}>
                    {m.outcome === 'TP' ? 'ВЫИГРЫШ' : 'СТОП'} ({m.movePercent >= 0 ? '+' : ''}{m.movePercent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-2 border-t border-[#162032] flex items-center justify-between">
        <span>Математический поиск методом динамической деформации времени (DTW)</span>
        <span className="text-emerald-400 font-bold">Верифицировано</span>
      </div>
    </div>
  );
};
