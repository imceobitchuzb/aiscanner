'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Candle } from '../types';
import { getAssetMetadata } from './assetMetadata';
import { FreshnessState, MarketStatus, QuoteWithProvenance, Timeframe } from './types';

interface MarketStreamProps {
  symbol: string;
  timeframe: Timeframe;
  onCandleTick?: (candle: Candle) => void;
  onQuoteUpdate?: (quote: QuoteWithProvenance) => void;
}

export function useMarketStream({
  symbol,
  timeframe,
  onCandleTick,
  onQuoteUpdate,
}: MarketStreamProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [quote, setQuote] = useState<QuoteWithProvenance | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [bid, setBid] = useState<number | null>(null);
  const [ask, setAsk] = useState<number | null>(null);
  const [spread, setSpread] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN' | 'EQUAL'>('EQUAL');
  const [lastTickTime, setLastTickTime] = useState<string>('');
  const [freshness, setFreshness] = useState<FreshnessState>('LIVE');
  const [source, setSource] = useState<string>('CONNECTING');
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('OPEN');
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const meta = getAssetMetadata(symbol);

  // Helper to handle a price change
  const handlePriceTick = useCallback((
    newPrice: number,
    tickSource: string,
    newBid?: number,
    newAsk?: number,
    newSpread?: number,
    status: MarketStatus = 'OPEN',
    latency = 0
  ) => {
    if (prevPriceRef.current !== null) {
      if (newPrice > prevPriceRef.current) setPriceDirection('UP');
      else if (newPrice < prevPriceRef.current) setPriceDirection('DOWN');
      else setPriceDirection('EQUAL');
    }
    prevPriceRef.current = newPrice;
    setLivePrice(newPrice);
    if (newBid !== undefined) setBid(newBid);
    if (newAsk !== undefined) setAsk(newAsk);
    if (newSpread !== undefined) setSpread(newSpread);
    setSource(tickSource);
    setMarketStatus(status);
    setLatencyMs(latency);
    setLastTickTime(new Date().toLocaleTimeString());
    setFreshness('LIVE');
    setIsConnected(true);
  }, []);

  useEffect(() => {
    // Cleanup any existing connections
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    let isMounted = true;

    // Route 1: Crypto via Binance WebSocket
    if (meta.category === 'CRYPTO') {
      const cleanSymbol = symbol.toLowerCase();
      const tfMap: Record<Timeframe, string> = {
        '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
        '1h': '1h', '4h': '4h', '1D': '1d', '1W': '1w',
      };
      const cleanTf = tfMap[timeframe] || '1h';
      const wsUrl = `wss://stream.binance.com:9443/ws/${cleanSymbol}@kline_${cleanTf}`;

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) {
            setIsConnected(true);
            setSource('BINANCE_WEBSOCKET');
            setMarketStatus('OPEN');
            setFreshness('LIVE');
          }
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.e === 'kline' && msg.k) {
              const k = msg.k;
              const currentClose = parseFloat(k.c);
              const currentHigh = parseFloat(k.h);
              const currentLow = parseFloat(k.l);
              const currentOpen = parseFloat(k.o);
              const currentVol = parseFloat(k.v);

              handlePriceTick(currentClose, 'BINANCE_WEBSOCKET', currentClose * 0.9999, currentClose * 1.0001, currentClose * 0.0002, 'OPEN', 35);

              const updatedCandle: Candle = {
                time: Math.floor(k.t / 1000),
                open: currentOpen,
                high: currentHigh,
                low: currentLow,
                close: currentClose,
                volume: currentVol,
              };

              if (onCandleTick) onCandleTick(updatedCandle);
            }
          } catch (err) {
            console.error('Error parsing live kline:', err);
          }
        };

        socket.onerror = () => {
          if (isMounted) {
            setIsConnected(false);
            setFreshness('OFFLINE');
          }
        };

        socket.onclose = () => {
          if (isMounted) {
            setIsConnected(false);
            setFreshness('OFFLINE');
          }
        };
      } catch {
        if (isMounted) setIsConnected(false);
      }
    } else {
      // Route 2: Metals (XAUUSD), Forex (EURUSD), Equities (NVDA) via high-frequency adaptive REST stream
      const fetchLiveQuote = async () => {
        try {
          const t0 = Date.now();
          const res = await fetch(`/api/market?symbol=${symbol.toUpperCase()}`, { cache: 'no-store' });
          if (!res.ok) throw new Error('Market quote request failed');
          const data: QuoteWithProvenance = await res.json();

          if (isMounted && data && data.price > 0) {
            setQuote(data);
            handlePriceTick(
              data.price,
              data.source,
              data.bid,
              data.ask,
              data.spread,
              data.marketStatus,
              Date.now() - t0
            );
            setFreshness(data.freshness);
            if (onQuoteUpdate) onQuoteUpdate(data);

            // Synthesize tick candle for chart update if live
            if (onCandleTick) {
              const nowSec = Math.floor(Date.now() / 1000);
              const candleTfSec = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600;
              const periodBucket = Math.floor(nowSec / candleTfSec) * candleTfSec;

              onCandleTick({
                time: periodBucket,
                open: data.price,
                high: data.high24h || data.price,
                low: data.low24h || data.price,
                close: data.price,
                volume: 10,
              });
            }
          }
        } catch {
          if (isMounted) {
            setFreshness('STALE');
          }
        }
      };

      // Initial immediate fetch
      fetchLiveQuote();

      // High frequency interval (every 3.5 seconds for metals & forex)
      const intervalMs = meta.category === 'EQUITIES' ? 5000 : 3500;
      pollTimerRef.current = setInterval(fetchLiveQuote, intervalMs);
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [symbol, timeframe, meta.category, handlePriceTick, onCandleTick, onQuoteUpdate]);

  return {
    isConnected,
    quote,
    livePrice,
    bid,
    ask,
    spread,
    priceDirection,
    lastTickTime,
    freshness,
    source,
    marketStatus,
    latencyMs,
  };
}
