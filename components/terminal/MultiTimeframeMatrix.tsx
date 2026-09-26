'use client';

import React from 'react';
import { MultiTimeframeAnalysis } from '@/lib/types';
import { AlertTriangle, Layers } from 'lucide-react';

interface MultiTimeframeMatrixProps {
  analysis: MultiTimeframeAnalysis;
}

export const MultiTimeframeMatrix: React.FC<MultiTimeframeMatrixProps> = ({ analysis }) => {
  const getBiasBadge = (bias: string) => {
    if (bias === 'BULLISH') return <span className="text-emerald-400 font-black">ВВЕРХ ↗</span>;
    if (bias === 'BEARISH') return <span className="text-rose-400 font-black">ВНИЗ ↘</span>;
    return <span className="text-slate-400">ФЛЭТ</span>;
  };

  const getMomentumLabel = (m: string) => {
    if (m === 'STRONG') return <span className="text-indigo-400 font-bold">СИЛЬНЫЙ</span>;
    if (m === 'MODERATE') return <span className="text-slate-300">УМЕРЕННЫЙ</span>;
    return <span className="text-slate-400">СЛАБЫЙ</span>;
  };

  const getStructureLabel = (s: string) => {
    switch (s) {
      case 'BULL_BREAK': return 'ПРОБОЙ ВВЕРХ';
      case 'BEAR_BREAK': return 'ПРОБОЙ ВНИЗ';
      case 'SWING_LOW': return 'ПОДДЕРЖКА';
      case 'SWING_HIGH': return 'СОПРОТИВЛЕНИЕ';
      default: return 'БОКОВИК';
    }
  };

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Мульти-таймфрейм матрица
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase">Синхронизация</span>
            <div className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 font-tabular font-bold">
              {analysis.alignmentScore}%
            </div>
          </div>
        </div>

        {/* MTF Matrix Table */}
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-left font-tabular border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#162032] text-slate-400 text-[10px] uppercase">
                <th className="py-1.5 px-2">ТФ</th>
                <th className="py-1.5 px-2">Тренд</th>
                <th className="py-1.5 px-2">Импульс</th>
                <th className="py-1.5 px-2">Структура</th>
                <th className="py-1.5 px-2">Волатильность</th>
                <th className="py-1.5 px-2 text-right">Направление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121A2A]">
              {analysis.rows.map((row) => (
                <tr key={row.timeframe} className="hover:bg-[#0E1528] transition-colors">
                  <td className="py-1.5 px-2 font-black text-slate-200">{row.timeframe}</td>
                  <td className="py-1.5 px-2 font-bold">
                    <span className={
                      row.trend === 'BULLISH' ? 'text-emerald-400' : row.trend === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                    }>
                      {row.trend === 'BULLISH' ? 'ВВЕРХ' : row.trend === 'BEARISH' ? 'ВНИЗ' : 'БОКОВИК'}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    {getMomentumLabel(row.momentum)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-300 text-[10px]">
                    {getStructureLabel(row.structure)}
                  </td>
                  <td className="py-1.5 px-2 text-slate-400 text-[10px]">
                    {row.volatility === 'EXPANSION' ? 'РАСШИРЕНИЕ' : row.volatility === 'COMPRESSION' ? 'СЖАТИЕ' : 'НОРМА'}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {getBiasBadge(row.bias)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Timeframe Conflict Box if any */}
        {analysis.conflicts.length > 0 && (
          <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[11px] mb-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-1">
              <span className="font-bold block text-[10px] uppercase text-amber-400">Предупреждение о конфликте шкал</span>
              {analysis.conflicts.map((c, i) => (
                <p key={i} className="text-amber-200/90 leading-tight">{c}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Synthesis Explanation */}
      <div className="p-2.5 rounded bg-[#070B14] border border-[#162032] text-slate-300 text-[11px] leading-relaxed">
        <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">
          Сводный синтез аналитики
        </span>
        <p className="text-slate-300/90">{analysis.synthesis}</p>
      </div>
    </div>
  );
};
