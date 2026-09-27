import { marketService } from '../lib/market/marketService';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { AdaptiveSignalEngine } from '../lib/quant/adaptiveSignalEngine';
import { Timeframe } from '../lib/market/types';

interface RegimeStats {
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  grossPnl: number;
  netPnl: number;
  fees: number;
}

interface GradeStats {
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  netPnl: number;
}

async function auditCryptoShortTimeframe(asset: string, timeframe: Timeframe, limit = 1000) {
  console.log(`\n========================================================================`);
  console.log(`[AUDIT] RUNNING CRYPTO 15m QUALITY AUDIT FOR ${asset} ${timeframe} (${limit} bars)`);
  console.log(`========================================================================`);

  const candles = await marketService.getCandles(asset, timeframe, limit);
  if (!candles || candles.length < 50) {
    console.error(`Insufficient candles for ${asset} ${timeframe}: ${candles?.length || 0}`);
    return;
  }

  const baseConfig: ReplayConfig = {
    asset,
    timeframe,
    initialBalance: 10000,
    riskPerTradePercent: 1.0,
    feesBps: 5,
    slippageBps: 3,
    collisionRule: 'SL_FIRST',
    minRiskReward: 1.5,
    maxHoldingBars: 40,
    useAdaptiveEngine: true,
  };

  const replay = HistoricalReplayEngine.runReplay(candles, baseConfig);

  console.log(`\n--- OVERALL 15m REPLAY SUMMARY ---`);
  console.log(`Evaluated Candles: ${replay.totalCandles}`);
  console.log(`Total Signals:     ${replay.totalSignalsGenerated}`);
  console.log(`Total Trades:      ${replay.totalTradesExecuted}`);
  console.log(`Win Rate:          ${replay.winRate.toFixed(2)}% (${replay.wins} wins, ${replay.losses} losses, ${replay.timeouts} timeouts)`);
  console.log(`Expectancy (R):    ${replay.expectancyR.toFixed(2)}R`);
  console.log(`Profit Factor:     ${replay.profitFactor.toFixed(2)}`);
  console.log(`Gross PnL ($):     $${replay.grossPnlUsd.toFixed(2)}`);
  console.log(`Net PnL ($):       $${replay.netPnlUsd.toFixed(2)}`);
  console.log(`Total Fees ($):    $${replay.totalFeesUsd.toFixed(2)}`);
  console.log(`Total Slippage ($):$${replay.totalSlippageUsd.toFixed(2)}`);
  console.log(`Max Drawdown:      ${replay.maxDrawdownPercent.toFixed(2)}% ($${replay.maxDrawdownUsd.toFixed(2)})`);

  // Fee impact analysis
  const totalCost = replay.totalFeesUsd + replay.totalSlippageUsd;
  console.log(`\n--- TRANSACTION FRICTION DRAG ---`);
  console.log(`Total Friction Cost: $${totalCost.toFixed(2)} (${((totalCost / 10000) * 100).toFixed(2)}% of initial balance)`);
  if (replay.totalTradesExecuted > 0) {
    console.log(`Average Friction Per Trade: $${(totalCost / replay.totalTradesExecuted).toFixed(2)}`);
    console.log(`Gross Avg PnL: $${(replay.grossPnlUsd / replay.totalTradesExecuted).toFixed(2)} vs Net Avg PnL: $${(replay.netPnlUsd / replay.totalTradesExecuted).toFixed(2)}`);
  }

  // 1. Regime Breakdown
  const regimeMap: Record<string, RegimeStats> = {};
  for (const t of replay.trades) {
    const reg = t.regimeAtEntry || 'UNKNOWN';
    if (!regimeMap[reg]) {
      regimeMap[reg] = { trades: 0, wins: 0, losses: 0, totalR: 0, grossPnl: 0, netPnl: 0, fees: 0 };
    }
    const r = regimeMap[reg];
    r.trades++;
    if (t.outcome === 'WIN') r.wins++;
    else if (t.outcome === 'LOSS') r.losses++;
    r.totalR += t.rMultiple;
    r.grossPnl += t.grossPnlUsd;
    r.netPnl += t.netPnlUsd;
    r.fees += t.feesUsd + t.slippageUsd;
  }

  console.log(`\n--- PERFORMANCE BY REGIME ---`);
  console.table(
    Object.entries(regimeMap).map(([regime, s]) => ({
      Regime: regime,
      Trades: s.trades,
      WinRate: s.trades > 0 ? `${((s.wins / s.trades) * 100).toFixed(1)}%` : '0%',
      ExpectancyR: s.trades > 0 ? (s.totalR / s.trades).toFixed(2) : '0',
      NetPnL: `$${s.netPnl.toFixed(1)}`,
      Friction: `$${s.fees.toFixed(1)}`,
    }))
  );

  // 2. Grade & Confidence Breakdown
  const gradeMap: Record<string, GradeStats> = {};
  for (const t of replay.trades) {
    const q = t.qualityAtEntry || 0;
    const grade = q >= 80 ? 'A+' : q >= 70 ? 'A' : q >= 55 ? 'B' : 'C';
    if (!gradeMap[grade]) {
      gradeMap[grade] = { trades: 0, wins: 0, losses: 0, totalR: 0, netPnl: 0 };
    }
    const g = gradeMap[grade];
    g.trades++;
    if (t.outcome === 'WIN') g.wins++;
    else if (t.outcome === 'LOSS') g.losses++;
    g.totalR += t.rMultiple;
    g.netPnl += t.netPnlUsd;
  }

  console.log(`\n--- PERFORMANCE BY SETUP GRADE ---`);
  console.table(
    Object.entries(gradeMap).map(([grade, s]) => ({
      Grade: grade,
      Trades: s.trades,
      WinRate: s.trades > 0 ? `${((s.wins / s.trades) * 100).toFixed(1)}%` : '0%',
      ExpectancyR: s.trades > 0 ? (s.totalR / s.trades).toFixed(2) : '0',
      NetPnL: `$${s.netPnl.toFixed(1)}`,
    }))
  );

  // 3. Exit Reasons & Duration
  const exitReasons: Record<string, { count: number; avgR: number; avgDurationBars: number }> = {};
  for (const t of replay.trades) {
    const r = t.exitReason || 'UNKNOWN';
    if (!exitReasons[r]) {
      exitReasons[r] = { count: 0, avgR: 0, avgDurationBars: 0 };
    }
    exitReasons[r].count++;
    exitReasons[r].avgR += t.rMultiple;
    exitReasons[r].avgDurationBars += t.durationBars;
  }

  console.log(`\n--- EXIT REASONS & TRADE DURATION ---`);
  console.table(
    Object.entries(exitReasons).map(([reason, s]) => ({
      ExitReason: reason,
      Count: s.count,
      AvgR: (s.avgR / s.count).toFixed(2),
      AvgBars: (s.avgDurationBars / s.count).toFixed(1),
    }))
  );

  // 4. MFE / MAE Analysis: Are losing trades immediately stopping out or reaching partial profit first?
  let avgWinMfe = 0;
  let avgWinMae = 0;
  let avgLossMfe = 0;
  let avgLossMae = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const t of replay.trades) {
    if (t.outcome === 'WIN') {
      avgWinMfe += t.mfePercent;
      avgWinMae += t.maePercent;
      winCount++;
    } else {
      avgLossMfe += t.mfePercent;
      avgLossMae += t.maePercent;
      lossCount++;
    }
  }

  console.log(`\n--- MFE / MAE EXCURSION METRICS ---`);
  if (winCount > 0) {
    console.log(`Wins (N=${winCount}): Avg MFE = +${(avgWinMfe / winCount).toFixed(2)}%, Avg MAE = -${(avgWinMae / winCount).toFixed(2)}%`);
  }
  if (lossCount > 0) {
    console.log(`Losses (N=${lossCount}): Avg MFE = +${(avgLossMfe / lossCount).toFixed(2)}%, Avg MAE = -${(avgLossMae / lossCount).toFixed(2)}%`);
    console.log(`  -> Notice: Losing trades achieved an average positive excursion (MFE) of +${(avgLossMfe / lossCount).toFixed(2)}% before reversing to hit stop loss.`);
  }

  // 5. Rejection Funnel & Histogram
  console.log(`\n--- REJECTION FUNNEL & ATTRIBUTION ---`);
  console.log(`Total Evaluated Bars: ${replay.rejectionFunnel?.potentialBars ?? replay.totalCandles}`);
  console.log(`Structure Passed:     ${replay.rejectionFunnel?.structurePassed ?? 0}`);
  console.log(`Regime Passed:        ${replay.rejectionFunnel?.regimePassed ?? 0}`);
  console.log(`MTF Passed:           ${replay.rejectionFunnel?.mtfPassed ?? 0}`);
  console.log(`Risk Passed:          ${replay.rejectionFunnel?.riskPassed ?? 0}`);
  console.log(`Final Signals:        ${replay.rejectionFunnel?.finalSignals ?? 0}`);

  console.log(`\nTop Rejection Codes:`);
  const pot = replay.rejectionFunnel?.potentialBars || replay.totalCandles || 1;
  const topRejections = Object.entries(replay.rejectionHistogram || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  for (const [code, count] of topRejections) {
    console.log(`  ${code.padEnd(25)}: ${count} bars (${((count / pot) * 100).toFixed(1)}%)`);
  }
}

async function main() {
  await auditCryptoShortTimeframe('BTCUSDT', '15m', 1000);
  await auditCryptoShortTimeframe('ETHUSDT', '15m', 1000);
}

main().catch(console.error);
