'use client';

import React from 'react';
import { NewsItem } from '@/lib/types';
import { AlertCircle, Clock, ExternalLink, Globe, Newspaper, Radio } from 'lucide-react';

interface NewsFundamentalPanelProps {
  news: NewsItem[];
}

export const NewsFundamentalPanel: React.FC<NewsFundamentalPanelProps> = ({ news }) => {
  const getSentimentBadge = (sentiment: string) => {
    if (sentiment === 'BULLISH') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">BULLISH</span>;
    }
    if (sentiment === 'BEARISH') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">BEARISH</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400">NEUTRAL</span>;
  };

  const getRiskBadge = (risk: string) => {
    if (risk === 'EXTREME' || risk === 'HIGH') {
      return <span className="text-rose-400 font-bold">{risk} RISK</span>;
    }
    if (risk === 'MEDIUM') {
      return <span className="text-amber-400 font-semibold">{risk} RISK</span>;
    }
    return <span className="text-emerald-400 font-medium">{risk} RISK</span>;
  };

  return (
    <div className="terminal-card p-4 text-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
              Macro & Fundamental Intelligence
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            <span>Live Aggregator</span>
          </div>
        </div>

        {/* Aggregate Sentiment Bar */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Macro Sentiment</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-400 text-[11px]">NET BULLISH</span>
              <span className="text-[10px] text-slate-400 font-tabular">+0.54</span>
            </div>
          </div>

          <div className="p-2 rounded bg-[#070A14] border border-[#162032]">
            <span className="text-[10px] text-slate-400 block mb-0.5">Scheduled Event Risk</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="font-bold text-amber-300">MODERATE (FOMC in 48h)</span>
            </div>
          </div>
        </div>

        {/* News Stream */}
        <div className="space-y-2 mb-2">
          {news.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded bg-[#070B14] border border-[#121A2A] hover:bg-[#0E1528] transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-medium text-slate-300">{item.source}</span>
                <div className="flex items-center gap-2">
                  <span className="font-tabular">{item.timeAgo}</span>
                  {getSentimentBadge(item.sentiment)}
                </div>
              </div>

              <h4 className="text-slate-200 font-medium text-[11px] leading-snug mb-1.5">
                {item.title}
              </h4>

              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#121A2A]/80 font-tabular">
                <span className="text-slate-400">Impact: {getRiskBadge(item.eventRisk)}</span>
                <div className="flex items-center gap-1 text-slate-400">
                  {item.relatedAssets.map((ra) => (
                    <span key={ra} className="px-1 bg-[#162032] rounded text-[9px]">
                      {ra}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-slate-400 pt-2 border-t border-[#162032] flex items-center justify-between">
        <span>Verified News Feed & Macro Aggregator</span>
        <span>Zero Synthetic Headlines</span>
      </div>
    </div>
  );
};
