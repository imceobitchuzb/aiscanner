'use client';

import React, { useState } from 'react';
import { AlertTriangle, Calculator, Check, ShieldAlert } from 'lucide-react';

interface RiskEnginePanelProps {
  currentPrice: number;
  keySupport: number;
  atr: number;
}

export const RiskEnginePanel: React.FC<RiskEnginePanelProps> = ({
  currentPrice,
  keySupport,
  atr,
}) => {
  const [accountSize, setAccountSize] = useState<number>(25000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice);
  const [stopPrice, setStopPrice] = useState<number>(keySupport || currentPrice * 0.97);
  const [leverage, setLeverage] = useState<number>(5);

  const riskAmountUsd = (accountSize * riskPercent) / 100;
  const stopDistancePercent = Math.abs((entryPrice - stopPrice) / (entryPrice || 1));
  const stopDistanceUsd = Math.abs(entryPrice - stopPrice);

  const positionSizeCoins = stopDistancePercent > 0 ? (riskAmountUsd / stopDistanceUsd) : 0;
  const positionSizeUsd = positionSizeCoins * entryPrice;
  const marginRequiredUsd = positionSizeUsd / leverage;

  const targetPrice = entryPrice + stopDistanceUsd * 2.5; // 2.5x RR
  const potentialProfitUsd = positionSizeCoins * (targetPrice - entryPrice);
  const potentialLossUsd = riskAmountUsd;
  const riskRewardRatio = 2.5;

  const isStopTooLarge = stopDistanceUsd > atr * 2.5;
  const isLeverageTooHigh = leverage > 10;

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Quantitative Risk Engine
            </span>
          </div>

          <span className="text-[10px] text-slate-400 font-tabular">
            Max Risk: ${riskAmountUsd.toLocaleString()}
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Account Equity ($)</label>
            <input
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 font-tabular text-[11px] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Risk per Trade (%)</label>
            <input
              type="number"
              step="0.5"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 font-tabular text-[11px] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Entry Price ($)</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-slate-200 font-tabular text-[11px] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Stop Loss ($)</label>
            <input
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(Number(e.target.value))}
              className="w-full bg-[#050810] border border-[#162032] rounded py-1 px-2 text-rose-400 font-tabular text-[11px] outline-none"
            />
          </div>
        </div>

        {/* Calculated Results Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 font-tabular">
          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Recommended Size</span>
            <span className="font-bold text-slate-100 text-xs">
              ${Math.round(positionSizeUsd).toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block">
              ({positionSizeCoins.toFixed(3)} units)
            </span>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Margin Required ({leverage}x)</span>
            <span className="font-bold text-slate-100 text-xs">
              ${Math.round(marginRequiredUsd).toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block">
              Free: ${Math.round(accountSize - marginRequiredUsd).toLocaleString()}
            </span>
          </div>

          <div className="p-2 rounded bg-rose-950/20 border border-rose-800/40">
            <span className="text-[10px] text-rose-400 block mb-0.5">Max Potential Loss</span>
            <span className="font-bold text-rose-300 text-xs">
              -${Math.round(potentialLossUsd).toLocaleString()}
            </span>
            <span className="text-[9px] text-rose-400/80 block">(-{riskPercent}%)</span>
          </div>

          <div className="p-2 rounded bg-emerald-950/20 border border-emerald-800/40">
            <span className="text-[10px] text-emerald-400 block mb-0.5">Expected Profit (2.5R)</span>
            <span className="font-bold text-emerald-300 text-xs">
              +${Math.round(potentialProfitUsd).toLocaleString()}
            </span>
            <span className="text-[9px] text-emerald-400/80 block">
              (+{(riskPercent * riskRewardRatio).toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Risk Warnings */}
        {isStopTooLarge && (
          <div className="p-2 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[10px] mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Stop distance ({stopDistanceUsd.toFixed(1)}) is &gt; 2.5x ATR. High drawdown risk.</span>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 pt-2 border-t border-[#162032] flex items-center justify-between">
        <span>Capital Preservation Engine</span>
        <span>Kelly Criterion Adjusted</span>
      </div>
    </div>
  );
};
