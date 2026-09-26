import { Candle, Timeframe } from '../types';
import { SignalDecisionEngine, UnifiedSignalResult } from './signalDecisionEngine';

export interface ReplayConfig {
  asset: string;
  timeframe: Timeframe;
  initialBalance?: number;
  riskPerTradePercent?: number;
  feesBps?: number;
  slippageBps?: number;
  collisionRule?: 'SL_FIRST' | 'TP_FIRST';
  maxHoldingBars?: number;
  minRiskReward?: number;
  startDate?: number;
  endDate?: number;
}

export type TradeOutcome = 'WIN' | 'LOSS' | 'TIMEOUT' | 'INVALIDATED';

export interface ReplayedTrade {
  tradeId: string;
  signalId: string;
  asset: string;
  timeframe: Timeframe;
  direction: 'LONG' | 'SHORT';
  signalBarIndex: number;
  entryBarIndex: number;
  exitBarIndex: number;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  outcome: TradeOutcome;
  exitReason: 'SL_HIT' | 'TP1_HIT' | 'TP2_HIT' | 'TIMEOUT' | 'COLLISION_SL';
  rMultiple: number;
  units: number;
  grossPnlUsd: number;
  netPnlUsd: number;
  feesUsd: number;
  slippageUsd: number;
  pnlPercent: number;
  mfePercent: number;
  maePercent: number;
  durationBars: number;
  durationSeconds: number;
  regimeAtEntry: string;
  confidenceAtEntry: number;
  qualityAtEntry: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
  tradeIndex: number;
}

export interface MetricGroup {
  signals: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  averageR: number;
  medianR: number;
  expectancyR: number;
  profitFactor: number;
  netPnlUsd: number;
  averageDurationBars: number;
}

export interface ReplaySummary {
  config: Required<ReplayConfig>;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  totalCandles: number;
  totalSignalsGenerated: number;
  totalTradesExecuted: number;
  longTrades: number;
  shortTrades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  grossPnlUsd: number;
  totalFeesUsd: number;
  totalSlippageUsd: number;
  netPnlUsd: number;
  finalBalance: number;
  averageR: number;
  medianR: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownUsd: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  averageMfePercent: number;
  averageMaePercent: number;
  averageDurationBars: number;
  averageDurationHours: number;
  equityCurve: EquityPoint[];
  trades: ReplayedTrade[];
  breakdownByRegime: Record<string, MetricGroup | 'INSUFFICIENT_SAMPLE'>;
  breakdownByConfidence: Record<string, MetricGroup | 'INSUFFICIENT_SAMPLE'>;
  breakdownByRiskReward: Record<string, MetricGroup | 'INSUFFICIENT_SAMPLE'>;
  breakdownByDirection: {
    long: MetricGroup | 'INSUFFICIENT_SAMPLE';
    short: MetricGroup | 'INSUFFICIENT_SAMPLE';
  };
  collisionRuleUsed: 'SL_FIRST' | 'TP_FIRST';
  limitations: string[];
}

