import { marketService } from '../lib/market/marketService';
import { Timeframe } from '../lib/market/types';
import { WalkForwardEngine, WalkForwardReport } from '../lib/quant/walkForwardEngine';
import { ReplayConfig } from '../lib/quant/historicalReplayEngine';

interface MatrixItem {
  asset: string;
  timeframe: Timeframe;
  limit: number;
}

interface MatrixResult {
  asset: string;
  timeframe: Timeframe;
  totalCandles: number;
  report: WalkForwardReport;
}

async function runExpandedMatrixValidation() {
  const matrix: MatrixItem[] = [
    // Crypto
    { asset: 'BTCUSDT', timeframe: '5m', limit: 1000 },
    { asset: 'BTCUSDT', timeframe: '15m', limit: 1000 },
    { asset: 'BTCUSDT', timeframe: '1h', limit: 1000 },
    { asset: 'BTCUSDT', timeframe: '4h', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '5m', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '15m', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '1h', limit: 1000 },
    { asset: 'ETHUSDT', timeframe: '4h', limit: 1000 },
    // Metals
    { asset: 'XAUUSD', timeframe: '15m', limit: 600 },
    { asset: 'XAUUSD', timeframe: '1h', limit: 800 },
    { asset: 'XAUUSD', timeframe: '4h', limit: 600 },
    // Forex
    { asset: 'EURUSD', timeframe: '15m', limit: 600 },
    { asset: 'EURUSD', timeframe: '1h', limit: 800 },
    { asset: 'EURUSD', timeframe: '4h', limit: 600 },
    { asset: 'GBPUSD', timeframe: '15m', limit: 600 },
    { asset: 'GBPUSD', timeframe: '1h', limit: 800 },
    { asset: 'GBPUSD', timeframe: '4h', limit: 600 },
  ];

  console.log('========================================================================================================');
  console.log('NEXUS AI PHASE 5B: EXPANDED HISTORICAL VALIDATION MATRIX & OUT-OF-SAMPLE EVALUATION');
  console.log('Strict Temporal 70/30 In-Sample vs Out-of-Sample Split | Zero Contamination | Statistical Safety Check');
  console.log('========================================================================================================\n');

  const results: MatrixResult[] = [];

  for (const item of matrix) {
    try {
      process.stdout.write(`[FETCHING] ${item.asset.padEnd(7)} ${item.timeframe.padEnd(3)} (${item.limit} requested)... `);
      const candles = await marketService.getCandles(item.asset, item.timeframe, item.limit);

      if (!candles || candles.length < 50) {
        console.log(`[SKIP] Insufficient candles (${candles?.length || 0})`);
        continue;
      }
      console.log(`OK (${candles.length} bars)`);

      const feeBps = item.asset.includes('USDT') ? 5 : 2;
      const slipBps = item.asset.includes('USDT') ? 3 : 2;

      const baseConfig: ReplayConfig = {
        asset: item.asset,
        timeframe: item.timeframe,
        initialBalance: 10000,
        riskPerTradePercent: 1.0,
        feesBps: feeBps,
        slippageBps: slipBps,
        collisionRule: 'SL_FIRST',
        minRiskReward: 1.5,
        maxHoldingBars: 40,
        useAdaptiveEngine: true,
        partialExit: {
          enabled: true,
          tp1Percent: 50,
          tp2Percent: 30,
          moveSlToBreakevenAtTp1: true,
          trailRemainingAfterTp1: true,
        },
      };

      const report = WalkForwardEngine.runTemporalSplit(candles, baseConfig, 0.70);
      results.push({
        asset: item.asset,
        timeframe: item.timeframe,
        totalCandles: candles.length,
        report,
      });
    } catch (err: any) {
      console.error(`[ERROR] Failed to evaluate ${item.asset} ${item.timeframe}:`, err.message);
    }
  }

  // Print Summary Table
  console.log('\n========================================================================================================');
  console.log('PHASE 5B VALIDATION MATRIX: IN-SAMPLE (70%) vs OUT-OF-SAMPLE (30%) RESULTS');
  console.log('========================================================================================================');

  const tableData = results.map((r) => {
    const is = r.report.inSampleSummary;
    const oos = r.report.outOfSampleSummary;

    return {
      Asset: r.asset,
      TF: r.timeframe,
      Bars: r.totalCandles,
      'IS Trades': is.trades,
      'IS WR%': `${is.winRate.toFixed(1)}%`,
      'IS Exp(R)': `${is.expectancyR.toFixed(2)}R`,
      'IS PF': is.profitFactor.toFixed(2),
      'IS NetPnL': `$${is.netPnlUsd.toFixed(0)}`,
      'OOS Trades': oos.trades,
      'OOS WR%': `${oos.winRate.toFixed(1)}%`,
      'OOS Exp(R)': `${oos.expectancyR.toFixed(2)}R`,
      'OOS PF': oos.profitFactor.toFixed(2),
      'OOS NetPnL': `$${oos.netPnlUsd.toFixed(0)}`,
      Score: `${r.report.generalizationScore}%`,
      Verdict: r.report.statisticalVerdict,
    };
  });

  console.table(tableData);

  // Detailed Analysis per Asset Class
  console.log('\n========================================================================================================');
  console.log('STATISTICAL VERDICT & REJECTION PROFILE BREAKDOWN');
  console.log('========================================================================================================');

  for (const r of results) {
    const is = r.report.inSampleSummary;
    const oos = r.report.outOfSampleSummary;
    const totalTrades = is.trades + oos.trades;

    console.log(`\n▶ ${r.asset} ${r.timeframe} (Bars: ${r.totalCandles}, Total Trades: ${totalTrades})`);
    console.log(`  Verdict:        ${r.report.statisticalVerdict}`);
    console.log(`  Statistical:    ${totalTrades >= 30 ? 'MET STATISTICAL THRESHOLD (>= 30 trades)' : 'INSUFFICIENT SAMPLE SIZE (< 30 trades)'}`);
    console.log(`  In-Sample:      ${is.trades} trades | WinRate: ${is.winRate.toFixed(1)}% | Exp: ${is.expectancyR.toFixed(2)}R | PF: ${is.profitFactor.toFixed(2)} | Net: $${is.netPnlUsd.toFixed(1)} | Rejection: ${is.rejectionRatePercent}%`);
    console.log(`  Out-of-Sample:  ${oos.trades} trades | WinRate: ${oos.winRate.toFixed(1)}% | Exp: ${oos.expectancyR.toFixed(2)}R | PF: ${oos.profitFactor.toFixed(2)} | Net: $${oos.netPnlUsd.toFixed(1)} | Rejection: ${oos.rejectionRatePercent}%`);
    console.log(`  Conclusion:     ${r.report.conclusion}`);
  }
}

runExpandedMatrixValidation().catch(console.error);
