import { Timeframe } from '../lib/types';
import { HistoricalDataFeed, DatasetCoverageReport } from '../lib/quant/historicalDataFeed';
import { WalkForwardEngine, WalkForwardReport, WalkForwardAnalysisResult } from '../lib/quant/walkForwardEngine';
import { ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { SignalAuditTrail } from '../lib/quant/signalAuditTrail';

interface ValidationMatrixItem {
  asset: string;
  timeframe: Timeframe;
  targetBars: number;
}

interface ValidationReportResult {
  asset: string;
  timeframe: Timeframe;
  coverage: DatasetCoverageReport;
  temporalSplit: WalkForwardReport;
  walkForward?: WalkForwardAnalysisResult;
}

async function runPhase6ComprehensiveValidation() {
  console.log('========================================================================================================');
  console.log('NEXUS AI PHASE 6: ROBUSTNESS, HTF CONFIRMATION, PIP FOREX & HISTORICAL EXPANSION VALIDATION');
  console.log('Strict Temporal Splits | Rolling Walk-Forward (Train/Val/Test) | Deep Signal Audit Diagnostics');
  console.log('========================================================================================================\n');

  // Reset audit trail before validation run
  SignalAuditTrail.clear();

  const targetMatrix: ValidationMatrixItem[] = [
    { asset: 'BTCUSDT', timeframe: '15m', targetBars: 1500 },
    { asset: 'BTCUSDT', timeframe: '1h', targetBars: 1500 },
    { asset: 'ETHUSDT', timeframe: '15m', targetBars: 1500 },
    { asset: 'ETHUSDT', timeframe: '1h', targetBars: 1500 },
    { asset: 'XAUUSD', timeframe: '15m', targetBars: 1000 },
    { asset: 'XAUUSD', timeframe: '1h', targetBars: 1200 },
    { asset: 'EURUSD', timeframe: '15m', targetBars: 1000 },
    { asset: 'EURUSD', timeframe: '1h', targetBars: 1200 },
    { asset: 'GBPUSD', timeframe: '15m', targetBars: 1000 },
    { asset: 'GBPUSD', timeframe: '1h', targetBars: 1200 },
  ];

  const results: ValidationReportResult[] = [];

  for (const item of targetMatrix) {
    try {
      process.stdout.write(`[INGESTING] ${item.asset.padEnd(8)} ${item.timeframe.padEnd(3)} (target: ${item.targetBars} bars)... `);
      const { candles, coverage } = await HistoricalDataFeed.loadDataset(item.asset, item.timeframe, item.targetBars);
      console.log(`Loaded ${candles.length} bars (${coverage.timespanDays} days, status: ${coverage.status})`);

      if (!candles || candles.length < 50) {
        console.warn(`[WARN] Skipping ${item.asset} ${item.timeframe} due to insufficient bars.`);
        continue;
      }

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

      // 1. Strict Temporal 70/30 Split
      const temporalSplit = WalkForwardEngine.runTemporalSplit(candles, baseConfig, 0.70);

      // 2. Rolling Multi-Window Walk-Forward (3 windows)
      let walkForward: WalkForwardAnalysisResult | undefined;
      if (candles.length >= 300) {
        walkForward = WalkForwardEngine.runWalkForward(candles, baseConfig, 3);
      }

      results.push({
        asset: item.asset,
        timeframe: item.timeframe,
        coverage,
        temporalSplit,
        walkForward,
      });
    } catch (err: any) {
      console.error(`[ERROR] Failed to validate ${item.asset} ${item.timeframe}:`, err.message);
    }
  }

  // 1. Dataset Coverage Summary Table
  console.log('\n========================================================================================================');
  console.log('1. DATASET COVERAGE REPORT (HistoricalDataFeed)');
  console.log('========================================================================================================');
  console.table(
    results.map((r) => ({
      Asset: r.asset,
      TF: r.timeframe,
      Requested: r.coverage.requestedBars,
      Available: r.coverage.availableBars,
      'Timespan (Days)': r.coverage.timespanDays,
      Status: r.coverage.status,
      'Sufficient (>=1000)': r.coverage.isSufficientForValidation ? 'YES' : 'NO',
    }))
  );

  // 2. Temporal 70/30 Out-of-Sample Performance Table
  console.log('\n========================================================================================================');
  console.log('2. TEMPORAL SPLIT (70% IN-SAMPLE / 30% STRICT OUT-OF-SAMPLE)');
  console.log('========================================================================================================');
  console.table(
    results.map((r) => {
      const is = r.temporalSplit.inSampleSummary;
      const oos = r.temporalSplit.outOfSampleSummary;
      return {
        Asset: r.asset,
        TF: r.timeframe,
        Bars: r.temporalSplit.totalCandles,
        'IS Trades': is.trades,
        'IS WR%': `${is.winRate.toFixed(1)}%`,
        'IS Exp(R)': `${is.expectancyR.toFixed(2)}R`,
        'IS PF': is.profitFactor.toFixed(2),
        'IS Rej%': `${is.rejectionRatePercent}%`,
        'OOS Trades': oos.trades,
        'OOS WR%': `${oos.winRate.toFixed(1)}%`,
        'OOS Exp(R)': `${oos.expectancyR.toFixed(2)}R`,
        'OOS PF': oos.profitFactor.toFixed(2),
        'OOS MaxDD%': `${oos.maxDrawdownPercent.toFixed(1)}%`,
        'OOS Rej%': `${oos.rejectionRatePercent}%`,
        Score: `${r.temporalSplit.generalizationScore}%`,
        Verdict: r.temporalSplit.statisticalVerdict,
      };
    })
  );

  // 3. Multi-Window Rolling Walk-Forward Validation Table
  console.log('\n========================================================================================================');
  console.log('3. ROLLING MULTI-WINDOW WALK-FORWARD ANALYSIS (Train 60% / Val 20% / Test 20%)');
  console.log('========================================================================================================');
  const wfRows = results
    .filter((r) => r.walkForward && r.walkForward.status === 'SUCCESS')
    .map((r) => {
      const wf = r.walkForward!;
      const aggOos = wf.aggregateOutOfSample;
      return {
        Asset: r.asset,
        TF: r.timeframe,
        Windows: wf.totalWindows,
        'OOS Total Trades': aggOos.totalTrades,
        'OOS Mean WR%': `${aggOos.winRate.toFixed(1)}%`,
        'OOS Mean PF': aggOos.profitFactor.toFixed(2),
        'OOS Mean Exp': `${aggOos.expectancyR.toFixed(2)}R`,
        'OOS MaxDD%': `${aggOos.maxDrawdownPercent.toFixed(1)}%`,
        'Mean WFE': wf.meanWFE.toFixed(2),
        Grade: wf.robustnessGrade,
        'Stat Verdict': wf.statisticalVerdict,
      };
    });
  console.table(wfRows);

  // 4. Signal Audit Trail Diagnostics: Rejection Reasons
  console.log('\n========================================================================================================');
  console.log('4. SIGNAL AUDIT TRAIL: REJECTION REASONS ATTRIBUTION');
  console.log('========================================================================================================');
  const rejectionDiags = SignalAuditTrail.getRejectionDiagnostics();
  console.log(`Total Unique Rejection Categories: ${rejectionDiags.length}`);
  for (const item of rejectionDiags) {
    console.log(`  - [${item.code.padEnd(28)}] ${item.count.toString().padStart(5)} occurrences (${item.percentage.toFixed(1)}%) | Drivers: ${item.primaryDrivers.join('; ')}`);
  }

  // 5. Signal Audit Trail Diagnostics: Win/Loss Attribution
  console.log('\n========================================================================================================');
  console.log('5. SIGNAL AUDIT TRAIL: WIN/LOSS FACTOR ATTRIBUTION');
  console.log('========================================================================================================');
  const winLossDiag = SignalAuditTrail.getWinLossDiagnostics();
  console.log(`Closed Trades Analyzed: ${winLossDiag.totalLoggedTrades} | Wins: ${winLossDiag.wins} | Losses: ${winLossDiag.losses}`);
  console.log('\nWin Attribution Drivers:');
  for (const driver of winLossDiag.winDrivers) {
    console.log(`  ✔ ${driver}`);
  }
  console.log('\nLoss Attribution Drivers:');
  for (const driver of winLossDiag.lossDrivers) {
    console.log(`  ✖ ${driver}`);
  }
}

runPhase6ComprehensiveValidation().catch(console.error);
