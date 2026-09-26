import { NextResponse } from 'next/server';
import { marketService } from '@/lib/market/marketService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const health = await marketService.getAllProviderHealth();
    return NextResponse.json({
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
      providers: health,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to inspect data providers', details: (error as Error).message },
      { status: 500 }
    );
  }
}