export class HistoricalReplayEngine {
  /**
   * Deterministically replays market history bar-by-bar with zero lookahead bias.
   */
  public static runReplay(candles: Candle[], userConfig: ReplayConfig): ReplaySummary {
    const config: Required<ReplayConfig> = {
      asset: userConfig.asset,
      timeframe: userConfig.timeframe,
      initialBalance: userConfig.initialBalance ?? 10000,
      riskPerTradePercent: userConfig.riskPerTradePercent ?? 1.0,
      feesBps: userConfig.feesBps ?? 5,
      slippageBps: userConfig.slippageBps ?? 3,
      collisionRule: userConfig.collisionRule ?? 'SL_FIRST',
      maxHoldingBars: userConfig.maxHoldingBars ?? 40,
      minRiskReward: userConfig.minRiskReward ?? 1.5,
      startDate: userConfig.startDate ?? (candles.length > 0 ? candles[0].time : 0),
      endDate: userConfig.endDate ?? (candles.length > 0 ? candles[candles.length - 1].time : 0),
    };

    // Filter candles within date range
    const filteredCandles = candles.filter(
      (c) => c.time >= config.startDate && c.time <= config.endDate
    );

    if (filteredCandles.length < 35) {
      return this.createInsufficientDataSummary(config, filteredCandles.length);
    }

    const trades: ReplayedTrade[] = [];
    const equityCurve: EquityPoint[] = [];
    let currentEquity = config.initialBalance;
    let peakEquity = config.initialBalance;
    let maxDrawdownUsd = 0;
    let maxDrawdownPercent = 0;

    equityCurve.push({
      time: filteredCandles[0].time,
      equity: currentEquity,
      drawdown: 0,
      drawdownPercent: 0,
      tradeIndex: 0,
    });

    let activeTrade: {
      tradeId: string;
      signalId: string;
      direction: 'LONG' | 'SHORT';
      signalBarIndex: number;
      entryBarIndex: number;
      entryTime: number;
      entryPrice: number;
      stopLoss: number;
      takeProfit1: number;
      takeProfit2: number;
      riskRewardRatio: number;
      initialRiskPerUnit: number;
      units: number;
      regime: string;
      confidence: number;
      quality: number;
      mfe: number;
      mae: number;
    } | null = null;

    let pendingSignal: UnifiedSignalResult | null = null;
    let pendingSignalBarIndex = -1;
    let totalSignalsGenerated = 0;

    // Minimum warmup bars to allow indicators (EMA, RSI, ADX) to initialize
    const warmupBars = 30;

    for (let t = warmupBars; t < filteredCandles.length; t++) {
      const currentBar = filteredCandles[t];

      // 1. Process Active Trade Execution on currentBar
      if (activeTrade !== null) {
        const isLong = activeTrade.direction === 'LONG';
        const durationBars = t - activeTrade.entryBarIndex;
        let isClosed = false;
        let exitPrice = 0;
        let exitReason: ReplayedTrade['exitReason'] = 'SL_HIT';
        let outcome: TradeOutcome = 'LOSS';

        // Update MFE & MAE
        if (isLong) {
          const favorablePct = ((currentBar.high - activeTrade.entryPrice) / activeTrade.entryPrice) * 100;
          const adversePct = ((activeTrade.entryPrice - currentBar.low) / activeTrade.entryPrice) * 100;
          activeTrade.mfe = Math.max(activeTrade.mfe, favorablePct);
          activeTrade.mae = Math.max(activeTrade.mae, adversePct);
        } else {
          const favorablePct = ((activeTrade.entryPrice - currentBar.low) / activeTrade.entryPrice) * 100;
          const adversePct = ((currentBar.high - activeTrade.entryPrice) / activeTrade.entryPrice) * 100;
          activeTrade.mfe = Math.max(activeTrade.mfe, favorablePct);
          activeTrade.mae = Math.max(activeTrade.mae, adversePct);
        }

        // Check SL and TP hits
        if (isLong) {
          const slHit = currentBar.low <= activeTrade.stopLoss;
          const tp2Hit = currentBar.high >= activeTrade.takeProfit2;
          const tp1Hit = currentBar.high >= activeTrade.takeProfit1;

          if (slHit && tp1Hit) {
            // SL / TP Collision in the same bar
            if (config.collisionRule === 'SL_FIRST') {
              isClosed = true;
              exitPrice = activeTrade.stopLoss;
              exitReason = 'COLLISION_SL';
              outcome = 'LOSS';
            } else {
              isClosed = true;
              exitPrice = activeTrade.takeProfit1;
              exitReason = 'TP1_HIT';
              outcome = 'WIN';
            }
          } else if (slHit) {
            isClosed = true;
            exitPrice = activeTrade.stopLoss;
            exitReason = 'SL_HIT';
            outcome = 'LOSS';
          } else if (tp2Hit) {
            isClosed = true;
            exitPrice = activeTrade.takeProfit2;
            exitReason = 'TP2_HIT';
            outcome = 'WIN';
          } else if (tp1Hit) {
            isClosed = true;
            exitPrice = activeTrade.takeProfit1;
            exitReason = 'TP1_HIT';
            outcome = 'WIN';
          } else if (durationBars >= config.maxHoldingBars) {
            isClosed = true;
            exitPrice = currentBar.close;
            exitReason = 'TIMEOUT';
            outcome = exitPrice > activeTrade.entryPrice ? 'WIN' : 'TIMEOUT';
          }
        } else {
          // SHORT
          const slHit = currentBar.high >= activeTrade.stopLoss;
          const tp2Hit = currentBar.low <= activeTrade.takeProfit2;
          const tp1Hit = currentBar.low <= activeTrade.takeProfit1;

          if (slHit && tp1Hit) {
            if (config.collisionRule === 'SL_FIRST') {
              isClosed = true;
              exitPrice = activeTrade.stopLoss;
              exitReason = 'COLLISION_SL';
              outcome = 'LOSS';
            } else {
              isClosed = true;
              exitPrice = activeTrade.takeProfit1;
              exitReason = 'TP1_HIT';
              outcome = 'WIN';
            }
          } else if (slHit) {
            isClosed = true;
            exitPrice = activeTrade.stopLoss;
            exitReason = 'SL_HIT';
            outcome = 'LOSS';
          } else if (tp2Hit) {
            isClosed = true;
            exitPrice = activeTrade.takeProfit2;
            exitReason = 'TP2_HIT';
            outcome = 'WIN';
          } else if (tp1Hit) {
            isClosed = true;
            exitPrice = activeTrade.takeProfit1;
            exitReason = 'TP1_HIT';
            outcome = 'WIN';
          } else if (durationBars >= config.maxHoldingBars) {
            isClosed = true;
            exitPrice = currentBar.close;
            exitReason = 'TIMEOUT';
            outcome = exitPrice < activeTrade.entryPrice ? 'WIN' : 'TIMEOUT';
          }
        }

        if (isClosed) {
          // Apply slippage to exit
          const slippageRate = config.slippageBps / 10000;
          const feeRate = config.feesBps / 10000;

          const adjustedExitPrice = isLong
            ? exitPrice * (1 - slippageRate)
            : exitPrice * (1 + slippageRate);

          const rawGainPerUnit = isLong
            ? adjustedExitPrice - activeTrade.entryPrice
            : activeTrade.entryPrice - adjustedExitPrice;

          const rMultiple = activeTrade.initialRiskPerUnit > 0
            ? Math.round((rawGainPerUnit / activeTrade.initialRiskPerUnit) * 100) / 100
            : 0;

          const notionalEntry = activeTrade.units * activeTrade.entryPrice;
          const notionalExit = activeTrade.units * adjustedExitPrice;
          const feesUsd = (notionalEntry + notionalExit) * feeRate;
          const slippageUsd = (notionalEntry + notionalExit) * slippageRate;
          const grossPnlUsd = rawGainPerUnit * activeTrade.units;
          const netPnlUsd = grossPnlUsd - feesUsd;

          currentEquity += netPnlUsd;
          if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
          }
          const currentDdUsd = Math.max(0, peakEquity - currentEquity);
          const currentDdPct = peakEquity > 0 ? (currentDdUsd / peakEquity) * 100 : 0;
          if (currentDdUsd > maxDrawdownUsd) maxDrawdownUsd = currentDdUsd;
          if (currentDdPct > maxDrawdownPercent) maxDrawdownPercent = currentDdPct;

          const completedTrade: ReplayedTrade = {
            tradeId: activeTrade.tradeId,
            signalId: activeTrade.signalId,
            asset: config.asset,
            timeframe: config.timeframe,
            direction: activeTrade.direction,
            signalBarIndex: activeTrade.signalBarIndex,
            entryBarIndex: activeTrade.entryBarIndex,
            exitBarIndex: t,
            entryTime: activeTrade.entryTime,
            entryPrice: activeTrade.entryPrice,
            exitTime: currentBar.time,
            exitPrice: Math.round(adjustedExitPrice * 10000) / 10000,
            stopLoss: activeTrade.stopLoss,
            takeProfit1: activeTrade.takeProfit1,
            takeProfit2: activeTrade.takeProfit2,
            riskRewardRatio: activeTrade.riskRewardRatio,
            outcome,
            exitReason,
            rMultiple,
            units: activeTrade.units,
            grossPnlUsd: Math.round(grossPnlUsd * 100) / 100,
            netPnlUsd: Math.round(netPnlUsd * 100) / 100,
            feesUsd: Math.round(feesUsd * 100) / 100,
            slippageUsd: Math.round(slippageUsd * 100) / 100,
            pnlPercent: Math.round((netPnlUsd / notionalEntry) * 10000) / 100,
            mfePercent: Math.round(activeTrade.mfe * 100) / 100,
            maePercent: Math.round(activeTrade.mae * 100) / 100,
            durationBars,
            durationSeconds: currentBar.time - activeTrade.entryTime,
            regimeAtEntry: activeTrade.regime,
            confidenceAtEntry: activeTrade.confidence,
            qualityAtEntry: activeTrade.quality,
          };

          trades.push(completedTrade);
          equityCurve.push({
            time: currentBar.time,
            equity: Math.round(currentEquity * 100) / 100,
            drawdown: Math.round(currentDdUsd * 100) / 100,
            drawdownPercent: Math.round(currentDdPct * 100) / 100,
            tradeIndex: trades.length,
          });

          activeTrade = null;
        }
      }

      // 2. Check Pending Signal Entry Fill at open of currentBar
      if (activeTrade === null && pendingSignal !== null && pendingSignal.tradePlan) {
        if (pendingSignal.direction !== 'LONG' && pendingSignal.direction !== 'SHORT') {
          pendingSignal = null;
          pendingSignalBarIndex = -1;
          continue;
        }

        const plan = pendingSignal.tradePlan;
        const slippageRate = config.slippageBps / 10000;
        const direction: 'LONG' | 'SHORT' = pendingSignal.direction;
        const isLong = direction === 'LONG';

        // Entry fill at current bar open (standard Next Bar Market Execution)
        const filledPrice = isLong
          ? currentBar.open * (1 + slippageRate)
          : currentBar.open * (1 - slippageRate);

        const initialRiskPerUnit = isLong
          ? Math.max(0.0001, filledPrice - plan.stopLoss)
          : Math.max(0.0001, plan.stopLoss - filledPrice);

        const riskAmountUsd = currentEquity * (config.riskPerTradePercent / 100);
        const units = initialRiskPerUnit > 0 ? riskAmountUsd / initialRiskPerUnit : 0;

        activeTrade = {
          tradeId: `TRD_${t}_${direction}`,
          signalId: pendingSignal.id,
          direction,
          signalBarIndex: pendingSignalBarIndex,
          entryBarIndex: t,
          entryTime: currentBar.time,
          entryPrice: Math.round(filledPrice * 10000) / 10000,
          stopLoss: plan.stopLoss,
          takeProfit1: plan.takeProfit1,
          takeProfit2: plan.takeProfit2,
          riskRewardRatio: plan.riskRewardRatio,
          initialRiskPerUnit,
          units,
          regime: pendingSignal.marketState.regime,
          confidence: pendingSignal.modelConfidence,
          quality: pendingSignal.setupQuality,
          mfe: 0,
          mae: 0,
        };

        pendingSignal = null;
        pendingSignalBarIndex = -1;
      }

      // 3. Generate Signal on Closed Bar `t` (Available history strictly [0..t])
      if (activeTrade === null && pendingSignal === null) {
        const availableHistory = filteredCandles.slice(0, t + 1);

        const evaluation = SignalDecisionEngine.evaluate(
          availableHistory,
          config.asset,
          config.timeframe,
          true,
          true,
          config.minRiskReward
        );

        if (
          (evaluation.direction === 'LONG' || evaluation.direction === 'SHORT') &&
          (evaluation.setupState === 'CONFIRMED' || evaluation.setupState === 'ACTIVE') &&
          evaluation.tradePlan !== null
        ) {
          totalSignalsGenerated++;
          pendingSignal = evaluation;
          pendingSignalBarIndex = t;
        }
      }
    }

