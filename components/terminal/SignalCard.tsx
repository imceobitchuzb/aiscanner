'use client';

import React from 'react';
import { AISignal } from '@/lib/types';
import { UnifiedSignalResult } from '@/lib/quant/signalDecisionEngine';
import { 
  AlertOctagon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Zap 
} from 'lucide-react';

interface SignalCardProps {
  signal?: AISignal;
  unifiedSignal?: UnifiedSignalResult | null;
  dataSource?: string;
  dataFreshness?: string;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  unifiedSignal,
  dataSource,
  dataFreshness,
}) => {
  // Extract either from unifiedSignal or legacy signal
  const direction = unifiedSignal ? unifiedSignal.direction : signal?.direction || 'NEUTRAL';
  const setupState = unifiedSignal ? unifiedSignal.setupState : (direction !== 'NEUTRAL' ? 'ACTIVE' : 'NO_SETUP');
  const setupGrade = unifiedSignal ? unifiedSignal.setupGrade : signal?.setupGrade || 'NONE';
  const setupQuality = unifiedSignal ? unifiedSignal.setupQuality : signal?.quality.overallScore || 0;
  const modelConfidence = unifiedSignal ? unifiedSignal.modelConfidence : signal?.confidence || 0;
  const tradePlan = unifiedSignal?.tradePlan || null;

  const isUp = direction === 'LONG';
  const isDown = direction === 'SHORT';
  const isNoSetup = direction === 'NEUTRAL' || setupState === 'NO_SETUP';

  const badgeStyle = isNoSetup
    ? 'bg-slate-900/60 text-slate-300 border-slate-700/60'
    : isUp
    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/70 shadow-bull-glow'
    : 'bg-rose-950/40 text-rose-300 border-rose-600/70 shadow-bear-glow';

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              AI Сигнальный Движок (Decision Engine)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {dataSource && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0D1527] border border-[#1C2A44] text-slate-400 font-tabular">
                {dataSource} • {dataFreshness || 'LIVE'}
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-extrabold font-mono text-[11px]">
              ГРЕЙД: {setupGrade}
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
              <ShieldAlert className="h-6 w-6 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-wider uppercase">
                  {isNoSetup
                    ? 'НЕТ СЕТАПА (ВНЕ РЫНКА)'
                    : isUp
                    ? 'ВХОД ВВЕРХ (LONG ↗)'
                    : 'ВХОД ВНИЗ (SHORT ↘)'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                  {setupState}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-tabular flex items-center gap-2 mt-0.5">
                <span>Уверенность модели: <strong className="text-slate-100">{modelConfidence}%</strong></span>
                {tradePlan && (
                  <>
                    <span>•</span>
                    <span>R:R: <strong className="text-emerald-400">{tradePlan.riskRewardRatio}x</strong></span>
                    <span>•</span>
                    <span>Стратегия: <strong className="text-slate-200">{tradePlan.entryStrategy}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Качество</span>
            <span className="text-sm font-black font-tabular text-slate-100">
              {setupQuality}/100
            </span>
          </div>
        </div>

        {/* Trade Plan or No-Setup Details */}
        {tradePlan && !isNoSetup ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 font-tabular">
            <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
              <span className="text-[10px] text-slate-400 block mb-0.5">Зона входа (Entry)</span>
              <span className="font-bold text-slate-200 text-[11px]">
                ${tradePlan.entryZone[0].toLocaleString()} - ${tradePlan.entryZone[1].toLocaleString()}
              </span>
            </div>

            <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
              <span className="text-[10px] text-rose-400 block mb-0.5">Защита (Stop Loss)</span>
              <span className="font-bold text-rose-400 text-[11px]">
                ${tradePlan.stopLoss.toLocaleString()} ({tradePlan.stopLossPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
              <span className="text-[10px] text-emerald-400 block mb-0.5">Цель 1 (TP1)</span>
              <span className="font-bold text-emerald-400 text-[11px]">
                ${tradePlan.takeProfit1.toLocaleString()}
              </span>
            </div>

            <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
              <span className="text-[10px] text-emerald-400 block mb-0.5">Цель 2 (TP2)</span>
              <span className="font-bold text-emerald-400 text-[11px]">
                ${tradePlan.takeProfit2.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded bg-[#0A0E1A] border border-[#1A2538] mb-3 text-[11px]">
            <span className="font-bold text-amber-400 uppercase tracking-wider block mb-1">
              Причина отсутствия торгового сетапа:
            </span>
            <p className="text-slate-300">
              {unifiedSignal?.rejectionReason || 'Рынок находится в фазе горизонтального накопления без явного направленного перевеса. Позиция не открывается для сохранения депозита.'}
            </p>
          </div>
        )}

        {/* EVIDENCE / РЕШАЮЩИЕ ФАКТОРЫ */}
        {unifiedSignal && unifiedSignal.evidence.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Подтверждающие факторы (Evidence Model)
            </span>
            <div className="space-y-1">
              {unifiedSignal.evidence.slice(0, 4).map((ev, idx) => (
                <div key={idx} className="flex items-start justify-between text-[11px] text-slate-300 bg-[#060913] p-1.5 rounded border border-[#121A2A]">
                  <div className="flex items-start gap-1.5">
                    <span className={ev.contribution >= 0 ? 'text-emerald-400 font-bold shrink-0' : 'text-rose-400 font-bold shrink-0'}>
                      {ev.contribution >= 0 ? '+' : ''}{ev.contribution}
                    </span>
                    <div>
                      <strong className="text-slate-200">{ev.name}: </strong>
                      <span className="text-slate-400">{ev.reason}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-mono shrink-0 ml-2">{ev.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* РИСКИ И ОГРАНИЧЕНИЯ */}
        {unifiedSignal && unifiedSignal.riskWarnings.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 mb-1.5">
              <AlertOctagon className="h-3.5 w-3.5 text-amber-400" />
              Факторы риска и предупреждения
            </span>
            <div className="space-y-1">
              {unifiedSignal.riskWarnings.map((risk, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0">⚠</span>
                  <span className="leading-snug">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* УСЛОВИЕ ИНВАЛИДАЦИИ */}
      <div className="p-2.5 rounded bg-rose-950/20 border border-rose-900/50 text-[11px] text-rose-200 mt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-0.5">
          Условие отмены идеи (Инвалидация)
        </span>
        <p className="leading-tight">
          {unifiedSignal?.invalidationCriteria[0] || signal?.invalidation || 'Закрытие свечи против структурного экстремума.'}
        </p>
      </div>
    </div>
  );
};
