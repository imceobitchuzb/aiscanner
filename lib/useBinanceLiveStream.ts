'use client';

import { useEffect, useRef, useState } from 'react';
import { Asset, Candle, Timeframe } from './types';

interface LiveStreamProps {
  symbol: string;
  timeframe: Timeframe;
  onPriceUpdate?: (symbol: string, newPrice: number, change24h: number) => void;
  onCandleTick?: (candle: Candle) => void;
}

export function useBinanceLiveStream({
  symbol,
  timeframe,
  onPriceUpdate,
  onCandleTick,
}: LiveStreamProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string>('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN' | 'EQUAL'>('EQUAL');

  const wsRef = useRef<WebSocket | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  const tfMap: Record<Timeframe, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '4h': '4h',
    '1D': '1d',
    '1W': '1w',
  };

  useEffect(() => {
    const isCrypto = symbol.toUpperCase().endsWith('USDT') || symbol.toUpperCase().endsWith('BTC');
    if (!isCrypto) {
      setIsConnected(false);
      return;
    }

    const cleanSymbol = symbol.toLowerCase();
    const cleanTf = tfMap[timeframe] || '1h';
    const wsUrl = `wss://stream.binance.com:9443/ws/${cleanSymbol}@kline_${cleanTf}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e === 'kline' && msg.k) {
            const k = msg.k;
            const currentClose = parseFloat(k.c);

            // Determine directional tick
            if (prevPriceRef.current !== null) {
              if (currentClose > prevPriceRef.current) setPriceDirection('UP');
              else if (currentClose < prevPriceRef.current) setPriceDirection('DOWN');
            }
            prevPriceRef.current = currentClose;
            setLivePrice(currentClose);
            setLastTickTime(new Date().toLocaleTimeString());

            const updatedCandle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: currentClose,
              volume: parseFloat(k.v),
            };

            if (onCandleTick) onCandleTick(updatedCandle);
            if (onPriceUpdate) onPriceUpdate(symbol, currentClose, 0);
          }
        } catch (err) {
          console.error('Error parsing live kline:', err);
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
      };

      socket.onclose = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbol, timeframe]);

  return { isConnected, livePrice, priceDirection, lastTickTime };
}
