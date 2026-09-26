import { NextResponse } from 'next/server';
import { marketService } from '@/lib/market/marketService';
import { Timeframe } from '@/lib/market/types';
import { HistoricalReplayEngine, ReplayConfig } from '@/lib/quant/historicalReplayEngine';
import { WalkForwardEngine } from '@/lib/quant/walkForwardEngine';
import { MonteCarloEngine } from '@/lib/quant/monteCarloEngine';
import { ParameterSensitivityEngine } from '@/lib/quant/parameterSensitivity';
import { ConfidenceCalibrationEngine } from '@/lib/quant/confidenceCalibration';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const asset = (body.asset || 'BTCUSDT').toUpperCase();
    const timeframe = (body.timeframe as Timeframe) || '1h';
    const limit = Math.min(1000, Math.max(50, Number(body.limit) || 300));

    const config: ReplayConfig = {
      asset,
      timeframe,
      initialBalance: Number(body.initialBalance) || 10000,
      riskPerTradePercent: Number(body.riskPerTradePercent) || 1.0,
      feesBps: Number(body.feesBps) ?? 5,
      slippageBps: Number(body.slippageBps) ?? 3,
      collisionRule: body.collisionRule === 'TP_FIRST' ? 'TP_FIRST' : 'SL_FIRST',
      minRiskReward: Number(body.minRiskReward) || 1.5,
      maxHoldingBars: Number(body.maxHoldingBars) || 40,
    };

    // 1. Fetch real historical candles
    const candles = await marketService.getCandles(asset, timeframe, limit);

    if (!candles || candles.length < 35) {
      return NextResponse.json({
        status: 'INSUFFICIENT_DATA',
        message: `Недостаточно реальных исторических свечей для ${asset} (получено ${candles?.length ?? 0}).`,
        totalCandles: candles?.length ?? 0,
      }, { status: 400 });
    }

    // 2. Run Historical Replay Engine (Sequential bar-by-bar, no lookahead)
    const replaySummary = HistoricalReplayEngine.runReplay(candles, config);

    // 3. Run Walk-Forward Rolling Analysis
    const walkForward = WalkForwardEngine.runWalkForward(candles, config, 3);

    // 4. Run Monte Carlo Bootstrap with 10,000 simulations using REAL trade returns
    const monteCarlo = MonteCarloEngine.simulate(
      replaySummary.trades,
      config.initialBalance,
      10000
    );

    // 5. Run Parameter Sensitivity Analysis
    const sensitivity = ParameterSensitivityEngine.analyze(candles, config);

    // 6. Run Confidence Calibration
    const calibration = ConfidenceCalibrationEngine.evaluate(replaySummary.trades);

    return NextResponse.json({
      status: 'SUCCESS',
      asset,
      timeframe,
      candlesCount: candles.length,
      replay: replaySummary,
      walkForward,
      monteCarlo,
      sensitivity,
      calibration,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'ERROR',
      message: err.message || 'Ошибка выполнения исторического тестирования.',
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get('asset') || 'BTCUSDT').toUpperCase();
  const timeframe = (searchParams.get('timeframe') as Timeframe) || '1h';
  const limit = Math.min(500, Math.max(50, Number(searchParams.get('limit')) || 250));

  const config: ReplayConfig = {
    asset,
    timeframe,
    initialBalance: 10000,
    riskPerTradePercent: 1.0,
    feesBps: 5,
    slippageBps: 3,
    collisionRule: 'SL_FIRST',
    minRiskReward: 1.5,
  };

  try {
    const candles = await marketService.getCandles(asset, timeframe, limit);
    if (!candles || candles.length < 35) {
      return NextResponse.json({ status: 'INSUFFICIENT_DATA', candlesCount: candles?.length ?? 0 });
    }
    const replaySummary = HistoricalReplayEngine.runReplay(candles, config);
    return NextResponse.json({ status: 'SUCCESS', asset, timeframe, replay: replaySummary });
  } catch (err: any) {
    return NextResponse.json({ status: 'ERROR', message: err.message }, { status: 500 });
  }
}
