import { marketService } from '../lib/market/marketService';
import { Timeframe } from '../lib/market/types';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { FilterAblationEngine } from '../lib/quant/filterAblationEngine';

interface SetupComparison {
  asset: string;
  timeframe: Timeframe;
  candlesCount: number;
  staticMetrics: {
    signals: number;
    trades: number;
    winRate: number;
    expectancyR: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    topRejection: string;
  };
  adaptiveMetrics: {
    signals: number;
    trades: number;
    winRate: number;
    expectancyR: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    netPnlUsd: number;
    topRejection: string;
  };
}

async function runPhase5AValidation() {
  const setups: { asset: string; timeframe: Timeframe; limit: number }[] = [
    { asset: 'BTCUSDT', timeframe: '15m', limit: 1000 },
    { asset: 'BTCUSDT', timeframe: '1h', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '15m', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '1h', limit: 1000 },
    { asset: 'XAUUSD', timeframe: '15m', limit: 600 },
    { asset: 'XAUUSD', timeframe: '1h', limit: 800 },
    { asset: 'EURUSD', timeframe: '15m', limit: 600 },
    { asset: 'EURUSD', timeframe: '1h', limit: 800 },
  ];

  console.log('========================================================================================');
  console.log('NEXUS AI: PHASE 5A ADAPTIVE CONTEXT-AWARE VALIDATION vs PHASE 4 STATIC BASELINE (8 SETUPS)');
  console.log('========================================================================================\n');

  const comparisons: SetupComparison[] = [];

  for (const s of setups) {
    try {
      console.log(`[FETCHING] ${s.asset} ${s.timeframe} (Requested: ${s.limit} candles)...`);
      const candles = await marketService.getCandles(s.asset, s.timeframe, s.limit);

      if (!candles || candles.length < 35) {
        console.warn(`[WARN] Insufficient candles for ${s.asset} ${s.timeframe}: ${candles?.length || 0}`);
        continue;
      }

      const baseConfig: ReplayConfig = {
        asset: s.asset,
        timeframe: s.timeframe,
        initialBalance: 10000,
        riskPerTradePercent: 1.0,
        feesBps: s.asset === 'BTCUSDT' || s.asset === 'ETHUSDT' ? 5 : 2,
        slippageBps: s.asset === 'BTCUSDT' || s.asset === 'ETHUSDT' ? 3 : 2,
        collisionRule: 'SL_FIRST',
        minRiskReward: 1.5,
        maxHoldingBars: 40,
      };

      // 1. Run Phase 4 Static Baseline
      const staticReplay = HistoricalReplayEngine.runReplay(candles, {
        ...baseConfig,
        useAdaptiveEngine: false,
      });

      // 2. Run Phase 5A Adaptive Engine
      const adaptiveReplay = HistoricalReplayEngine.runReplay(candles, {
        ...baseConfig,
        useAdaptiveEngine: true,
      });

      const getTopRejection = (hist: Record<string, number> = {}) => {
        const sorted = Object.entries(hist).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? `${sorted[0][0]} (${sorted[0][1]})` : 'NONE';
      };

      comparisons.push({
        asset: s.asset,
        timeframe: s.timeframe,
        candlesCount: candles.length,
        staticMetrics: {
          signals: staticReplay.totalSignalsGenerated,
          trades: staticReplay.totalTradesExecuted,
          winRate: staticReplay.winRate,
          expectancyR: staticReplay.expectancyR,
          profitFactor: staticReplay.profitFactor,
          maxDrawdownPercent: staticReplay.maxDrawdownPercent,
          netPnlUsd: staticReplay.netPnlUsd,
          topRejection: getTopRejection(staticReplay.rejectionHistogram),
        },
        adaptiveMetrics: {
          signals: adaptiveReplay.totalSignalsGenerated,
          trades: adaptiveReplay.totalTradesExecuted,
          winRate: adaptiveReplay.winRate,
          expectancyR: adaptiveReplay.expectancyR,
          profitFactor: adaptiveReplay.profitFactor,
          maxDrawdownPercent: adaptiveReplay.maxDrawdownPercent,
          netPnlUsd: adaptiveReplay.netPnlUsd,
          topRejection: getTopRejection(adaptiveReplay.rejectionHistogram),
        },
      });

      console.log(`[DONE] ${s.asset} ${s.timeframe}:`);
      console.log(`  Static:   Trades: ${staticReplay.totalTradesExecuted}, WR: ${staticReplay.winRate}%, Exp: ${staticReplay.expectancyR}R, PF: ${staticReplay.profitFactor}, MaxDD: -${staticReplay.maxDrawdownPercent}%, Net: $${staticReplay.netPnlUsd}`);
      console.log(`  Adaptive: Trades: ${adaptiveReplay.totalTradesExecuted}, WR: ${adaptiveReplay.winRate}%, Exp: ${adaptiveReplay.expectancyR}R, PF: ${adaptiveReplay.profitFactor}, MaxDD: -${adaptiveReplay.maxDrawdownPercent}%, Net: $${adaptiveReplay.netPnlUsd}\n`);
    } catch (err: any) {
      console.error(`[ERROR] Validation failed for ${s.asset} ${s.timeframe}:`, err.message);
    }
  }

  console.log('\n===========================================================================================================');
  console.log('PHASE 4 STATIC BASELINE vs PHASE 5A ADAPTIVE CONTEXT-AWARE ENGINE: PERFORMANCE COMPARISON');
  console.log('===========================================================================================================');
  console.log(
    'Asset'.padEnd(10) +
    'TF'.padEnd(6) +
    'Candles'.padEnd(9) +
    'Trd(S)'.padEnd(8) +
    'Trd(A)'.padEnd(8) +
    'WR%(S)'.padEnd(8) +
    'WR%(A)'.padEnd(8) +
    'ExpR(S)'.padEnd(9) +
    'ExpR(A)'.padEnd(9) +
    'PF(S)'.padEnd(7) +
    'PF(A)'.padEnd(7) +
    'MaxDD(S)'.padEnd(10) +
    'MaxDD(A)'.padEnd(10) +
    'Net$(S)'.padEnd(10) +
    'Net$(A)'
  );
  console.log('-'.repeat(125));

  for (const c of comparisons) {
    console.log(
      c.asset.padEnd(10) +
      c.timeframe.padEnd(6) +
      c.candlesCount.toString().padEnd(9) +
      c.staticMetrics.trades.toString().padEnd(8) +
      c.adaptiveMetrics.trades.toString().padEnd(8) +
      `${c.staticMetrics.winRate}%`.padEnd(8) +
      `${c.adaptiveMetrics.winRate}%`.padEnd(8) +
      `${c.staticMetrics.expectancyR >= 0 ? '+' : ''}${c.staticMetrics.expectancyR.toFixed(2)}R`.padEnd(9) +
      `${c.adaptiveMetrics.expectancyR >= 0 ? '+' : ''}${c.adaptiveMetrics.expectancyR.toFixed(2)}R`.padEnd(9) +
      c.staticMetrics.profitFactor.toFixed(2).padEnd(7) +
      c.adaptiveMetrics.profitFactor.toFixed(2).padEnd(7) +
      `-${c.staticMetrics.maxDrawdownPercent.toFixed(1)}%`.padEnd(10) +
      `-${c.adaptiveMetrics.maxDrawdownPercent.toFixed(1)}%`.padEnd(10) +
      `$${c.staticMetrics.netPnlUsd.toFixed(1)}`.padEnd(10) +
      `$${c.adaptiveMetrics.netPnlUsd.toFixed(1)}`
    );
  }
  console.log('===========================================================================================================\n');
}

runPhase5AValidation().catch(console.error);
