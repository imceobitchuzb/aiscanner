import { NextResponse } from 'next/server';
import { marketService } from '@/lib/market/marketService';
import { Timeframe } from '@/lib/market/types';
import { SignalDecisionEngine } from '@/lib/quant/signalDecisionEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';

  try {
    const quote = await marketService.getQuote(symbol);
    const candles = await marketService.getCandles(symbol, timeframe, 120);

    const isMarketOpen = quote.marketStatus === 'OPEN' || quote.marketStatus === 'PRE_MARKET' || quote.marketStatus === 'POST_MARKET';
    const isDataLive = quote.freshness === 'LIVE' || quote.freshness === 'RECENT';

    const result = SignalDecisionEngine.evaluate(
      candles,
      symbol,
      timeframe,
      isMarketOpen,
      isDataLive
    );

    const response = {
      asset: symbol.toUpperCase(),
      timeframe,
      timestamp: result.timestamp,
      dataFreshness: quote.freshness,
      dataSource: quote.source,
      marketStatus: quote.marketStatus,
      currentPrice: quote.price,
      marketState: result.marketState,
      structure: result.structure,
      mtf: result.mtf,
      setup: {
        state: result.setupState,
        direction: result.direction,
        quality: result.setupQuality,
        confidence: result.modelConfidence,
        grade: result.setupGrade,
      },
      tradePlan: result.tradePlan,
      evidence: result.evidence,
      risks: result.riskWarnings,
      invalidation: result.invalidationCriteria,
      rejectionReason: result.rejectionReason,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Data-Source': quote.source,
        'X-Setup-State': result.setupState,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute quantitative signal', details: (error as Error).message },
      { status: 500 }
    );
  }
}
