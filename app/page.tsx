'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Activity, 
  ArrowRight, 
  BarChart3, 
  CheckCircle2, 
  ChevronRight, 
  Cpu, 
  Crosshair, 
  Database, 
  Layers, 
  PieChart, 
  Radio, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Sliders, 
  Sparkles, 
  Terminal, 
  TrendingUp, 
  Zap 
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const sampleAssets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'EURUSD', 'XAUUSD', 'NVDA', 'AAPL'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app?symbol=${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
    } else {
      router.push('/app');
    }
  };

  const features = [
    {
      icon: Cpu,
      title: 'Probabilistic Forecasting',
      desc: 'No dogmatic price lines. Dynamic Brownian drift cones with 68% and 95% multi-scenario confidence intervals.',
    },
    {
      icon: Activity,
      title: '10-State Regime Engine',
      desc: 'Instant detection of trending bull, breakdown, distribution, and volatility compression with Markov shift probabilities.',
    },
    {
      icon: Sliders,
      title: 'Market Digital Twin',
      desc: 'Simulate cross-asset liquidity shocks and "What-If" percentage stress tests with real-time margin risk recalculation.',
    },
    {
      icon: Layers,
      title: 'Multi-Timeframe Synthesis',
      desc: 'Synchronized matrix across 1m, 5m, 15m, 1H, 4H, and 1D charts to identify momentum dissonance and false breakouts.',
    },
    {
      icon: Database,
      title: 'Historical Analog Matcher',
      desc: 'Pattern-recognition engine matching current market setups against historical episodes to calculate true empirical win rates.',
    },
    {
      icon: ShieldCheck,
      title: 'Model Transparency & Calibration',
      desc: 'Zero fake precision or opaque predictions. Full feature-attribution weights, data freshness, and uncertainty bounds.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="border-b border-[#162032] bg-[#070A12]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-ai-glow">
            <Zap className="h-4 w-4 fill-white" />
          </div>
          <div>
            <span className="text-base font-black tracking-wider text-slate-100 uppercase">NEXUS</span>
            <span className="text-[10px] font-bold text-indigo-400 ml-1.5 px-1.5 py-0.5 bg-indigo-950/70 border border-indigo-700/50 rounded">AI</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
          <Link href="#features" className="hover:text-slate-200 transition-colors">Features</Link>
          <Link href="/app/radar" className="hover:text-slate-200 transition-colors">Opportunity Radar</Link>
          <Link href="/app/scanner" className="hover:text-slate-200 transition-colors">Market Scanner</Link>
          <Link href="/app/backtest" className="hover:text-slate-200 transition-colors">Backtest Lab</Link>
          <Link href="/app/ai" className="hover:text-slate-200 transition-colors">AI Analyst</Link>
        </div>

        <Link
          href="/app"
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-ai-glow transition-all"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Launch Terminal</span>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-16 md:pt-28 md:pb-24 max-w-6xl mx-auto text-center flex flex-col items-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/40 text-indigo-300 text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next-Generation Market Intelligence Architecture</span>
        </div>

        {/* Big Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 uppercase leading-tight max-w-4xl">
          AI That Understands <br />
          <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
            The Market
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Multi-model market intelligence, probabilistic forecasting and scenario simulation in one institutional terminal.
        </p>

        {/* Main Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-xl mb-6 relative">
          <div className="flex items-center bg-[#0B0F19] border-2 border-[#1E293B] focus-within:border-indigo-500 rounded-xl p-2 shadow-2xl transition-all">
            <Search className="h-5 w-5 text-slate-400 ml-2 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search an asset (e.g. BTCUSDT, ETHUSDT, XAUUSD, NVDA)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-ai-glow"
            >
              <span>Analyze</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* Sample Asset Quick Pills */}
        <div className="flex items-center flex-wrap justify-center gap-2 text-xs text-slate-400 font-tabular">
          <span className="text-slate-400 font-medium">Quick analyze:</span>
          {sampleAssets.map((asset) => (
            <Link
              key={asset}
              href={`/app`}
              className="px-2.5 py-1 rounded-md bg-[#0C1220] border border-[#1E293B] text-slate-300 hover:border-indigo-500 hover:text-white transition-all"
            >
              {asset}
            </Link>
          ))}
        </div>
      </section>

      {/* Terminal Live Interactive Preview Card */}
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full">
        <div className="rounded-xl border border-[#1E293B] bg-[#0A0E1A] shadow-2xl overflow-hidden">
          {/* Mock Window Top Bar */}
          <div className="px-4 py-2.5 bg-[#070A12] border-b border-[#162032] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-slate-400 text-[11px]">NEXUS-TERMINAL // BTCUSDT LIVE FEED</span>
            </div>

            <div className="flex items-center gap-3 font-tabular text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                98.4% Engine Health
              </span>
              <span className="text-slate-400">Latency: 14ms</span>
            </div>
          </div>

          {/* Quick Terminal Preview Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-tabular">
            {/* Box 1: Regime */}
            <div className="p-4 rounded-lg bg-[#070B14] border border-[#162032]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Detected Market Regime</span>
              <div className="text-lg font-black text-emerald-400 mb-1">TRENDING BULL</div>
              <p className="text-slate-400 text-[11px] mb-2">Confidence 82% • High Stability • Transition Risk Low</p>
              <div className="w-full bg-[#121A2A] h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[82%]" />
              </div>
            </div>

            {/* Box 2: Probabilistic Scenarios */}
            <div className="p-4 rounded-lg bg-[#070B14] border border-[#162032]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Cone Scenarios (24H)</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-emerald-400 font-bold">Bull Target:</span>
                  <span className="text-slate-200">$72,400 (58% prob)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Base Drift:</span>
                  <span className="text-slate-300">$67,800 (24% prob)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-400 font-bold">Bear Floor:</span>
                  <span className="text-slate-400">$63,200 (18% prob)</span>
                </div>
              </div>
            </div>

            {/* Box 3: Historical Setup Match */}
            <div className="p-4 rounded-lg bg-[#070B14] border border-[#162032]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Historical Setup Analogs</span>
              <div className="text-lg font-black text-indigo-300 mb-1">428 Similar Setups</div>
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>TP Hit: <strong className="text-emerald-400">61%</strong></span>
                <span>SL Hit: <strong className="text-rose-400">29%</strong></span>
                <span>Avg Move: <strong className="text-emerald-400">+2.8%</strong></span>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-[#080C16] border-t border-[#162032] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 text-center sm:text-left">
              Explore live orderbook imbalance, MTF matrices, Monte Carlo risk, and no-code strategy lab.
            </span>
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <span>Open Full Intelligence Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto border-t border-[#162032]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block mb-2">
            The Analytical Architecture
          </span>
          <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tight">
            Built For Traders Who Demand Quantitative Rigor
          </h2>
          <p className="text-slate-400 text-sm mt-3">
            Every probabilistic calculation, volatility cone, and setup factor is derived from rigorous mathematical algorithms — zero hallucinated forecasts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="terminal-card p-6 flex flex-col justify-between hover:border-indigo-500/50 transition-all group"
              >
                <div>
                  <div className="h-10 w-10 rounded-lg bg-indigo-950/70 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-base mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Navigation Hubs */}
      <section className="px-6 py-16 max-w-6xl mx-auto border-t border-[#162032] w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Link href="/app/scanner" className="p-4 rounded-lg bg-[#070B14] border border-[#162032] hover:border-indigo-500 transition-all group">
            <Crosshair className="h-5 w-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-100">Market Scanner</div>
            <div className="text-[10px] text-slate-400 mt-1">Multi-asset filters by confidence &amp; R:R</div>
          </Link>

          <Link href="/app/radar" className="p-4 rounded-lg bg-[#070B14] border border-[#162032] hover:border-indigo-500 transition-all group">
            <Radio className="h-5 w-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-100">Opportunity Radar</div>
            <div className="text-[10px] text-slate-400 mt-1">2D Momentum vs Volatility scatter map</div>
          </Link>

          <Link href="/app/backtest" className="p-4 rounded-lg bg-[#070B14] border border-[#162032] hover:border-indigo-500 transition-all group">
            <BarChart3 className="h-5 w-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-100">Backtest Lab</div>
            <div className="text-[10px] text-slate-400 mt-1">Sharpe, Sortino &amp; Monte Carlo runs</div>
          </Link>

          <Link href="/app/simulation" className="p-4 rounded-lg bg-[#070B14] border border-[#162032] hover:border-indigo-500 transition-all group">
            <Sliders className="h-5 w-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-100">Digital Twin</div>
            <div className="text-[10px] text-slate-400 mt-1">Simulate percentage stress tests</div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#162032] bg-[#05070D] px-6 py-8 text-xs text-slate-400 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-200">NEXUS AI</span>
            <span>— Institutional Market Intelligence &amp; Quantitative Modeling</span>
          </div>

          <div className="text-[11px] text-slate-400 text-center md:text-right">
            Deterministic Baselines • Zero Blackbox Pretense • Built for High Precision
          </div>
        </div>
      </footer>
    </div>
  );
}
