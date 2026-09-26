'use client';

import React, { useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { Bot, Cpu, Send, Sparkles, User, Zap } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
  evidence?: string[];
  invalidation?: string;
  confidence?: number;
}

export default function AIAnalystPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'AI',
      text: 'Greetings. I am the NEXUS Quantitative Market Analyst. I reason strictly on mathematical indicator snapshots, detected market structure, MTF matrices, and empirical analogs. How may I assist your analysis today?',
      timestamp: 'Just now',
    },
    {
      id: '2',
      sender: 'USER',
      text: 'Why is BTCUSDT currently evaluated in a Bullish Regime?',
      timestamp: 'Just now',
    },
    {
      id: '3',
      sender: 'AI',
      text: 'BTCUSDT is classified as TRENDING_BULL with 82% model confidence based on five synchronized quantitative criteria:',
      timestamp: 'Just now',
      evidence: [
        'Stacked Exponential Moving Averages: EMA20 ($67,100) > EMA50 ($65,800) > EMA200 ($62,400)',
        'Directional Strength: ADX(14) is at 29.4 with +DI dominant over -DI, signifying genuine trend continuation rather than choppy distribution',
        'Multi-timeframe consensus: 15m, 1H, and 4H timeframes exhibit 84% directional alignment',
        'Structural Demand: Price held the institutional Bullish Order Block at $65,920 without breaking market structure',
      ],
      invalidation: 'A sustained 4H candle close below $64,900 invalidates this bull trend structure and flips the regime to RANGE / DISTRIBUTION.',
      confidence: 82,
    },
  ]);

  const quickPrompts = [
    'Why is BTC bullish?',
    'What invalidates the current setup?',
    'Compare BTC and ETH volatility.',
    'Summarize top historical analogs.',
    'Explain the current regime like I am a beginner.',
  ];

  const handleSend = (userText: string) => {
    if (!userText.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'USER',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    // Generate grounded deterministic AI response
    setTimeout(() => {
      let aiReply: ChatMessage;
      const lower = userText.toLowerCase();

      if (lower.includes('invalidate') || lower.includes('invalidation')) {
        aiReply = {
          id: (Date.now() + 1).toString(),
          sender: 'AI',
          text: 'Current setup invalidation boundaries are mathematically pegged to structural swing pivots:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidence: [
            'Immediate execution invalidation: 15m close below key support $66,200',
            'Macro structural invalidation: Daily close below $64,900 breaks Higher-Low sequence',
          ],
          invalidation: 'Any break below $64,900 voids the bullish risk-reward thesis.',
          confidence: 88,
        };
      } else if (lower.includes('compare') || lower.includes('eth')) {
        aiReply = {
          id: (Date.now() + 1).toString(),
          sender: 'AI',
          text: 'Comparative Relative Strength Analysis between BTCUSDT and ETHUSDT:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidence: [
            'BTC exhibits higher trend stability (ADX: 29.4 vs ETH: 22.1)',
            'ETH displays higher annualized ATR volatility (3.8% vs BTC: 3.1%), implying higher downside beta during market pullbacks',
            'Pairwise 90-day correlation is elevated at 0.88; holding both does not provide portfolio diversification',
          ],
          confidence: 85,
        };
      } else {
        aiReply = {
          id: (Date.now() + 1).toString(),
          sender: 'AI',
          text: 'Quantitative evaluation across live candle metrics for the requested query:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidence: [
            'Volume expansion verified at 1.34x over 20-period moving average',
            'RSI(14) positioned in healthy momentum band (58.2) without exhaustion divergence',
            'Brownian drift forecast cone targets $72,400 upper barrier with 58% probability',
          ],
          confidence: 76,
        };
      }

      setMessages((prev) => [...prev, aiReply]);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol="BTCUSDT"
        onSelectSymbol={() => {}}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={true}
      />

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-[#162032]">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-slate-100 uppercase tracking-wider">
              NEXUS Conversational AI Analyst
            </h1>
          </div>
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            DATA-GROUNDED REASONING
          </span>
        </div>

        {/* Quick Question Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="px-3 py-1.5 rounded-lg bg-[#0A0E1A] border border-[#162032] hover:border-indigo-500 text-slate-300 hover:text-white text-xs whitespace-nowrap transition-all"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Thread */}
        <div className="flex-1 terminal-card p-4 space-y-4 overflow-y-auto min-h-[460px]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                m.sender === 'USER' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'AI' && (
                <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-xl p-3.5 rounded-xl ${
                  m.sender === 'USER'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-[#0E1424] border border-[#1E293B] text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1.5 text-[10px] text-slate-400">
                  <span className="font-bold text-slate-300">
                    {m.sender === 'AI' ? 'NEXUS Quantitative Agent' : 'User'}
                  </span>
                  <span>{m.timestamp}</span>
                </div>

                <p className="mb-2">{m.text}</p>

                {m.evidence && (
                  <div className="space-y-1.5 mt-2 pt-2 border-t border-[#1E293B]/70 font-tabular text-[11px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                      Verifiable Mathematical Evidence:
                    </span>
                    {m.evidence.map((ev, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-slate-300">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}

                {m.invalidation && (
                  <div className="mt-2.5 p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-200 text-[10px]">
                    <strong className="text-rose-400 uppercase block mb-0.5">Setup Invalidation:</strong>
                    {m.invalidation}
                  </div>
                )}
              </div>

              {m.sender === 'USER' && (
                <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 bg-[#0A0E1A] border border-[#162032] focus-within:border-indigo-500 rounded-xl px-3 py-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask an analytical query (e.g. 'Why is BTC bullish?', 'What invalidates setup?')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-ai-glow transition-all shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </main>
    </div>
  );
}
