'use client';

import React, { useState } from 'react';
import { simulateDigitalTwin } from '@/lib/quant/digitalTwin';
import { Activity, Sliders } from 'lucide-react';

interface DigitalTwinSimulatorProps {
  currentPrice: number;
  symbol: string;
}

export const DigitalTwinSimulator: React.FC<DigitalTwinSimulatorProps> = ({
  currentPrice,
  symbol,
}) => {
  const [deltaPercent, setDeltaPercent] = useState<number>(2.5);
  const [positionType, setPositionType] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState<number>(5);
  const [positionSizeUsd, setPositionSizeUsd] = useState<number>(10000);

  const simulation = simulateDigitalTwin(
    currentPrice,
    deltaPercent,
    positionType,
    leverage,
    positionSizeUsd,
    symbol
  );

  const quickDeltas = [-5, -3, -1, 1, 3, 5];

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Цифровой двойник рынка: симулятор «Что если?»
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-indigo-300 text-[10px] font-bold">
            <Activity className="h-3 w-3" />
            <span>Стресс-модель маржи</span>
          </div>
        </div>

        {/* Position Setup Controls */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Position Type */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Позиция</span>
            <div className="flex bg-[#050810] p-0.5 rounded border border-[#162032]">
              <button
                onClick={() => setPositionType('LONG')}
                className={`flex-1 py-1 rounded text-[10px] font-black ${
                  positionType === 'LONG' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                ВВЕРХ ↗
              </button>
              <button
                onClick={() => setPositionType('SHORT')}
                className={`flex-1 py-1 rounded text-[10px] font-black ${
                  positionType === 'SHORT' ? 'bg-rose-600 text-white' : 'text-slate-400'
                }`}
              >
                ВНИЗ ↘
              </button>
            </div>
          </div>

          {/* Leverage */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Кредитное плечо: {leverage}x</span>
            <select
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-1.5 text-slate-200 text-[10px] outline-none font-bold"
            >
              {[1, 2, 3, 5, 10, 20, 25].map((lev) => (
                <option key={lev} value={lev}>{lev}x Плечо</option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Объём депозита</span>
            <select
              value={positionSizeUsd}
              onChange={(e) => setPositionSizeUsd(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-1.5 text-slate-200 text-[10px] outline-none font-bold"
            >
              <option value={1000}>$1,000</option>
              <option value={5000}>$5,000</option>
              <option value={10000}>$10,000</option>
              <option value={50000}>$50,000</option>
            </select>
          </div>
        </div>

        {/* Interactive "What-If" Slider */}
        <div className="p-3 rounded-lg bg-[#070A14] border border-[#162032] mb-3">
          <div className="flex items-center justify-between text-[11px] mb-2 font-tabular">
            <span className="text-slate-200 font-bold">Смоделировать изменение цены:</span>
            <span className={`text-sm font-black ${deltaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {deltaPercent >= 0 ? 'ВВЕРХ +' : 'ВНИЗ '}{deltaPercent.toFixed(1)}%
              <span className="text-slate-300 text-xs ml-1.5 font-bold">
                (${simulation.simulatedPrice.toLocaleString()})
              </span>
            </span>
          </div>

          <input
            type="range"
            min="-10"
            max="10"
            step="0.5"
            value={deltaPercent}
            onChange={(e) => setDeltaPercent(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#162032] rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-2"
          />

          {/* Quick Delta Buttons */}
          <div className="flex justify-between gap-1">
            {quickDeltas.map((d) => (
              <button
                key={d}
                onClick={() => setDeltaPercent(d)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-tabular transition-all ${
                  deltaPercent === d
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-[#0E1528] text-slate-400 hover:text-slate-200'
                }`}
              >
                {d > 0 ? `+${d}%` : `${d}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Simulated PnL & Margin Health */}
        <div className="grid grid-cols-2 gap-2 mb-3 font-tabular">
          <div className={`p-2.5 rounded border ${
            simulation.pnlUsd >= 0
              ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300'
              : 'bg-rose-950/30 border-rose-700/50 text-rose-300'
          }`}>
            <span className="text-[10px] text-slate-400 block mb-0.5 uppercase">Смоделированный P&L</span>
            <div className="text-sm font-black">
              {simulation.pnlUsd >= 0 ? '+' : ''}${simulation.pnlUsd.toLocaleString()}
              <span className="text-[11px] ml-1">({simulation.pnlPercent}%)</span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-[#070A14] border border-[#162032]">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Запас маржи</span>
              <strong className={simulation.marginHealth < 30 ? 'text-rose-400' : 'text-emerald-400'}>
                {simulation.marginHealth}%
              </strong>
            </div>
            <div className="w-full bg-[#121826] h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full ${
                  simulation.marginHealth < 30
                    ? 'bg-rose-500'
                    : simulation.marginHealth < 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${simulation.marginHealth}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 font-bold">
              Ликвидация при: ${simulation.liquidationPrice.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Cross-Market Stress Ripple (Correlated Assets) */}
        <div className="mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Реакция связанных активов рынка
          </span>
          <div className="grid grid-cols-3 gap-1.5 font-tabular text-[10px]">
            {simulation.correlatedAssetsImpact.map((ca) => (
              <div key={ca.symbol} className="p-1.5 rounded bg-[#070B14] border border-[#121A2A]">
                <div className="flex justify-between items-center text-slate-300 font-bold">
                  <span>{ca.symbol}</span>
                  <span className={ca.expectedMovePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {ca.expectedMovePercent >= 0 ? '+' : ''}{ca.expectedMovePercent}%
                  </span>
                </div>
                <div className="text-[9px] text-slate-400">коэфф: {ca.correlation}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-2 border-t border-[#162032] flex items-center justify-between font-tabular">
        <span>Математическое ожидание (EV): <strong className="text-slate-200">${simulation.ev}</strong></span>
        <span>Вероятность прибыли: <strong className="text-emerald-400 font-bold">{simulation.probabilityOfProfit}%</strong></span>
      </div>
    </div>
  );
};
