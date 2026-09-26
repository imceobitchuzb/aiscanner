import { NextResponse } from 'next/server';
import { marketService } from '@/lib/market/marketService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    if (symbol) {
      const quote = await marketService.getQuote(symbol);
      return NextResponse.json(quote, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Data-Source': quote.source,
          'X-Market-Status': quote.marketStatus,
          'X-Data-Freshness': quote.freshness,
        },
      });
    }

    const watchlist = await marketService.getWatchlist();
    return NextResponse.json(watchlist, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve market data',
        details: (error as Error).message,
        source: 'DATA_SERVICE_ERROR',
        marketStatus: 'HALTED',
        freshness: 'OFFLINE',
      },
      { status: 500 }
    );
  }
}
