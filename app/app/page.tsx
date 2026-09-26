'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/terminal/Header';
import { Watchlist } from '@/components/terminal/Watchlist';
import { AdvancedChart } from '@/components/terminal/AdvancedChart';
import { RegimeCard } from '@/components/terminal/RegimeCard';
import { MultiTimeframeMatrix } from '@/components/terminal/MultiTimeframeMatrix';
import { ProbabilisticForecast } from '@/components/terminal/ProbabilisticForecast';
import { SignalCard } from '@/components/terminal/SignalCard';
import { SignalQualityMeter } from '@/components/terminal/SignalQualityMeter';
import { HistoricalAnalogs } from '@/components/terminal/HistoricalAnalogs';
import { DigitalTwinSimulator } from '@/components/terminal/DigitalTwinSimulator';
import { RiskEnginePanel } from '@/components/terminal/RiskEnginePanel';
import { NewsFundamentalPanel } from '@/components/terminal/NewsFundamentalPanel';
import { ModelTransparency } from '@/components/terminal/ModelTransparency';

import { Asset, Candle, NewsItem, Timeframe } from '@/lib/types';
import { DEFAULT_ASSETS } from '@/lib/providers/demoProvider';
import { clientMarketProvider } from '@/lib/providers/clientMarketProvider';
import { newsProvider, MACRO_NEWS_EVENTS } from '@/lib/providers/newsProvider';
import { useBinanceLiveStream } from '@/lib/useBinanceLiveStream';

