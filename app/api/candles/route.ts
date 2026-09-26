import { NextResponse } from 'next/server';
import { marketProvider } from '@/lib/providers/binanceProvider';
import { Timeframe } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';
  const limit = parseInt(searchParams.get('limit') || '120', 10);

  try {
    const candles = await marketProvider.getCandles(symbol, timeframe, limit);
    return NextResponse.json(candles);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to retrieve candles' }, { status: 500 });
  }
}
