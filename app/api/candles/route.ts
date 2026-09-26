import { NextResponse } from 'next/server';
import { marketService } from '@/lib/market/marketService';
import { Timeframe } from '@/lib/market/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';
  const limit = parseInt(searchParams.get('limit') || '120', 10);

  try {
    const candles = await marketService.getCandles(symbol, timeframe, limit);
    return NextResponse.json(candles, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Candle-Count': String(candles.length),
        'X-Data-Source': candles[0]?.source || 'UNKNOWN',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve candles', details: (error as Error).message },
      { status: 500 }
    );
  }
}