import { getIndicatorSnapshot } from '@/lib/quant/indicators';
import { detectMarketStructure } from '@/lib/quant/marketStructure';
import { detectMarketRegime } from '@/lib/quant/regimeDetector';
import { analyzeMultiTimeframe } from '@/lib/quant/multiTimeframe';
import { generateProbabilisticForecast } from '@/lib/quant/probabilisticForecast';
import { evaluateSignalQuality } from '@/lib/quant/signalScoring';
import { findHistoricalAnalogs } from '@/lib/quant/analogMatcher';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export default function TerminalPage() {
  const [currentSymbol, setCurrentSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [watchlist, setWatchlist] = useState<Asset[]>(DEFAULT_ASSETS);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveFeed, setIsLiveFeed] = useState<boolean>(true);
  const [news, setNews] = useState<NewsItem[]>(MACRO_NEWS_EVENTS);

  // Live WebSocket Tick Handler
  const handleCandleTick = useCallback((newTickCandle: Candle) => {
    setCandles((prevCandles) => {
      if (prevCandles.length === 0) return [newTickCandle];
      const lastCandle = prevCandles[prevCandles.length - 1];

      if (newTickCandle.time === lastCandle.time) {
        // Update in-flight active candle
        const updated = [...prevCandles];
        updated[updated.length - 1] = {
          ...lastCandle,
          high: Math.max(lastCandle.high, newTickCandle.close),
          low: Math.min(lastCandle.low, newTickCandle.close),
          close: newTickCandle.close,
          volume: lastCandle.volume + (newTickCandle.volume || 1),
        };
        return updated;
      } else if (newTickCandle.time > lastCandle.time) {
        // New candle formed
        return [...prevCandles.slice(1), newTickCandle];
      }
      return prevCandles;
    });

    // Update watchlist price in real time
    setWatchlist((prevWatchlist) =>
      prevWatchlist.map((asset) =>
        asset.symbol === currentSymbol
          ? {
              ...asset,
              price: newTickCandle.close,
              high24h: Math.max(asset.high24h, newTickCandle.close),
              low24h: Math.min(asset.low24h, newTickCandle.close),
            }
          : asset
      )
    );
  }, [currentSymbol]);

  // Hook up 24/7 Binance WebSocket
  const { isConnected: isWsConnected, lastTickTime } = useBinanceLiveStream({
    symbol: currentSymbol,
    timeframe,
    onCandleTick: handleCandleTick,
  });

  // Fetch Watchlist via Server Proxy
  useEffect(() => {
    let isMounted = true;
    const loadWatchlist = async () => {
      const data = await clientMarketProvider.getWatchlist();
      if (isMounted) setWatchlist(data);
    };
    loadWatchlist();
    const interval = setInterval(loadWatchlist, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch Initial Candles for Selected Symbol & Timeframe
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadCandles = async () => {
      try {
        const c = await clientMarketProvider.getCandles(currentSymbol, timeframe, 120);
        if (isMounted) {
          setCandles(c);
          const isCrypto = currentSymbol.endsWith('USDT') || currentSymbol.endsWith('BTC');
          setIsLiveFeed(isCrypto);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load candles', err);
        if (isMounted) setLoading(false);
      }
    };

    loadCandles();
    const interval = setInterval(loadCandles, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentSymbol, timeframe]);

  // Update News
  useEffect(() => {
    newsProvider.getLatestNews(currentSymbol).then(setNews);
  }, [currentSymbol]);

  // Run Quantitative Engines
  const currentAsset = watchlist.find((a) => a.symbol === currentSymbol) || watchlist[0];
  const snapshot = getIndicatorSnapshot(candles);
  const structure = detectMarketStructure(candles);
  const regime = detectMarketRegime(candles);
  const mtf = analyzeMultiTimeframe(candles);
  const forecast = generateProbabilisticForecast(candles, regime, 24);
  const { signal, quality } = evaluateSignalQuality(candles, regime, structure, mtf);
  const analogs = findHistoricalAnalogs(candles, currentSymbol);

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentSymbol={currentSymbol}
        onSelectSymbol={setCurrentSymbol}
        watchlist={watchlist}
        isLiveFeed={isLiveFeed}
        isWsConnected={isWsConnected}
      />

      {/* Main Terminal Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Watchlist */}
        <Watchlist
          assets={watchlist}
          currentSymbol={currentSymbol}
          onSelect={setCurrentSymbol}
        />

        {/* Center & Right Work Area */}
        <main className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Main Chart Section */}
          <div className="terminal-card overflow-hidden h-[460px] xl:h-[500px]">
            {loading && candles.length === 0 ? (
              <div className="h-full flex items-center justify-center gap-2 text-indigo-400">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span className="font-semibold text-xs">Подключение к прямому потоку котировок...</span>
              </div>
            ) : (
              <AdvancedChart
                candles={candles}
                symbol={currentSymbol}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                structure={structure}
                snapshot={snapshot}
              />
            )}
          </div>

          {/* Primary Intelligence Row: Regime | Multi-Timeframe | Probabilistic Forecast */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <RegimeCard state={regime} />
            <MultiTimeframeMatrix analysis={mtf} />
            <ProbabilisticForecast forecast={forecast} />
          </div>

          {/* Signal & Quality Row: AI Signal | Quality Meter | Historical Analogs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <SignalCard signal={signal} />
            <SignalQualityMeter quality={quality} />
            <HistoricalAnalogs analogs={analogs} />
          </div>

          {/* Simulation & Risk Row: Digital Twin | Risk Engine | News & Macro */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <DigitalTwinSimulator
              currentPrice={currentAsset.price}
              symbol={currentSymbol}
            />
            <RiskEnginePanel
              currentPrice={currentAsset.price}
              keySupport={structure.keySupport}
              atr={snapshot.atr14}
            />
            <NewsFundamentalPanel news={news} />
          </div>

          {/* Model Transparency Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-2">
              <ModelTransparency confidence={signal.confidence} isLive={isLiveFeed} />
            </div>

            {/* Quick Instrument Stat Card */}
            <div className="terminal-card p-4 text-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#162032] mb-3">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-100">
                    Параметры инструмента
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold text-[10px]">
                    {currentAsset.category}
                  </span>
                </div>

                <div className="space-y-2 font-tabular">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">24ч Макс / Мин:</span>
                    <span>${currentAsset.high24h.toLocaleString()} / ${currentAsset.low24h.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Суточный объём:</span>
                    <span>{currentAsset.volume24h}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Индекс волатильности ATR:</span>
                    <span className="text-indigo-400 font-bold">{currentAsset.volatility}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Сопротивление (Селл-зона):</span>
                    <span className="text-rose-400 font-bold">${structure.keyResistance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Поддержка (Бай-зона):</span>
                    <span className="text-emerald-400 font-bold">${structure.keySupport.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#0A0E1A] border border-[#162032] text-slate-400 text-[10px] mt-3">
                {isWsConnected ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    WebSocket подключён • Последний тик: {lastTickTime || 'активно'}
                  </span>
                ) : (
                  <span>Прямой стриминг биржевых ордеров активен</span>
                )}
              </div>
            </div>
          </div>

          {/* Legal / Risk Disclaimer Footer */}
          <footer className="p-3 rounded-lg bg-[#070A12] border border-[#162032] text-[10px] text-slate-400 leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-300">ПРЕДУПРЕЖДЕНИЕ О РИСКАХ:</strong> Платформа NEXUS AI предоставляет аналитическую и вероятностную информацию. Все сценарии, режимы рынка и сигналы являются результатом математического моделирования и не гарантируют будущую доходность. Пользователь несёт полную ответственность за свои торговые и инвестиционные решения.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
