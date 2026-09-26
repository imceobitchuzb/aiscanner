'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/terminal/Header';
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
import { marketProvider } from '@/lib/providers/binanceProvider';
import { newsProvider, MACRO_NEWS_EVENTS } from '@/lib/providers/newsProvider';

import { getIndicatorSnapshot } from '@/lib/quant/indicators';
import { detectMarketStructure } from '@/lib/quant/marketStructure';
import { detectMarketRegime } from '@/lib/quant/regimeDetector';
import { analyzeMultiTimeframe } from '@/lib/quant/multiTimeframe';
import { generateProbabilisticForecast } from '@/lib/quant/probabilisticForecast';
import { evaluateSignalQuality } from '@/lib/quant/signalScoring';
import { findHistoricalAnalogs } from '@/lib/quant/analogMatcher';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export default function AssetIntelligencePage() {
  const params = useParams();
  const rawSymbol = (params?.symbol as string) || 'BTCUSDT';
  const symbol = rawSymbol.toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [assetMeta, setAssetMeta] = useState<Asset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [news, setNews] = useState<NewsItem[]>(MACRO_NEWS_EVENTS);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [c, meta] = await Promise.all([
          marketProvider.getCandles(symbol, timeframe, 120),
          marketProvider.getAsset(symbol),
        ]);

        if (isMounted) {
          setCandles(c);
          setAssetMeta(meta);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    newsProvider.getLatestNews(symbol).then(setNews);
  }, [symbol, timeframe]);

  const currentAsset = assetMeta || DEFAULT_ASSETS[0];
  const snapshot = getIndicatorSnapshot(candles);
  const structure = detectMarketStructure(candles);
  const regime = detectMarketRegime(candles);
  const mtf = analyzeMultiTimeframe(candles);
  const forecast = generateProbabilisticForecast(candles, regime, 24);
  const { signal, quality } = evaluateSignalQuality(candles, regime, structure, mtf);
  const analogs = findHistoricalAnalogs(candles, symbol);

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans">
      <Header
        currentSymbol={symbol}
        onSelectSymbol={() => {}}
        watchlist={DEFAULT_ASSETS}
        isLiveFeed={currentAsset.isLiveSupported}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Asset Header Banner */}
        <div className="terminal-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-slate-100">{symbol}</h1>
              <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold text-xs">
                {currentAsset.category}
              </span>
              {currentAsset.isLiveSupported && (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-semibold">
                  LIVE BINANCE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{currentAsset.name}</p>
          </div>

          <div className="flex items-center gap-6 font-tabular">
            <div>
              <span className="text-[10px] text-slate-400 block">Current Price</span>
              <span className="text-xl font-black text-slate-100">
                ${currentAsset.price.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block">24H Change</span>
              <span className={`text-base font-bold ${currentAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentAsset.change24h >= 0 ? '+' : ''}{currentAsset.change24h}%
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block">24H Volume</span>
              <span className="text-base font-bold text-slate-200">{currentAsset.volume24h}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block">Volatility</span>
              <span className="text-base font-bold text-indigo-400">{currentAsset.volatility}%</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="terminal-card overflow-hidden h-[460px]">
          {loading && candles.length === 0 ? (
            <div className="h-full flex items-center justify-center gap-2 text-indigo-400">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-xs font-semibold">Streaming Data &amp; Indicators...</span>
            </div>
          ) : (
            <AdvancedChart
              candles={candles}
              symbol={symbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              structure={structure}
              snapshot={snapshot}
            />
          )}
        </div>

        {/* Section 1: Regime, Forecast, Signal */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RegimeCard state={regime} />
          <ProbabilisticForecast forecast={forecast} />
          <SignalCard signal={signal} />
        </div>

        {/* Section 2: Quality, Historical Analogs, Multi-Timeframe */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <SignalQualityMeter quality={quality} />
          <HistoricalAnalogs analogs={analogs} />
          <MultiTimeframeMatrix analysis={mtf} />
        </div>

        {/* Section 3: Risk Engine, Digital Twin, News */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RiskEnginePanel
            currentPrice={currentAsset.price}
            keySupport={structure.keySupport}
            atr={snapshot.atr14}
          />
          <DigitalTwinSimulator
            currentPrice={currentAsset.price}
            symbol={symbol}
          />
          <NewsFundamentalPanel news={news} />
        </div>

        {/* Section 4: Model Explainability */}
        <ModelTransparency confidence={signal.confidence} isLive={currentAsset.isLiveSupported} />
      </main>
    </div>
  );
}
