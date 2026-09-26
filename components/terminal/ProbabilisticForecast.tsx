'use client';

import React from 'react';
import { ProbabilisticForecast as ForecastType } from '@/lib/types';
import { Cpu, Info, Sparkles } from 'lucide-react';

interface ProbabilisticForecastProps {
  forecast: ForecastType;
}

export const ProbabilisticForecast: React.FC<ProbabilisticForecastProps> = ({ forecast }) => {
  const { scenarios, uncertaintyScore, isBaseline } = forecast;

  const getScenarioLabel = (id: string) => {
    switch (id) {
      case 'BULL': return 'СЦЕНАРИЙ: ДВИЖЕНИЕ ВВЕРХ (РОСТ)';
      case 'BEAR': return 'СЦЕНАРИЙ: ДВИЖЕНИЕ ВНИЗ (СПАД)';
      default: return 'СЦЕНАРИЙ: БОКОВИК (ФЛЭТ / КОРИДОР)';
    }
  };

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Вероятностный прогноз движения
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Неопределённость:</span>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-tabular border ${
              uncertaintyScore > 65
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
            }`}>
              {uncertaintyScore}%
            </div>
          </div>
        </div>

        {/* Baseline Transparency Notice */}
        {isBaseline && (
          <div className="mb-3 px-2.5 py-1.5 rounded bg-[#0A1020] border border-[#1A2640] flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-sky-400 shrink-0" />
              <span>Стохастический конус броуновского дрифта (Математический алгоритм)</span>
            </div>
            <span className="text-emerald-400 font-mono font-bold">БЕЗ РАНДОМА</span>
          </div>
        )}

        {/* Mini Probability Distribution Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
            <span>Распределение вероятностей исходов</span>
            <span>Сумма: 100%</span>
          </div>

          <div className="h-3 w-full bg-[#050810] rounded-full overflow-hidden flex p-0.5 border border-[#162032]">
            {scenarios.map((s) => {
              const bg = s.id === 'BULL' ? 'bg-emerald-500' : s.id === 'BEAR' ? 'bg-rose-500' : 'bg-slate-400';
              return (
                <div
                  key={s.id}
                  style={{ width: `${s.probability}%` }}
                  className={`${bg} h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                  title={`${s.title}: ${s.probability}%`}
                />
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[10px] mt-1 text-slate-400 font-tabular">
            {scenarios.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${
                  s.id === 'BULL' ? 'bg-emerald-400' : s.id === 'BEAR' ? 'bg-rose-400' : 'bg-slate-400'
                }`} />
                <span className="font-semibold text-slate-300">{s.id === 'BULL' ? 'ВВЕРХ' : s.id === 'BEAR' ? 'ВНИЗ' : 'БОКОВИК'}:</span>
                <strong className="text-slate-100">{s.probability}%</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Detailed Scenario Cards */}
        <div className="space-y-2 mb-3">
          {scenarios.map((scenario) => {
            const isUp = scenario.id === 'BULL';
            const isDown = scenario.id === 'BEAR';

            const cardBorder = isUp 
              ? 'border-emerald-700/50 bg-emerald-950/20' 
              : isDown 
              ? 'border-rose-700/50 bg-rose-950/20' 
              : 'border-[#1E293B] bg-[#0A0E1A]';

            const textBadge = isUp 
              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-600/70' 
              : isDown 
              ? 'text-rose-300 bg-rose-950/80 border-rose-600/70' 
              : 'text-slate-300 bg-slate-800/80 border-slate-600/70';

            return (
              <div key={scenario.id} className={`p-2.5 rounded-lg border ${cardBorder} transition-all`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${textBadge}`}>
                      {isUp ? 'ВВЕРХ ↗' : isDown ? 'ВНИЗ ↘' : 'БОКОВИК ↔'} ({scenario.probability}%)
                    </span>
                    <span className="font-bold text-slate-200 text-[11px]">{getScenarioLabel(scenario.id)}</span>
                  </div>

                  <div className="flex items-center gap-1 font-tabular font-extrabold text-slate-100 text-xs">
                    <span>Цель: ${scenario.targetPrice.toLocaleString()}</span>
                    <span className={`text-[10px] ${scenario.expectedMovePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({scenario.expectedMovePercent >= 0 ? '+' : ''}{scenario.expectedMovePercent}%)
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 text-[10px] leading-tight mb-1.5">
                  {scenario.rationale}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#162032]/60 font-tabular">
                  <span>Горизонт: {scenario.horizon}</span>
                  <span>
                    Отмена сценария (Stop): <strong className="text-rose-300">${scenario.invalidationLevel.toLocaleString()}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Transparency Disclaimer */}
      <div className="p-2 rounded bg-[#060810] border border-[#162032] text-slate-400 text-[10px] leading-relaxed flex items-start gap-1.5">
        <Sparkles className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
        <span>
          Вероятности рассчитаны на базе исторической плотности распределения и текущих зон ликвидности. Модель отображает объективную вероятность, а не иллюзию 100% предсказания.
        </span>
      </div>
    </div>
  );
};