    // Calculate aggregated metrics
    return this.buildSummary(config, filteredCandles.length, totalSignalsGenerated, trades, equityCurve, currentEquity, maxDrawdownUsd, maxDrawdownPercent);
  }

  /**
   * Builds detailed quantitative metrics, breakdowns, Sharpe, Sortino.
   */
  private static buildSummary(
    config: Required<ReplayConfig>,
    totalCandles: number,
    totalSignalsGenerated: number,
    trades: ReplayedTrade[],
    equityCurve: EquityPoint[],
    finalBalance: number,
    maxDrawdownUsd: number,
    maxDrawdownPercent: number
  ): ReplaySummary {
    const totalTrades = trades.length;
    const longTrades = trades.filter((t) => t.direction === 'LONG');
    const shortTrades = trades.filter((t) => t.direction === 'SHORT');
    const wins = trades.filter((t) => t.outcome === 'WIN');
    const losses = trades.filter((t) => t.outcome === 'LOSS');
    const timeouts = trades.filter((t) => t.outcome === 'TIMEOUT');

    const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 10000) / 100 : 0;

    const grossWinsUsd = wins.reduce((s, t) => s + Math.max(0, t.grossPnlUsd), 0);
    const grossLossesUsd = Math.abs(losses.reduce((s, t) => s + Math.min(0, t.grossPnlUsd), 0));
    const profitFactor = grossLossesUsd > 0
      ? Math.round((grossWinsUsd / grossLossesUsd) * 100) / 100
      : grossWinsUsd > 0 ? 999 : 0;

    const grossPnlUsd = Math.round(trades.reduce((s, t) => s + t.grossPnlUsd, 0) * 100) / 100;
    const totalFeesUsd = Math.round(trades.reduce((s, t) => s + t.feesUsd, 0) * 100) / 100;
    const totalSlippageUsd = Math.round(trades.reduce((s, t) => s + t.slippageUsd, 0) * 100) / 100;
    const netPnlUsd = Math.round(trades.reduce((s, t) => s + t.netPnlUsd, 0) * 100) / 100;

    // R Metrics
    const rValues = trades.map((t) => t.rMultiple);
    const averageR = rValues.length > 0
      ? Math.round((rValues.reduce((a, b) => a + b, 0) / rValues.length) * 100) / 100
      : 0;

    const sortedR = [...rValues].sort((a, b) => a - b);
    const medianR = sortedR.length > 0
      ? sortedR[Math.floor(sortedR.length / 2)]
      : 0;

    // Expectancy in R: (WinRate * AvgWinR) - (LossRate * AvgLossR)
    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;
    const winRateFrac = totalTrades > 0 ? wins.length / totalTrades : 0;
    const lossRateFrac = totalTrades > 0 ? losses.length / totalTrades : 0;
    const expectancyR = Math.round((winRateFrac * avgWinR - lossRateFrac * avgLossR) * 100) / 100;

    // Sharpe & Sortino ratios (based on trade percentage returns)
    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 1
      ? returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    // Annualized Sharpe (assuming ~300 trades/year or normalized by stdDev)
    const annualFactor = Math.sqrt(252);
    const sharpeRatio = stdDev > 0 ? Math.round(((meanReturn / stdDev) * annualFactor) * 100) / 100 : 0;

    const downsideReturns = returns.filter((r) => r < 0);
    const downsideVariance = downsideReturns.length > 1
      ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / (downsideReturns.length - 1)
      : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideStdDev > 0 ? Math.round(((meanReturn / downsideStdDev) * annualFactor) * 100) / 100 : 0;

    // MFE & MAE
    const averageMfePercent = trades.length > 0
      ? Math.round((trades.reduce((s, t) => s + t.mfePercent, 0) / trades.length) * 100) / 100
      : 0;
    const averageMaePercent = trades.length > 0
      ? Math.round((trades.reduce((s, t) => s + t.maePercent, 0) / trades.length) * 100) / 100
      : 0;

    const averageDurationBars = trades.length > 0
      ? Math.round((trades.reduce((s, t) => s + t.durationBars, 0) / trades.length) * 10) / 10
      : 0;
    const averageDurationHours = trades.length > 0
      ? Math.round((trades.reduce((s, t) => s + t.durationSeconds, 0) / trades.length / 3600) * 10) / 10
      : 0;

    // Breakdowns
    const breakdownByRegime = this.computeMetricGroups(trades, (t) => t.regimeAtEntry);
    const breakdownByConfidence = this.computeMetricGroups(trades, (t) => {
      const c = t.confidenceAtEntry;
      if (c < 50) return '0-50';
      if (c < 60) return '50-60';
      if (c < 70) return '60-70';
      if (c < 80) return '70-80';
      if (c < 90) return '80-90';
      return '90-100';
    });
    const breakdownByRiskReward = this.computeMetricGroups(trades, (t) => {
      const rr = t.riskRewardRatio;
      if (rr < 2.0) return '1.5-2.0';
      if (rr < 2.5) return '2.0-2.5';
      if (rr < 3.0) return '2.5-3.0';
      return '3.0+';
    });

    const longMetrics = this.computeSingleMetricGroup(longTrades);
    const shortMetrics = this.computeSingleMetricGroup(shortTrades);

    const limitations: string[] = [
      'Историческая доходность не гарантирует будущих результатов.',
      `Использовано консервативное правило коллизий: ${config.collisionRule}. При касании SL и TP на одной свече позиция считается закрытой по стоп-лоссу.`,
      `Учтены торговые издержки: комиссии ${config.feesBps} bps, проскальзывание ${config.slippageBps} bps на вход и выход.`,
      totalTrades < 30 ? 'ВНИМАНИЕ: Размер выборки < 30 сделок, статистическая значимость ограничена.' : 'Статистическая выборка достаточна для предварительной оценки.',
    ];

    return {
      config,
      status: 'SUCCESS',
      totalCandles,
      totalSignalsGenerated,
      totalTradesExecuted: totalTrades,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      wins: wins.length,
      losses: losses.length,
      timeouts: timeouts.length,
      winRate,
      grossPnlUsd,
      totalFeesUsd,
      totalSlippageUsd,
      netPnlUsd,
      finalBalance: Math.round(finalBalance * 100) / 100,
      averageR,
      medianR,
      expectancyR,
      profitFactor,
      maxDrawdownUsd: Math.round(maxDrawdownUsd * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
      sharpeRatio,
      sortinoRatio,
      averageMfePercent,
      averageMaePercent,
      averageDurationBars,
      averageDurationHours,
      equityCurve,
      trades,
      breakdownByRegime,
      breakdownByConfidence,
      breakdownByRiskReward,
      breakdownByDirection: {
        long: longMetrics,
        short: shortMetrics,
      },
      collisionRuleUsed: config.collisionRule,
      limitations,
    };
  }

  private static computeMetricGroups(
    trades: ReplayedTrade[],
    keySelector: (t: ReplayedTrade) => string
  ): Record<string, MetricGroup | 'INSUFFICIENT_SAMPLE'> {
    const buckets: Record<string, ReplayedTrade[]> = {};
    for (const t of trades) {
      const key = keySelector(t);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    }

    const result: Record<string, MetricGroup | 'INSUFFICIENT_SAMPLE'> = {};
    for (const [key, groupTrades] of Object.entries(buckets)) {
      if (groupTrades.length < 3) {
        result[key] = 'INSUFFICIENT_SAMPLE';
      } else {
        result[key] = this.computeSingleMetricGroup(groupTrades);
      }
    }
    return result;
  }

  private static computeSingleMetricGroup(trades: ReplayedTrade[]): MetricGroup {
    const total = trades.length;
    if (total === 0) {
      return {
        signals: 0,
        wins: 0,
        losses: 0,
        timeouts: 0,
        winRate: 0,
        averageR: 0,
        medianR: 0,
        expectancyR: 0,
        profitFactor: 0,
        netPnlUsd: 0,
        averageDurationBars: 0,
      };
    }

    const wins = trades.filter((t) => t.outcome === 'WIN');
    const losses = trades.filter((t) => t.outcome === 'LOSS');
    const timeouts = trades.filter((t) => t.outcome === 'TIMEOUT');
    const winRate = Math.round((wins.length / total) * 10000) / 100;

    const rValues = trades.map((t) => t.rMultiple);
    const averageR = Math.round((rValues.reduce((a, b) => a + b, 0) / total) * 100) / 100;
    const sortedR = [...rValues].sort((a, b) => a - b);
    const medianR = sortedR[Math.floor(sortedR.length / 2)];

    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;
    const expectancyR = Math.round(((wins.length / total) * avgWinR - (losses.length / total) * avgLossR) * 100) / 100;

    const grossWins = wins.reduce((s, t) => s + Math.max(0, t.grossPnlUsd), 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + Math.min(0, t.grossPnlUsd), 0));
    const profitFactor = grossLosses > 0
      ? Math.round((grossWins / grossLosses) * 100) / 100
      : grossWins > 0 ? 999 : 0;

    const netPnlUsd = Math.round(trades.reduce((s, t) => s + t.netPnlUsd, 0) * 100) / 100;
    const averageDurationBars = Math.round((trades.reduce((s, t) => s + t.durationBars, 0) / total) * 10) / 10;

    return {
      signals: total,
      wins: wins.length,
      losses: losses.length,
      timeouts: timeouts.length,
      winRate,
      averageR,
      medianR,
      expectancyR,
      profitFactor,
      netPnlUsd,
      averageDurationBars,
    };
  }

  private static createInsufficientDataSummary(config: Required<ReplayConfig>, candleCount: number): ReplaySummary {
    return {
      config,
      status: 'INSUFFICIENT_DATA',
      totalCandles: candleCount,
      totalSignalsGenerated: 0,
      totalTradesExecuted: 0,
      longTrades: 0,
      shortTrades: 0,
      wins: 0,
      losses: 0,
      timeouts: 0,
      winRate: 0,
      grossPnlUsd: 0,
      totalFeesUsd: 0,
      totalSlippageUsd: 0,
      netPnlUsd: 0,
      finalBalance: config.initialBalance,
      averageR: 0,
      medianR: 0,
      expectancyR: 0,
      profitFactor: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      averageMfePercent: 0,
      averageMaePercent: 0,
      averageDurationBars: 0,
      averageDurationHours: 0,
      equityCurve: [{
        time: config.startDate,
        equity: config.initialBalance,
        drawdown: 0,
        drawdownPercent: 0,
        tradeIndex: 0,
      }],
      trades: [],
      breakdownByRegime: {},
      breakdownByConfidence: {},
      breakdownByRiskReward: {},
      breakdownByDirection: {
        long: 'INSUFFICIENT_SAMPLE',
        short: 'INSUFFICIENT_SAMPLE',
      },
      collisionRuleUsed: config.collisionRule,
      limitations: ['Недостаточно исторических данных для проведения достоверного бэктеста (требуется >= 35 свечей).'],
    };
  }
}
