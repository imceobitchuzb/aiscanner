'use client';

import React from 'react';
import { AISignal } from '@/lib/types';
import { 
  AlertOctagon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CheckCircle2, 
  Zap 
} from 'lucide-react';

interface SignalCardProps {
  signal: AISignal;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const isUp = signal.direction === 'LONG';
  const isDown = signal.direction === 'SHORT';

  const badgeStyle = isUp
    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/70 shadow-bull-glow'
    : isDown
    ? 'bg-rose-950/40 text-rose-300 border-rose-600/70 shadow-bear-glow'
    : 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              AI Анализ сетапа и сигнал
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Грейд качества:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-extrabold font-mono text-[11px]">
              {signal.setupGrade}
            </span>
          </div>
        </div>

        {/* Direction & Main Signal Banner */}
        <div className={`p-3 rounded-lg border ${badgeStyle} mb-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            {isUp ? (
              <ArrowUpCircle className="h-6 w-6 text-emerald-400 shrink-0" />
            ) : isDown ? (
              <ArrowDownCircle className="h-6 w-6 text-rose-400 shrink-0" />
            ) : (
              <div className="h-6 w-6 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400">
                —
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-wider uppercase">
                  {isUp ? 'ВХОД ВВЕРХ (ПОКУПКА)' : isDown ? 'ВХОД ВНИЗ (ПРОДАЖА)' : 'ВНЕ РЫНКА (ОЖИДАНИЕ)'}
                </span>
                <span className="text-[10px] font-bold text-slate-200">
                  Уверенность: {signal.confidence}%
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-tabular flex items-center gap-2 mt-0.5">
                <span>Прибыль/Риск: <strong className="text-emerald-400">{signal.riskRewardRatio}x</strong></span>
                <span>•</span>
                <span>Удержание: <strong className="text-slate-100">{signal.expectedHoldingTime}</strong></span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Скоринг</span>
            <span className="text-sm font-black font-tabular text-slate-100">
              {signal.quality.overallScore}/100
            </span>
          </div>
        </div>

        {/* Price Execution Zones Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 font-tabular">
          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Зона входа</span>
            <span className="font-bold text-slate-200 text-[11px]">
              ${signal.entryZone[0].toLocaleString()} - ${signal.entryZone[1].toLocaleString()}
            </span>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-rose-400 block mb-0.5">Защита (Stop Loss)</span>
            <span className="font-bold text-rose-400 text-[11px]">
              ${signal.stopLoss.toLocaleString()}
            </span>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-emerald-400 block mb-0.5">Цель 1 (TP1)</span>
            <span className="font-bold text-emerald-400 text-[11px]">
              ${signal.takeProfit1.toLocaleString()}
            </span>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-emerald-400 block mb-0.5">Цель 2 (TP2)</span>
            <span className="font-bold text-emerald-400 text-[11px]">
              ${signal.takeProfit2.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ПОЧЕМУ СЕТАП СФОРМИРОВАН */}
        <div className="mb-3">
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Почему сформирован этот сетап (Факты и аргументы)
          </span>
          <div className="space-y-1">
            {signal.whyList.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span className="leading-snug">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* РИСКИ И ОГРАНИЧЕНИЯ */}
        <div className="mb-3">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 mb-1.5">
            <AlertOctagon className="h-3.5 w-3.5 text-amber-400" />
            Риски и ограничения
          </span>
          <div className="space-y-1">
            {signal.riskList.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                <span className="text-amber-400 font-bold shrink-0">⚠</span>
                <span className="leading-snug">{risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* УСЛОВИЕ ОТМЕНЫ */}
      <div className="p-2.5 rounded bg-rose-950/20 border border-rose-900/50 text-[11px] text-rose-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-0.5">
          Условие отмены идеи (Инвалидация)
        </span>
        <p className="leading-tight">{signal.invalidation}</p>
      </div>
    </div>
  );
};
