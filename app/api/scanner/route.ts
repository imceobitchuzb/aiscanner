import { NextResponse } from 'next/server';
import { getAllSupportedSymbols } from '@/lib/market/assetMetadata';
import { marketService } from '@/lib/market/marketService';
import { Timeframe } from '@/lib/market/types';
import { AdaptiveSignalEngine, AdaptiveSignalResult } from '@/lib/quant/adaptiveSignalEngine';
import { SignalRankingEngine } from '@/lib/quant/signalRankingEngine';
import { AlertEngine } from '@/lib/quant/alertEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';
  const symbols = getAllSupportedSymbols();

  try {
    const rawSignals: AdaptiveSignalResult[] = [];
    const scanResults = await Promise.allSettled(
      symbols.map(async (sym) => {
        const quote = await marketService.getQuote(sym);
        const candles = await marketService.getCandles(sym, timeframe, 80);

        const isMarketOpen = quote.marketStatus === 'OPEN' || quote.marketStatus === 'PRE_MARKET' || quote.marketStatus === 'POST_MARKET';
        const isDataLive = quote.freshness === 'LIVE' || quote.freshness === 'RECENT';

        const evalResult = AdaptiveSignalEngine.evaluate(
          candles,
          sym,
          timeframe,
          isMarketOpen,
          isDataLive
        );

        rawSignals.push(evalResult);

        // Generate alert if confirmed or watch
        if (evalResult.setupState === 'CONFIRMED' || evalResult.setupState === 'ACTIVE') {
          AlertEngine.createAlert(
            'SETUP_CONFIRMED',
            sym,
            timeframe,
            evalResult.direction === 'SHORT' ? 'SHORT' : 'LONG',
            quote.price,
            evalResult.setupQuality
          );
        } else if (evalResult.setupState === 'WATCH') {
          AlertEngine.createAlert(
            'WATCH_CREATED',
            sym,
            timeframe,
            evalResult.direction === 'SHORT' ? 'SHORT' : 'LONG',
            quote.price,
            evalResult.setupQuality
          );
        }

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
          conflictLevel: evalResult.conflictReport?.overallLevel || 'NONE',
          trailingStrategy: evalResult.dynamicPlan?.trailingStrategy || 'STRUCTURE_TRAILING',
          units: evalResult.positionSizing?.units || 0,
          riskPercent: evalResult.positionSizing?.actualRiskPercent || 1.0,
        };
      })
    );

    const items = scanResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    // Deterministic Cross-Asset Ranking
    const rankedOpportunities = SignalRankingEngine.rankSignals(rawSignals);

    // Merge rank & compositeScore back into items
    const rankedMap = new Map(rankedOpportunities.map((r) => [r.symbol, r]));
    const enrichedItems = items.map((it) => {
      const ranked = rankedMap.get(it.symbol);
      return {
        ...it,
        rank: ranked ? ranked.rank : 999,
        compositeScore: ranked ? ranked.compositeScore : 0,
        rankingRationale: ranked ? ranked.rankingRationale : undefined,
      };
    });

    // Sort items by rank first, then symbol
    enrichedItems.sort((a, b) => a.rank - b.rank);

    return NextResponse.json({
      timestamp: Date.now(),
      timeframe,
      totalScanned: symbols.length,
      totalSetups: rankedOpportunities.length,
      items: enrichedItems,
      rankedOpportunities,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Scanner execution failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
