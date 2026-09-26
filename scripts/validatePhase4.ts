import { marketService } from '../lib/market/marketService';
import { Timeframe } from '../lib/market/types';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { FilterAblationEngine } from '../lib/quant/filterAblationEngine';

interface ValidationResult {
  asset: string;
  timeframe: Timeframe;
  candlesCount: number;
  dataQualityStatus: string;
  coveragePercent: number;
  totalSignals: number;
  totalTrades: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  averageR: number;
  topRejections: [string, number][];
  ablationSummary: string;
}

async function runValidation() {
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

  console.log('========================================================================');
  console.log('NEXUS AI: PHASE 4 REAL MARKET VALIDATION RUN (8 SETUPS)');
  console.log('========================================================================\n');

  const results: ValidationResult[] = [];

  for (const s of setups) {
    try {
      console.log(`[FETCHING] ${s.asset} ${s.timeframe} (Requested: ${s.limit} candles)...`);
      const candles = await marketService.getCandles(s.asset, s.timeframe, s.limit);

      if (!candles || candles.length < 35) {
        console.warn(`[WARN] Insufficient candles for ${s.asset} ${s.timeframe}: ${candles?.length || 0}`);
        continue;
      }

      console.log(`[REPLAY] Replaying ${candles.length} candles for ${s.asset} ${s.timeframe}...`);
      const config: ReplayConfig = {
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

      const replay = HistoricalReplayEngine.runReplay(candles, config);
      const ablation = FilterAblationEngine.runAblation(candles, config);

      const topRejections = Object.entries(replay.rejectionHistogram || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      results.push({
        asset: s.asset,
        timeframe: s.timeframe,
        candlesCount: candles.length,
        dataQualityStatus: replay.dataQuality?.status || 'UNKNOWN',
        coveragePercent: replay.dataQuality?.coveragePercent || 0,
        totalSignals: replay.totalSignalsGenerated,
        totalTrades: replay.totalTradesExecuted,
        winRate: replay.winRate,
        expectancyR: replay.expectancyR,
        profitFactor: replay.profitFactor,
        maxDrawdownPercent: replay.maxDrawdownPercent,
        averageR: replay.averageR,
        topRejections,
        ablationSummary: ablation.summaryConclusion,
      });

      console.log(`[DONE] ${s.asset} ${s.timeframe}: ${candles.length} candles, ${replay.totalTradesExecuted} trades, WR ${replay.winRate}%, Exp ${replay.expectancyR} R, MaxDD -${replay.maxDrawdownPercent}%\n`);
    } catch (err: any) {
      console.error(`[ERROR] Validation failed for ${s.asset} ${s.timeframe}:`, err.message);
    }
  }

  console.log('\n========================================================================');
  console.log('SUMMARY TABLE: 8 SETUPS REAL PERFORMANCE METRICS');
  console.log('========================================================================');
  console.log(
    'Asset'.padEnd(10) +
    'TF'.padEnd(6) +
    'Candles'.padEnd(10) +
    'Signals'.padEnd(10) +
    'Trades'.padEnd(9) +
    'WinRate'.padEnd(10) +
    'Exp (R)'.padEnd(10) +
    'PF'.padEnd(8) +
    'Max DD'.padEnd(10) +
    'Avg R'.padEnd(8) +
    'Top Rejection Reasons'
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    const rejStr = r.topRejections.map(([code, count]) => `${code}(${count})`).join(', ');
    console.log(
      r.asset.padEnd(10) +
      r.timeframe.padEnd(6) +
      String(r.candlesCount).padEnd(10) +
      String(r.totalSignals).padEnd(10) +
      String(r.totalTrades).padEnd(9) +
      `${r.winRate}%`.padEnd(10) +
      `${r.expectancyR > 0 ? '+' : ''}${r.expectancyR}`.padEnd(10) +
      String(r.profitFactor).padEnd(8) +
      `-${r.maxDrawdownPercent}%`.padEnd(10) +
      String(r.averageR).padEnd(8) +
      rejStr
    );
  }

  console.log('\n========================================================================');
  console.log('FILTER ABLATION INSIGHTS ACROSS ASSETS');
  console.log('========================================================================');
  for (const r of results) {
    console.log(`* ${r.asset} ${r.timeframe}: ${r.ablationSummary}`);
  }
}

runValidation().catch(console.error);
