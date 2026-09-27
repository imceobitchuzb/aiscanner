import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FROZEN_STRATEGY_CONFIG, FROZEN_STRATEGY_HASH, validateStrategyIntegrity, computeStrategyHash } from '../lib/quant/frozenStrategyConfig';
import { PaperTradingEngine, PaperPosition } from '../lib/quant/paperTradingEngine';
import { ForwardValidationEngine } from '../lib/quant/forwardValidationEngine';
import { ForexABExperiment } from '../lib/quant/forexABExperiment';
import { AdaptiveSignalEngine } from '../lib/quant/adaptiveSignalEngine';
import { HistoricalReplayEngine, ReplayConfig } from '../lib/quant/historicalReplayEngine';
import { Candle } from '../lib/types';

describe('Phase 7: Forward Validation & Production Readiness Suite', () => {
  // Mock candle generator
  const createCandle = (time: number, open: number, high: number, low: number, close: number, volume = 100): Candle => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  });

  const createTrendingBullSeries = (n = 100, startPrice = 50000, step = 50): Candle[] => {
    const candles: Candle[] = [];
    let p = startPrice;
    for (let i = 0; i < n; i++) {
      const open = p;
      const close = p + step;
      const high = close + 20;
      const low = open - 20;
      candles.push(createCandle(1700000000 + i * 3600, open, high, low, close, 1000 + i * 10));
      p = close;
    }
    return candles;
  };

  it('1. Safety Isolation: PaperTradingEngine cannot place live exchange orders', () => {
    const engine = new PaperTradingEngine({ initialBalance: 10000 });
    assert.strictEqual(engine.isRealExchangeOrderExecutionBlocked(), true);
    assert.strictEqual(engine.getStrategyVersion(), 'phase6-frozen');
    
    // Ensure no exchange credentials or endpoints exist on engine instance
    const anyEngine = engine as any;
    assert.strictEqual(anyEngine.apiKey, undefined);
    assert.strictEqual(anyEngine.apiSecret, undefined);
    assert.strictEqual(anyEngine.executeLiveExchangeOrder, undefined);
  });

  it('2. Frozen Strategy Configuration Integrity & Tamper Detection', () => {
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.strategyVersion, 'phase6-frozen');
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.minRiskReward, 1.5);
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.takeProfitRules.tp1Percent, 50);
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.takeProfitRules.tp2Percent, 30);
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.takeProfitRules.tp3Percent, 20);

    const check = validateStrategyIntegrity(FROZEN_STRATEGY_CONFIG);
    assert.strictEqual(check.isValid, true);
    assert.strictEqual(check.activeHash, FROZEN_STRATEGY_HASH);

    // Tamper test: mutating any parameter must immediately fail the integrity check
    const tamperedConfig = {
      ...FROZEN_STRATEGY_CONFIG,
      minRiskReward: 1.4, // unauthorized parameter tuning
    };
    const tamperedCheck = validateStrategyIntegrity(tamperedConfig as any);
    assert.strictEqual(tamperedCheck.isValid, false);
    assert.notStrictEqual(tamperedCheck.activeHash, FROZEN_STRATEGY_HASH);
    assert.match(tamperedCheck.message, /INTEGRITY VIOLATION/);
  });

  it('3. Live / Backtest / Paper Parity: Identical signal and trade plan generation', () => {
    const candles = createTrendingBullSeries(100);

    // 1. Direct Adaptive Signal Engine evaluation
    const liveSignal = AdaptiveSignalEngine.evaluate(candles, 'BTCUSDT', '1h', true, true, 1.5);

    // 2. Paper Trading Engine tick
    const paperEngine = new PaperTradingEngine({ initialBalance: 10000 });
    const { signal: paperSignal } = paperEngine.processMarketTick(candles, 'BTCUSDT', '1h', true, true);

    assert.strictEqual(liveSignal.direction, paperSignal.direction);
    assert.strictEqual(liveSignal.setupState, paperSignal.setupState);
    assert.strictEqual(liveSignal.setupQuality, paperSignal.setupQuality);

    if (liveSignal.tradePlan && paperSignal.tradePlan) {
      assert.strictEqual(liveSignal.tradePlan.stopLoss, paperSignal.tradePlan.stopLoss);
      assert.strictEqual(liveSignal.tradePlan.takeProfit1, paperSignal.tradePlan.takeProfit1);
      assert.strictEqual(liveSignal.tradePlan.takeProfit2, paperSignal.tradePlan.takeProfit2);
      assert.strictEqual(liveSignal.tradePlan.riskRewardRatio, paperSignal.tradePlan.riskRewardRatio);
    }
  });

  it('4. Zero Lookahead: PaperTradingEngine processes bars strictly chronologically', () => {
    const fullCandles = createTrendingBullSeries(80);
    const paperEngine = new PaperTradingEngine({ initialBalance: 10000 });

    // Stream bars 50 to 75 one by one
    for (let i = 50; i < 75; i++) {
      const slice = fullCandles.slice(0, i + 1);
      const res = paperEngine.processMarketTick(slice, 'BTCUSDT', '1h');
      const currentBar = slice[slice.length - 1];
      
      // True Zero Lookahead invariant: evaluated entry price must equal current bar close, not future bars
      if (res.signal.tradePlan) {
        assert.strictEqual(res.signal.tradePlan.entryPrice, currentBar.close);
      }
      assert.ok(res.signal.id.includes('BTCUSDT'));
    }

    const journal = paperEngine.getSignalJournal();
    assert.ok(journal.length >= 20);
    // Ensure all logged signals have the frozen strategy version stamped
    assert.strictEqual(journal[0].strategyVersion, 'phase6-frozen');
  });

  it('5. Partial Exit Progression: TP1 (50%), TP2 (30%), TP3 (20%) and Breakeven Trailing', () => {
    const paperEngine = new PaperTradingEngine({ initialBalance: 10000, defaultFeeBps: 0, defaultSlippageBps: 0 });
    const baseCandles = createTrendingBullSeries(70, 50000, 20);

    // Trigger initial tick to evaluate signal
    const evalRes = paperEngine.processMarketTick(baseCandles, 'BTCUSDT', '1h');
    
    // Manually register an active position to verify mechanical execution
    const pos: PaperPosition = {
      id: 'test-pos-1',
      signalId: 'sig-1',
      strategyVersion: 'phase6-frozen',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      direction: 'LONG',
      entryTime: 1700000000,
      entryPrice: 50000,
      initialUnits: 1.0,
      currentUnits: 1.0,
      stopLoss: 49000, // 1000 risk
      originalStopLoss: 49000,
      takeProfit1: 51200, // 1.2R
      takeProfit2: 52000, // 2.0R
      takeProfit3: 53000, // 3.0R
      tp1Executed: false,
      tp2Executed: false,
      tp3Executed: false,
      riskPerUnit: 1000,
      riskAmountUsd: 1000,
      riskPercent: 1.0,
      mfe: 50000,
      mae: 50000,
      mfeR: 0,
      maeR: 0,
      barsHeld: 0,
      feesPaidUsd: 0,
      slippagePaidUsd: 0,
      realizedPnlUsd: 0,
      partialFills: [],
    };

    (paperEngine as any).openPositions.set('BTCUSDT', pos);

    // Bar 1: Price touches TP1 (high = 51300)
    const bar1 = createCandle(1700003600, 50500, 51300, 50400, 51100);
    const tick1 = (paperEngine as any).evaluatePositionTick(pos, bar1);
    assert.strictEqual(tick1, undefined); // Position remains open
    assert.strictEqual(pos.tp1Executed, true);
    assert.strictEqual(pos.currentUnits, 0.5); // 50% closed
    assert.strictEqual(pos.stopLoss, 50000); // SL moved to breakeven!
    assert.strictEqual(pos.realizedPnlUsd, 600); // (51200 - 50000) * 0.5 = 600

    // Bar 2: Price touches TP2 (high = 52100)
    const bar2 = createCandle(1700007200, 51100, 52100, 51000, 51900);
    const tick2 = (paperEngine as any).evaluatePositionTick(pos, bar2);
    assert.strictEqual(tick2, undefined);
    assert.strictEqual(pos.tp2Executed, true);
    assert.strictEqual(pos.currentUnits, 0.2); // 30% closed, 20% remaining
    assert.strictEqual(pos.stopLoss, 51200); // SL trailed to TP1 level
    assert.strictEqual(pos.realizedPnlUsd, 600 + 600); // + (52000 - 50000) * 0.3 = 1200 total

    // Bar 3: Price touches TP3 runner (high = 53100)
    const bar3 = createCandle(1700010800, 51900, 53100, 51800, 53000);
    const closedTrade = (paperEngine as any).evaluatePositionTick(pos, bar3);
    assert.ok(closedTrade);
    assert.strictEqual(closedTrade.outcome, 'WIN');
    assert.strictEqual(closedTrade.exitReason, 'TP3_RUNNER');
    // Total PnL: 600 (TP1) + 600 (TP2) + (53000 - 50000) * 0.2 = 600 -> Total = 1800
    assert.strictEqual(closedTrade.realizedPnlUsd, 1800);
    assert.strictEqual(closedTrade.rMultiple, 1.8);
  });

  it('6. SL / TP Collision Handling: SL First rule takes precedence on extreme volatility', () => {
    const paperEngine = new PaperTradingEngine({ initialBalance: 10000 });
    const pos: PaperPosition = {
      id: 'test-pos-collision',
      signalId: 'sig-coll',
      strategyVersion: 'phase6-frozen',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      direction: 'LONG',
      entryTime: 1700000000,
      entryPrice: 50000,
      initialUnits: 1.0,
      currentUnits: 1.0,
      stopLoss: 49000,
      originalStopLoss: 49000,
      takeProfit1: 51200,
      takeProfit2: 52000,
      takeProfit3: 53000,
      tp1Executed: false,
      tp2Executed: false,
      tp3Executed: false,
      riskPerUnit: 1000,
      riskAmountUsd: 1000,
      riskPercent: 1.0,
      mfe: 50000,
      mae: 50000,
      mfeR: 0,
      maeR: 0,
      barsHeld: 0,
      feesPaidUsd: 0,
      slippagePaidUsd: 0,
      realizedPnlUsd: 0,
      partialFills: [],
    };

    // Extreme single candle touching BOTH TP1 (51500) and SL (48500)
    const volatileCandle = createCandle(1700003600, 50000, 51500, 48500, 49500);
    const closed = (paperEngine as any).evaluatePositionTick(pos, volatileCandle);

    assert.ok(closed);
    assert.strictEqual(closed.outcome, 'LOSS');
    assert.strictEqual(closed.exitReason, 'COLLISION_SL');
  });

  it('7. Fees & Slippage Deduction: Realized PnL strictly accounts for transaction costs', () => {
    // 10 bps fee, 5 bps slippage
    const paperEngine = new PaperTradingEngine({ initialBalance: 10000, defaultFeeBps: 10, defaultSlippageBps: 5 });
    const pos: PaperPosition = {
      id: 'test-fee-pos',
      signalId: 'sig-fee',
      strategyVersion: 'phase6-frozen',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      direction: 'LONG',
      entryTime: 1700000000,
      entryPrice: 50000,
      initialUnits: 1.0,
      currentUnits: 1.0,
      stopLoss: 49000,
      originalStopLoss: 49000,
      takeProfit1: 52000,
      takeProfit2: 53000,
      takeProfit3: 54000,
      tp1Executed: false,
      tp2Executed: false,
      tp3Executed: false,
      riskPerUnit: 1000,
      riskAmountUsd: 1000,
      riskPercent: 1.0,
      mfe: 50000,
      mae: 50000,
      mfeR: 0,
      maeR: 0,
      barsHeld: 0,
      feesPaidUsd: 50, // entry fee: 50000 * 1.0 * 0.0010 = $50
      slippagePaidUsd: 25,
      realizedPnlUsd: 0,
      partialFills: [],
    };

    // Exit at 50000 (breakeven gross price)
    const exitCandle = createCandle(1700003600, 50000, 50200, 49500, 50000);
    const closed = (paperEngine as any).closeEntirePosition(pos, 50000, exitCandle.time, 'MANUAL_CLOSE', 'WIN');

    assert.ok(closed.feesUsd >= 100); // $50 entry fee + $50 exit fee
    assert.ok(closed.realizedPnlUsd < 0); // Net PnL is negative due to fees despite breakeven gross price
  });

  it('8. Forex A/B Experiment Isolation: Does not modify frozen strategy configuration', () => {
    const fxCandles = createTrendingBullSeries(100, 1.0800, 0.0005);
    const initialHash = FROZEN_STRATEGY_HASH;

    const report = ForexABExperiment.runExperiment(fxCandles, 'EURUSD', '1h');
    assert.strictEqual(report.classification, 'RESEARCH_ONLY_ISOLATED_EXPERIMENT');
    assert.ok(report.variants.variantA);
    assert.ok(report.variants.variantB);
    assert.ok(report.variants.variantC);
    assert.strictEqual(report.variants.variantA.minRiskReward, 1.5);
    assert.strictEqual(report.variants.variantB.minRiskReward, 1.4);
    assert.strictEqual(report.variants.variantC.minRiskReward, 1.3);

    // Verify frozen strategy config remained completely untouched
    assert.strictEqual(FROZEN_STRATEGY_CONFIG.minRiskReward, 1.5);
    assert.strictEqual(computeStrategyHash(FROZEN_STRATEGY_CONFIG), initialHash);
  });

  it('9. ForwardValidationEngine: Daily Statistics and Weekly Governance Report', () => {
    const mockTrades = [
      {
        tradeId: 't1',
        signalId: 's1',
        strategyVersion: 'phase6-frozen',
        symbol: 'BTCUSDT',
        timeframe: '1h' as const,
        direction: 'LONG' as const,
        entryTimestamp: 1700000000,
        entryPrice: 50000,
        exitTimestamp: 1700007200, // date: 2023-11-14
        exitPrice: 52000,
        positionSize: 1,
        riskPercent: 1.0,
        stopLoss: 49000,
        takeProfit1: 51200,
        takeProfit2: 52000,
        takeProfit3: 53000,
        partialFills: [],
        feesUsd: 10,
        slippageUsd: 5,
        realizedPnlUsd: 1985,
        rMultiple: 1.98,
        mfeR: 2.1,
        maeR: 0.1,
        durationBars: 2,
        durationMs: 7200000,
        exitReason: 'TP2_HIT',
        outcome: 'WIN' as const,
      },
    ];

    const mockSignals = [
      {
        id: 's1',
        timestamp: 1700000000000,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        direction: 'LONG' as const,
        regime: 'TRENDING_BULL',
        structure1h: 'BULLISH',
        structure4h: 'BULLISH',
        session: 'LONDON',
        qualityScore: 85,
        rankScore: 85,
        mtfAlignment: 75,
        volatilityState: 'NORMAL',
        liquiditySweepState: false,
        entry: 50000,
        sl: 49000,
        tp1: 51200,
        tp2: 52000,
        riskRewardRatio: 2.0,
        riskMultiplier: 1.0,
        decision: 'EXECUTE' as const,
        strategyVersion: 'phase6-frozen',
      },
      {
        id: 's2',
        timestamp: 1700000000000,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        direction: 'NEUTRAL' as const,
        regime: 'RANGE',
        structure1h: 'RANGE',
        structure4h: 'RANGE',
        session: 'LONDON',
        qualityScore: 30,
        rankScore: 0,
        mtfAlignment: 25,
        volatilityState: 'NORMAL',
        liquiditySweepState: false,
        entry: 50000,
        sl: 49000,
        tp1: 51200,
        tp2: 52000,
        riskRewardRatio: 0,
        riskMultiplier: 1.0,
        decision: 'REJECT' as const,
        rejectionCode: 'RANGE_BREAKOUT_REJECTED',
        rejectionReason: 'Breakout rejected in range',
        strategyVersion: 'phase6-frozen',
      },
    ];

    const weeklyReport = ForwardValidationEngine.generateWeeklyReport(mockTrades, mockSignals, 1);
    assert.strictEqual(weeklyReport.strategyVersion, 'phase6-frozen');
    assert.strictEqual(weeklyReport.parameterIntegrity.status, 'VERIFIED');
    assert.strictEqual(weeklyReport.performanceSummary.totalTrades, 1);
    assert.strictEqual(weeklyReport.performanceSummary.winRate, 100);
    assert.strictEqual(weeklyReport.rejectionReasons['RANGE_BREAKOUT_REJECTED'].count, 1);
    assert.match(weeklyReport.governanceNote, /CRITICAL DIRECTIVE/);
  });
});
