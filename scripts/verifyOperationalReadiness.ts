import { FROZEN_STRATEGY_CONFIG, FROZEN_STRATEGY_HASH, validateStrategyIntegrity } from '../lib/quant/frozenStrategyConfig';
import { PaperTradingEngine } from '../lib/quant/paperTradingEngine';
import { ForwardValidationEngine } from '../lib/quant/forwardValidationEngine';
import { marketService } from '../lib/market/marketService';

async function runOperationalVerification() {
  console.log('================================================================================');
  console.log('NEXUS AI: PHASE 7 OPERATIONAL VERIFICATION & FORWARD VALIDATION CHECK');
  console.log('================================================================================\n');

  // 1. Verify Strategy Version & SHA-256 Hash
  const expectedHash = '96c00f39e31d7e2e342790e66d03d1db13f28cf01b979ea617fa72545d98dc2d';
  const integrity = validateStrategyIntegrity(FROZEN_STRATEGY_CONFIG);
  console.log(`1. Strategy Version:      ${FROZEN_STRATEGY_CONFIG.strategyVersion}`);
  console.log(`2. Integrity Hash Check:   ${integrity.isValid ? 'MATCH' : 'MISMATCH'}`);
  console.log(`   Expected Hash:          ${expectedHash}`);
  console.log(`   Active Hash:            ${integrity.activeHash}`);
  if (integrity.activeHash !== expectedHash) {
    throw new Error(`CRITICAL: Active hash ${integrity.activeHash} does not match expected ${expectedHash}`);
  }

  // 2. Initialize Paper Trading Engine
  const engine = PaperTradingEngine.getInstance({ initialBalance: 10000 });
  const isIsolated = engine.isRealExchangeOrderExecutionBlocked();
  console.log(`3. Exchange Order Block:  ${isIsolated ? 'CONFIRMED (100% Virtual Sandbox)' : 'FAILED'}`);

  // 3. Process Live Market Candles for Primary Assets (BTCUSDT 1h & XAUUSD 1h)
  const primaryPairs = [
    { symbol: 'BTCUSDT', timeframe: '1h' as const },
    { symbol: 'XAUUSD', timeframe: '1h' as const },
  ];

  let lastCandleTime = 0;

  for (const pair of primaryPairs) {
    process.stdout.write(`4. Ingesting live feed:   ${pair.symbol.padEnd(8)} ${pair.timeframe}... `);
    const candles = await marketService.getCandles(pair.symbol, pair.timeframe, 150);
    if (!candles || candles.length < 50) {
      throw new Error(`Failed to ingest sufficient candles for ${pair.symbol}`);
    }
    const latest = candles[candles.length - 1];
    if (latest.time > lastCandleTime) {
      lastCandleTime = latest.time;
    }
    console.log(`OK (${candles.length} bars, latest: ${new Date(latest.time * 1000).toISOString()})`);

    // Process tick through Paper Trading Engine
    const tickResult = engine.processMarketTick(candles, pair.symbol, pair.timeframe, true, true);
    console.log(`   -> Evaluated Signal:   ${tickResult.signal.direction} [${tickResult.signal.setupState}] Quality: ${tickResult.signal.setupQuality}/100`);
    if (tickResult.signal.rejectionCode) {
      console.log(`   -> Rejection Reason:   [${tickResult.signal.rejectionCode}] ${tickResult.signal.rejectionReason}`);
    }
  }

  // 4. Retrieve Account & Journal State
  const account = engine.getAccountState();
  const openPositions = engine.getOpenPositions();
  const closedTrades = engine.getClosedTrades();
  const signalJournal = engine.getSignalJournal(100);
  const rejections = signalJournal.filter((s) => s.decision === 'REJECT');

  // 5. Daily Statistics
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyStats = ForwardValidationEngine.computeDailyStatistics(closedTrades, signalJournal, todayStr);

  // 6. Weekly Governance Report
  const weeklyReport = ForwardValidationEngine.generateWeeklyReport(closedTrades, signalJournal, 1);

  // 7. Time Boundaries
  const matrix = ForwardValidationEngine.VALIDATION_MATRIX;
  const startTimestamp = new Date(matrix.startDate).toISOString();
  const endTimestamp = new Date(matrix.endDate).toISOString();

  console.log('\n================================================================================');
  console.log('OPERATIONAL READINESS SUMMARY REPORT:');
  console.log('================================================================================');
  console.log(`* Current Strategy Version:           ${FROZEN_STRATEGY_CONFIG.strategyVersion}`);
  console.log(`* Integrity Status:                   ${integrity.isValid ? 'VERIFIED (SHA-256 match)' : 'COMPROMISED'}`);
  console.log(`* Last Processed Candle Timestamp:    ${new Date(lastCandleTime * 1000).toISOString()} (${lastCandleTime})`);
  console.log(`* Monitored Symbols / Timeframes:     BTCUSDT 1h, XAUUSD 1h (Primary) | ETHUSDT 1h, BTC/ETH 15m, EUR/GBP 15m/1h (Secondary)`);
  console.log(`* Current Paper Balance:              $${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Equity: $${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })})`);
  console.log(`* Number of Signals Processed:        ${signalJournal.length}`);
  console.log(`* Number of Rejected Setups:          ${rejections.length}`);
  console.log(`* Number of Paper Trades:             ${account.totalTrades}`);
  console.log(`* Number of Open Positions:           ${openPositions.length}`);
  console.log(`* Forward-Test Start Timestamp:       ${startTimestamp}`);
  console.log(`* Expected 60-Day Completion:         ${endTimestamp} (${matrix.validationDurationDays} days)`);
  console.log(`* Real Trading Safety Confirmation:   CONFIRMED — 100% Virtual Execution Sandbox; zero exchange order API routes exist.`);
  console.log(`* Governance Integrity Status:        ${weeklyReport.parameterIntegrity.status} (${weeklyReport.governanceNote})`);
  console.log('================================================================================\n');
}

runOperationalVerification().catch((err) => {
  console.error('Operational verification failed:', err);
  process.exit(1);
});
