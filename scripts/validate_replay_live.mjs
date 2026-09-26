import { marketService } from '../lib/market/marketService.ts';
import { HistoricalReplayEngine } from '../lib/quant/historicalReplayEngine.ts';
import { WalkForwardEngine } from '../lib/quant/walkForwardEngine.ts';
import { MonteCarloEngine } from '../lib/quant/monteCarloEngine.ts';
import { ParameterSensitivityEngine } from '../lib/quant/parameterSensitivity.ts';
import { ConfidenceCalibrationEngine } from '../lib/quant/confidenceCalibration.ts';

const setups = [
  { asset: 'BTCUSDT', timeframe: '15m' },
  { asset: 'BTCUSDT', timeframe: '1h' },
  { asset: 'ETHUSDT', timeframe: '15m' },
  { asset: 'XAUUSD', timeframe: '15m' },
  { asset: 'XAUUSD', timeframe: '1h' },
  { asset: 'EURUSD', timeframe: '15m' },
  { asset: 'EURUSD', timeframe: '1h' },
];

async function runValidation() {
  console.log('='.repeat(90));
  console.log('PHASE 3 LIVE HISTORICAL REPLAY VALIDATION (7 REAL MARKET SETUPS)');
  console.log('='.repeat(90));

  const summaryRows = [];

  for (const s of setups) {
    console.log(`\n>>> FETCHING REAL HISTORICAL CANDLES: ${s.asset} [${s.timeframe}]...`);
    const candles = await marketService.getCandles(s.asset, s.timeframe, 250);

    if (!candles || candles.length < 35) {
      console.log(`[!] INSUFFICIENT_DATA: Got ${candles?.length ?? 0} candles.`);
      summaryRows.push({
        asset: s.asset,
        timeframe: s.timeframe,
        candles: candles?.length ?? 0,
        trades: 0,
        winRate: 'N/A',
        profitFactor: 'N/A',
        expectancyR: 'N/A',
        maxDdPct: 'N/A',
        status: 'INSUFFICIENT_DATA',
      });
      continue;
    }

    console.log(`✓ Fetched ${candles.length} authentic candles. Replaying bar-by-bar (Zero Look-Ahead)...`);
    const replay = HistoricalReplayEngine.runReplay(candles, {
      asset: s.asset,
      timeframe: s.timeframe,
      initialBalance: 10000,
      riskPerTradePercent: 1.0,
      feesBps: 5,
      slippageBps: 3,
      collisionRule: 'SL_FIRST',
      minRiskReward: 1.5,
    });

    const wf = WalkForwardEngine.runWalkForward(candles, {
      asset: s.asset,
      timeframe: s.timeframe,
      collisionRule: 'SL_FIRST',
    }, 3);

    const mc = MonteCarloEngine.simulate(replay.trades, 10000, 10000);
    const cal = ConfidenceCalibrationEngine.evaluate(replay.trades);

    console.log(`- Trades: ${replay.totalTradesExecuted} (Long: ${replay.longTrades}, Short: ${replay.shortTrades})`);
    console.log(`- Win Rate: ${replay.winRate}% (Wins: ${replay.wins}, Losses: ${replay.losses}, Timeouts: ${replay.timeouts})`);
    console.log(`- Profit Factor: ${replay.profitFactor} | Expectancy: ${replay.expectancyR}R | Avg R: ${replay.averageR}R`);
    console.log(`- Net PnL: $${replay.netPnlUsd} (Fees: -$${replay.totalFeesUsd}, Slip: -$${replay.totalSlippageUsd})`);
    console.log(`- Max Drawdown: -${replay.maxDrawdownPercent}% (-$${replay.maxDrawdownUsd})`);
    console.log(`- Sharpe: ${replay.sharpeRatio} | Sortino: ${replay.sortinoRatio}`);
    console.log(`- Walk-Forward Efficiency (WFE): ${wf.meanWFE} (Grade: ${wf.robustnessGrade})`);
    console.log(`- Monte Carlo P50: $${mc.finalEquity.p50} | Prob of Ruin: ${mc.probabilityOfRuin}%`);
    console.log(`- Confidence Calibration: ${cal.status} (ECE: ${cal.expectedCalibrationError}%)`);

    summaryRows.push({
      asset: s.asset,
      timeframe: s.timeframe,
      candles: candles.length,
      trades: replay.totalTradesExecuted,
      longShort: `${replay.longTrades}/${replay.shortTrades}`,
      winRate: `${replay.winRate}%`,
      profitFactor: replay.profitFactor,
      expectancyR: `${replay.expectancyR}R`,
      maxDdPct: `-${replay.maxDrawdownPercent}%`,
      sharpe: replay.sharpeRatio,
      wfe: wf.meanWFE,
      status: replay.status,
    });
  }

  console.log('\n' + '='.repeat(90));
  console.log('SUMMARY RESULTS TABLE ACROSS 7 REAL HISTORICAL SETUPS:');
  console.log('='.repeat(90));
  console.log('| Asset | TF | Candles | Trades (L/S) | Win Rate | Profit Factor | Expectancy | Max DD | Sharpe | WFE | Status |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of summaryRows) {
    console.log(`| ${r.asset} | ${r.timeframe} | ${r.candles} | ${r.trades} (${r.longShort || '0/0'}) | ${r.winRate} | ${r.profitFactor} | ${r.expectancyR} | ${r.maxDdPct} | ${r.sharpe ?? 'N/A'} | ${r.wfe ?? 'N/A'} | ${r.status} |`);
  }
}

runValidation();
