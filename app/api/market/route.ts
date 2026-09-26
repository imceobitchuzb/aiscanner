import { NextResponse } from 'next/server';
import { marketProvider } from '@/lib/providers/binanceProvider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    if (symbol) {
      const asset = await marketProvider.getAsset(symbol);
      return NextResponse.json(asset);
    }
    const watchlist = await marketProvider.getWatchlist();
    return NextResponse.json(watchlist);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to retrieve market data' }, { status: 500 });
  }
}
