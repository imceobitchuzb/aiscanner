import { NextResponse } from 'next/server';
import { getAllSupportedSymbols } from '@/lib/market/assetMetadata';
import { marketService } from '@/lib/market/marketService';
import { Timeframe } from '@/lib/market/types';
import { SignalDecisionEngine } from '@/lib/quant/signalDecisionEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';
  const symbols = getAllSupportedSymbols();

  try {
    const scanResults = await Promise.allSettled(
      symbols.map(async (sym) => {
        const quote = await marketService.getQuote(sym);
        const candles = await marketService.getCandles(sym, timeframe, 80);

        const isMarketOpen = quote.marketStatus === 'OPEN' || quote.marketStatus === 'PRE_MARKET' || quote.marketStatus === 'POST_MARKET';
        const isDataLive = quote.freshness === 'LIVE' || quote.freshness === 'RECENT';

        const evalResult = SignalDecisionEngine.evaluate(
          candles,
          sym,
          timeframe,
          isMarketOpen,
          isDataLive
        );

        return {
          symbol: sym,
          name: quote.name,
          category: quote.category,
          price: quote.price,
          change24h: quote.change24h,
          source: quote.source,
          marketStatus: quote.marketStatus,
          freshness: quote.freshness,
          setupState: evalResult.setupState,
          direction: evalResult.direction,
          setupGrade: evalResult.setupGrade,
          setupQuality: evalResult.setupQuality,
          modelConfidence: evalResult.modelConfidence,
          riskRewardRatio: evalResult.tradePlan?.riskRewardRatio || 0,
          regime: evalResult.marketState.regime,
          rejectionReason: evalResult.rejectionReason,
        };
      })
    );

    const items = scanResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({
      timestamp: Date.now(),
      timeframe,
      totalScanned: symbols.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Scanner execution failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
