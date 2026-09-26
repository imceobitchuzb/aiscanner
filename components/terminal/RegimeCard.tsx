'use client';

import React from 'react';
import { MarketRegimeState } from '@/lib/types';
import { Clock, Compass, Sparkles } from 'lucide-react';

interface RegimeCardProps {
  state: MarketRegimeState;
}

export const RegimeCard: React.FC<RegimeCardProps> = ({ state }) => {
  const getRegimeDetails = (regime: string) => {
    switch (regime) {
      case 'TRENDING_BULL':
        return {
          title: 'ТРЕНД ВВЕРХ (РОСТ РЫНКА)',
          desc: 'Устойчивая восходящая динамика с преобладанием покупателей.',
          text: 'text-emerald-400',
          bg: 'bg-emerald-950/50',
          border: 'border-emerald-600/60',
          bar: 'bg-emerald-500',
        };
      case 'TRENDING_BEAR':
        return {
          title: 'ТРЕНД ВНИЗ (ПАДЕНИЕ РЫНКА)',
          desc: 'Нисходящее давление, преобладание продавцов и снижение локальных минимумов.',
          text: 'text-rose-400',
          bg: 'bg-rose-950/50',
          border: 'border-rose-600/60',
          bar: 'bg-rose-500',
        };
      case 'BREAKOUT':
        return {
          title: 'ИМПУЛЬСНЫЙ ПРОБОЙ ВВЕРХ',
          desc: 'Резкое расширение диапазона и выход цены выше ключевого сопротивления.',
          text: 'text-emerald-400',
          bg: 'bg-emerald-950/50',
          border: 'border-emerald-600/60',
          bar: 'bg-emerald-500',
        };
      case 'BREAKDOWN':
        return {
          title: 'ИМПУЛЬСНЫЙ ПРОБОЙ ВНИЗ',
          desc: 'Пробой уровня поддержки вниз с резким увеличением волатильности.',
          text: 'text-rose-400',
          bg: 'bg-rose-950/50',
          border: 'border-rose-600/60',
          bar: 'bg-rose-500',
        };
      case 'RANGE':
        return {
          title: 'БОКОВОЙ РЫНОК (ФЛЭТ)',
          desc: 'Движение цены в горизонтальном коридоре между границами спроса и предложения.',
          text: 'text-amber-400',
          bg: 'bg-amber-950/40',
          border: 'border-amber-800/60',
          bar: 'bg-amber-500',
        };
      case 'HIGH_VOLATILITY':
        return {
          title: 'ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ',
          desc: 'Широкие разнонаправленные колебания цен с повышенным риском просадки.',
          text: 'text-rose-400',
          bg: 'bg-rose-950/40',
          border: 'border-rose-800/60',
          bar: 'bg-rose-500',
        };
      case 'LOW_VOLATILITY':
        return {
          title: 'СЖАТИЕ ВОЛАТИЛЬНОСТИ (ЗАТИШЬЕ)',
          desc: 'Узкий диапазон консолидации; готовится сильный импульсный выход.',
          text: 'text-sky-400',
          bg: 'bg-sky-950/40',
          border: 'border-sky-800/60',
          bar: 'bg-sky-500',
        };
      default:
        return {
          title: 'НАКОПЛЕНИЕ / ПЕРЕХОДНАЯ ФАЗА',
          desc: 'Формирование крупной позиции перед зарождением нового движения.',
          text: 'text-indigo-400',
          bg: 'bg-indigo-950/40',
          border: 'border-indigo-800/60',
          bar: 'bg-indigo-500',
        };
    }
  };

  const getTargetLabel = (regime: string) => {
    switch (regime) {
      case 'TRENDING_BULL': return 'ТРЕНД ВВЕРХ';
      case 'TRENDING_BEAR': return 'ТРЕНД ВНИЗ';
      case 'BREAKOUT': return 'ПРОБОЙ ВВЕРХ';
      case 'BREAKDOWN': return 'ПРОБОЙ ВНИЗ';
      case 'RANGE': return 'БОКОВИК (ФЛЭТ)';
      case 'HIGH_VOLATILITY': return 'ВОЛАТИЛЬНОСТЬ';
      default: return 'НАКОПЛЕНИЕ';
    }
  };

  const details = getRegimeDetails(state.regime);

  return (
    <div className="terminal-card p-4 flex flex-col justify-between h-full text-xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Детектор режима рынка
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Clock className="h-3 w-3" />
            <span>Длительность: {state.durationHours} ч</span>
          </div>
        </div>

        {/* Current Regime Spotlight */}
        <div className={`p-3 rounded-lg border ${details.bg} ${details.border} mb-3`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-300">Текущее состояние</span>
            <span className="text-[11px] font-extrabold text-slate-100">Уверенность: {state.confidence}%</span>
          </div>

          <div className={`text-base font-black tracking-wide ${details.text} uppercase mb-1 flex items-center gap-2`}>
            <span>{details.title}</span>
          </div>

          <p className="text-[11px] text-slate-300 mb-2 leading-tight">
            {details.desc}
          </p>

          {/* Confidence Meter */}
          <div className="w-full bg-[#050810] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full ${details.bar} transition-all duration-500`}
              style={{ width: `${state.confidence}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Стабильность тренда</span>
            <span className={`font-bold ${
              state.stability === 'HIGH' ? 'text-emerald-400' : state.stability === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {state.stability === 'HIGH' ? 'ВЫСОКАЯ' : state.stability === 'MEDIUM' ? 'СРЕДНЯЯ' : 'НИЗКАЯ'}
            </span>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Риск смены направления</span>
            <span className={`font-bold ${
              state.transitionRisk === 'LOW' ? 'text-emerald-400' : state.transitionRisk === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {state.transitionRisk === 'LOW' ? 'НИЗКИЙ' : state.transitionRisk === 'MEDIUM' ? 'УМЕРЕННЫЙ' : 'ВЫСОКИЙ'}
            </span>
          </div>
        </div>

        {/* Transition Probability Matrix */}
        <div className="mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Марковская матрица вероятности смены фазы
          </span>
          <div className="space-y-1.5">
            {state.transitionProbabilities.map((tp) => (
              <div key={tp.targetRegime} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">{getTargetLabel(tp.targetRegime)}</span>
                <div className="flex items-center gap-2 w-36">
                  <div className="flex-1 bg-[#121826] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${tp.probability}%` }}
                    />
                  </div>
                  <span className="font-tabular font-bold text-slate-200 w-8 text-right">
                    {tp.probability}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Analytical Rationale */}
      <div className="p-2.5 rounded bg-[#0E1424] border border-indigo-950/60 text-slate-300 text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1 text-[10px] uppercase">
          <Sparkles className="h-3 w-3" />
          <span>Математическое обоснование режима</span>
        </div>
        <p className="text-slate-300/90">{state.explanation}</p>
      </div>
    </div>
  );
};
