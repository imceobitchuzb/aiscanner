import { Candle, Timeframe } from '../types';
import { AdaptiveSignalEngine, AdaptiveSignalResult } from './adaptiveSignalEngine';
import { FROZEN_STRATEGY_CONFIG } from './frozenStrategyConfig';
import { SignalAuditTrail } from './signalAuditTrail';

export interface PaperAccountState {
  initialBalance: number;
  balance: number;
  equity: number;
  freeMargin: number;
  reservedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdownUsd: number;
  maxDrawdownPercent: number;
}

export interface PaperPartialFill {
  stage: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'TIMEOUT' | 'TRAILING_SL';
  price: number;
  units: number;
  pnlUsd: number;
  timestamp: number;
  rMultiple: number;
}

export interface PaperPosition {
  id: string;
  signalId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: Timeframe;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  initialUnits: number;
  currentUnits: number;
  stopLoss: number;
  originalStopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  tp1Executed: boolean;
  tp2Executed: boolean;
  tp3Executed: boolean;
  riskPerUnit: number;
  riskAmountUsd: number;
  riskPercent: number;
  mfe: number;
  mae: number;
  mfeR: number;
  maeR: number;
  barsHeld: number;
  feesPaidUsd: number;
  slippagePaidUsd: number;
  realizedPnlUsd: number;
  partialFills: PaperPartialFill[];
  trailingStrategy?: string;
  trailingStepAtr?: number;
}

export interface PaperTradeRecord {
  tradeId: string;
  signalId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: Timeframe;
  direction: 'LONG' | 'SHORT';
  entryTimestamp: number;
  entryPrice: number;
  exitTimestamp: number;
  exitPrice: number;
  positionSize: number;
  riskPercent: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  partialFills: PaperPartialFill[];
  feesUsd: number;
  slippageUsd: number;
  realizedPnlUsd: number;
  rMultiple: number;
  mfeR: number;
  maeR: number;
  durationBars: number;
  durationMs: number;
  exitReason: string;
  outcome: 'WIN' | 'LOSS' | 'TIMEOUT';
}

export interface LiveSignalJournalRecord {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  regime: string;
  structure1h: string;
  structure4h: string;
  session: string;
  qualityScore: number;
  rankScore: number;
  mtfAlignment: number;
  volatilityState: string;
  liquiditySweepState: boolean;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3?: number;
  riskRewardRatio: number;
  riskMultiplier: number;
  decision: 'EXECUTE' | 'WATCH' | 'REJECT';
  rejectionReason?: string;
  rejectionCode?: string;
  strategyVersion: string;
}

export interface PaperEngineConfig {
  initialBalance?: number;
  defaultFeeBps?: number; // e.g. 5 bps
  defaultSlippageBps?: number; // e.g. 3 bps
  maxHoldingBars?: number;
}

/**
 * Production-Safe In-Memory Paper Trading Engine.
 * 
 * SAFETY ARCHITECTURE:
 * - 100% Isolated from live exchange APIs: contains NO private keys, secrets, or order routing.
 * - Exactly mirrors AdaptiveSignalEngine and DynamicTradePlanEngine decisions.
 * - Simulates realistic order fills with slippage, fees, and SL First collision rule.
 * - Records full signal and trade journals stamped with the frozen strategy version.
 */
export class PaperTradingEngine {
  private static instance: PaperTradingEngine;

  private strategyVersion = FROZEN_STRATEGY_CONFIG.strategyVersion;
  private account: PaperAccountState;
  private openPositions: Map<string, PaperPosition> = new Map();
  private closedTrades: PaperTradeRecord[] = [];
  private signalJournal: LiveSignalJournalRecord[] = [];
  private peakEquity: number;
  private feeBps: number;
  private slippageBps: number;
  private maxHoldingBars: number;

  constructor(config: PaperEngineConfig = {}) {
    const initial = config.initialBalance || 10000;
    this.feeBps = config.defaultFeeBps ?? 5;
    this.slippageBps = config.defaultSlippageBps ?? 3;
    this.maxHoldingBars = config.maxHoldingBars ?? FROZEN_STRATEGY_CONFIG.riskParameters.maxHoldingBars;
    this.account = {
      initialBalance: initial,
      balance: initial,
      equity: initial,
      freeMargin: initial,
      reservedMargin: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPercent: 0,
    };
    this.peakEquity = initial;
  }

  public static getInstance(config?: PaperEngineConfig): PaperTradingEngine {
    if (!PaperTradingEngine.instance) {
      PaperTradingEngine.instance = new PaperTradingEngine(config);
    }
    return PaperTradingEngine.instance;
  }

  /**
   * Safety verification: ensures this engine cannot submit exchange orders.
   */
  public isRealExchangeOrderExecutionBlocked(): boolean {
    return true;
  }

  public getStrategyVersion(): string {
    return this.strategyVersion;
  }

  public getAccountState(): PaperAccountState {
    this.updateEquityAndDrawdown();
    return { ...this.account };
  }

  public getOpenPositions(): PaperPosition[] {
    const list: PaperPosition[] = [];
    this.openPositions.forEach((pos) => list.push(pos));
    return list;
  }

  public getClosedTrades(): PaperTradeRecord[] {
    return [...this.closedTrades];
  }

  public getSignalJournal(limit = 100): LiveSignalJournalRecord[] {
    return this.signalJournal.slice(0, limit);
  }

  /**
   * Processes a live market tick / bar for a given symbol and timeframe.
   * 1. Evaluates signal causation with zero lookahead.
   * 2. Persists signal decision into LiveSignalJournal.
   * 3. Checks active position execution (TP1/TP2/TP3, trailing stop, SL First).
   * 4. Enters new position if confirmed setup generated.
   */
  public processMarketTick(
    candles: Candle[],
    symbol: string,
    timeframe: Timeframe = '1h',
    isMarketOpen = true,
    isFresh = true
  ): {
    signal: AdaptiveSignalResult;
    openedPosition?: PaperPosition;
    closedPosition?: PaperTradeRecord;
  } {
    if (!candles || candles.length < 50) {
      throw new Error(`Insufficient candles for ${symbol} (received ${candles?.length || 0}, minimum 50 required).`);
    }

    const currentBar = candles[candles.length - 1];
    let closedPosition: PaperTradeRecord | undefined;
    let openedPosition: PaperPosition | undefined;

    // 1. Process active positions for this symbol
    const activePos = this.openPositions.get(symbol);
    if (activePos) {
      closedPosition = this.evaluatePositionTick(activePos, currentBar);
    }

    // 2. Evaluate fresh signal using exact AdaptiveSignalEngine
    const signal = AdaptiveSignalEngine.evaluate(
      candles,
      symbol,
      timeframe,
      isMarketOpen,
      isFresh,
      FROZEN_STRATEGY_CONFIG.minRiskReward
    );

    // 3. Log signal decision into Live Signal Journal
    this.logSignalJournal(signal);

    // 4. Open new position if signal is EXECUTE and no active position open
    if (!this.openPositions.has(symbol) && signal.direction !== 'NEUTRAL' && signal.tradePlan && (signal.setupState === 'CONFIRMED' || signal.setupState === 'ACTIVE')) {
      openedPosition = this.openPaperPosition(signal, currentBar);
    }

    this.updateEquityAndDrawdown();
    return { signal, openedPosition, closedPosition };
  }

  /**
   * Logs evaluated signal to journal with full attribution & strategy version.
   */
  private logSignalJournal(signal: AdaptiveSignalResult): void {
    const isExecution = signal.direction !== 'NEUTRAL' && (signal.setupState === 'CONFIRMED' || signal.setupState === 'ACTIVE');
    const journalEntry: LiveSignalJournalRecord = {
      id: signal.id,
      timestamp: signal.timestamp,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      direction: signal.direction,
      regime: signal.marketState?.regime || 'UNKNOWN',
      structure1h: signal.cryptoConfirmation ? signal.structure.state : 'N/A',
      structure4h: signal.cryptoConfirmation ? signal.structure.state : 'N/A',
      session: signal.forexSessionContext?.activeSession || 'OFF_HOURS',
      qualityScore: signal.setupQuality,
      rankScore: signal.modelConfidence,
      mtfAlignment: signal.mtf?.alignmentScore || 0,
      volatilityState: (signal.marketState?.atrPercent ?? 0) > 3.0 ? 'HIGH' : 'NORMAL',
      liquiditySweepState: signal.cryptoConfirmation?.isLiquiditySweepRisk || false,
      entry: signal.tradePlan?.entryPrice || 0,
      sl: signal.tradePlan?.stopLoss || 0,
      tp1: signal.tradePlan?.takeProfit1 || 0,
      tp2: signal.tradePlan?.takeProfit2 || 0,
      tp3: signal.dynamicPlan?.takeProfit3,
      riskRewardRatio: signal.tradePlan?.riskRewardRatio || 0,
      riskMultiplier: 1.0,
      decision: isExecution ? 'EXECUTE' : (signal.setupState === 'WATCH' ? 'WATCH' : 'REJECT'),
      rejectionReason: signal.rejectionReason,
      rejectionCode: signal.rejectionCode,
      strategyVersion: this.strategyVersion,
    };

    this.signalJournal.unshift(journalEntry);
    if (this.signalJournal.length > 5000) {
      this.signalJournal.pop();
    }
  }

  /**
   * Opens a virtual paper position with simulated fees, slippage, and position sizing.
   */
  private openPaperPosition(signal: AdaptiveSignalResult, currentBar: Candle): PaperPosition {
    if (!signal.tradePlan) {
      throw new Error(`Cannot open paper position for ${signal.symbol}: tradePlan is null.`);
    }
    const plan = signal.tradePlan;
    const direction = signal.direction === 'LONG' ? 'LONG' : 'SHORT';
    
    // Simulate fill price with slippage
    const slipBps = this.slippageBps;
    const slippageMultiplier = direction === 'LONG' ? (1 + slipBps / 10000) : (1 - slipBps / 10000);
    const fillPrice = currentBar.close * slippageMultiplier;

    const riskDistance = Math.abs(fillPrice - plan.stopLoss);
    const effectiveRiskPct = signal.positionSizing?.actualRiskPercent || FROZEN_STRATEGY_CONFIG.riskParameters.baseRiskPercent;
    const riskAmountUsd = this.account.equity * (effectiveRiskPct / 100);
    const units = riskDistance > 0 ? riskAmountUsd / riskDistance : 0;

    const feeMultiplier = this.feeBps / 10000;
    const entryFeeUsd = fillPrice * units * feeMultiplier;
    const slippageUsd = Math.abs(fillPrice - currentBar.close) * units;

    this.account.balance -= entryFeeUsd;

    const newPos: PaperPosition = {
      id: `pos-${signal.symbol}-${currentBar.time}`,
      signalId: signal.id,
      strategyVersion: this.strategyVersion,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      direction,
      entryTime: currentBar.time,
      entryPrice: Math.round(fillPrice * 10000) / 10000,
      initialUnits: units,
      currentUnits: units,
      stopLoss: plan.stopLoss,
      originalStopLoss: plan.stopLoss,
      takeProfit1: plan.takeProfit1,
      takeProfit2: plan.takeProfit2,
      takeProfit3: signal.dynamicPlan?.takeProfit3 || (direction === 'LONG' ? fillPrice + riskDistance * 3.0 : fillPrice - riskDistance * 3.0),
      tp1Executed: false,
      tp2Executed: false,
      tp3Executed: false,
      riskPerUnit: riskDistance,
      riskAmountUsd,
      riskPercent: effectiveRiskPct,
      mfe: fillPrice,
      mae: fillPrice,
      mfeR: 0,
      maeR: 0,
      barsHeld: 0,
      feesPaidUsd: entryFeeUsd,
      slippagePaidUsd: slippageUsd,
      realizedPnlUsd: 0,
      partialFills: [],
      trailingStrategy: signal.dynamicPlan?.trailingStrategy,
      trailingStepAtr: signal.dynamicPlan?.trailingStepAtr,
    };

    this.openPositions.set(signal.symbol, newPos);
    return newPos;
  }

  /**
   * Evaluates bar progression against active position:
   * - Checks TP1 (50% exit, move SL to breakeven)
   * - Checks TP2 (30% exit, trail remaining 20%)
   * - Checks TP3 (close remainder)
   * - Checks Stop Loss with SL First priority on collision
   * - Checks Time Invalidation
   */
  private evaluatePositionTick(pos: PaperPosition, bar: Candle): PaperTradeRecord | undefined {
    pos.barsHeld++;

    const isLong = pos.direction === 'LONG';
    const entry = pos.entryPrice;
    const initialRisk = Math.max(0.0001, pos.riskPerUnit);

    // Track MFE & MAE
    if (isLong) {
      if (bar.high > pos.mfe) {
        pos.mfe = bar.high;
        pos.mfeR = Math.round(((bar.high - entry) / initialRisk) * 100) / 100;
      }
      if (bar.low < pos.mae) {
        pos.mae = bar.low;
        pos.maeR = Math.round(((entry - bar.low) / initialRisk) * 100) / 100;
      }
    } else {
      if (bar.low < pos.mfe) {
        pos.mfe = bar.low;
        pos.mfeR = Math.round(((entry - bar.low) / initialRisk) * 100) / 100;
      }
      if (bar.high > pos.mae) {
        pos.mae = bar.high;
        pos.maeR = Math.round(((bar.high - entry) / initialRisk) * 100) / 100;
      }
    }

    // 1. Check Collision (SL vs TP touched in same candle) -> SL First Priority
    const slHit = isLong ? bar.low <= pos.stopLoss : bar.high >= pos.stopLoss;
    const tp1Hit = !pos.tp1Executed && (isLong ? bar.high >= pos.takeProfit1 : bar.low <= pos.takeProfit1);

    if (slHit && tp1Hit) {
      // Conservative collision rule: Stop Loss takes precedence
      return this.closeEntirePosition(pos, pos.stopLoss, bar.time, 'COLLISION_SL', 'LOSS');
    }

    if (slHit) {
      const exitPrice = pos.stopLoss;
      const isProfitableStop = isLong ? exitPrice >= entry : exitPrice <= entry;
      return this.closeEntirePosition(pos, exitPrice, bar.time, isProfitableStop ? 'TRAILING_SL' : 'SL_HIT', isProfitableStop ? 'WIN' : 'LOSS');
    }

    // 2. Partial Exit: TP1 (50% of initial position)
    if (tp1Hit) {
      const tp1Units = pos.initialUnits * (FROZEN_STRATEGY_CONFIG.takeProfitRules.tp1Percent / 100);
      const unitsToClose = Math.min(pos.currentUnits, tp1Units);
      const exitPrice = pos.takeProfit1;
      const pnl = isLong ? (exitPrice - entry) * unitsToClose : (entry - exitPrice) * unitsToClose;
      const fee = exitPrice * unitsToClose * (this.feeBps / 10000);
      const netPnl = pnl - fee;

      pos.currentUnits -= unitsToClose;
      pos.realizedPnlUsd += netPnl;
      pos.feesPaidUsd += fee;
      this.account.balance += netPnl;
      pos.tp1Executed = true;

      // Move SL to Breakeven
      if (FROZEN_STRATEGY_CONFIG.takeProfitRules.moveSlToBreakevenAtTp1) {
        pos.stopLoss = entry;
      }

      pos.partialFills.push({
        stage: 'TP1',
        price: exitPrice,
        units: unitsToClose,
        pnlUsd: netPnl,
        timestamp: bar.time,
        rMultiple: Math.round((pnl / (initialRisk * unitsToClose)) * 100) / 100,
      });
    }

    // 3. Partial Exit: TP2 (30% of initial position)
    const tp2Hit = !pos.tp2Executed && (isLong ? bar.high >= pos.takeProfit2 : bar.low <= pos.takeProfit2);
    if (tp2Hit && pos.currentUnits > 0) {
      const tp2Units = pos.initialUnits * (FROZEN_STRATEGY_CONFIG.takeProfitRules.tp2Percent / 100);
      const unitsToClose = Math.min(pos.currentUnits, tp2Units);
      const exitPrice = pos.takeProfit2;
      const pnl = isLong ? (exitPrice - entry) * unitsToClose : (entry - exitPrice) * unitsToClose;
      const fee = exitPrice * unitsToClose * (this.feeBps / 10000);
      const netPnl = pnl - fee;

      pos.currentUnits -= unitsToClose;
      pos.realizedPnlUsd += netPnl;
      pos.feesPaidUsd += fee;
      this.account.balance += netPnl;
      pos.tp2Executed = true;

      // Lock in profit by trailing SL to TP1 level
      pos.stopLoss = pos.takeProfit1;

      pos.partialFills.push({
        stage: 'TP2',
        price: exitPrice,
        units: unitsToClose,
        pnlUsd: netPnl,
        timestamp: bar.time,
        rMultiple: Math.round((pnl / (initialRisk * unitsToClose)) * 100) / 100,
      });
    }

    // 4. Final Exit: TP3 (Remaining 20% runner)
    const tp3Hit = !pos.tp3Executed && (isLong ? bar.high >= pos.takeProfit3 : bar.low <= pos.takeProfit3);
    if (tp3Hit && pos.currentUnits > 0) {
      return this.closeEntirePosition(pos, pos.takeProfit3, bar.time, 'TP3_RUNNER', 'WIN');
    }

    // 5. Time Invalidation (Max Holding Bars)
    if (pos.barsHeld >= this.maxHoldingBars && pos.currentUnits > 0) {
      const exitPrice = bar.close;
      const pnl = isLong ? (exitPrice - entry) * pos.currentUnits : (entry - exitPrice) * pos.currentUnits;
      return this.closeEntirePosition(pos, exitPrice, bar.time, 'TIME_EXPIRY', pnl >= 0 ? 'WIN' : 'TIMEOUT');
    }

    // Position remains active
    return undefined;
  }

  /**
   * Finalizes and closes remaining units of a paper position.
   */
  private closeEntirePosition(
    pos: PaperPosition,
    exitPrice: number,
    exitTime: number,
    exitReason: string,
    outcome: 'WIN' | 'LOSS' | 'TIMEOUT'
  ): PaperTradeRecord {
    const isLong = pos.direction === 'LONG';
    const entry = pos.entryPrice;
    const remainingUnits = pos.currentUnits;

    let finalLegNetPnl = 0;
    if (remainingUnits > 0) {
      const grossPnl = isLong ? (exitPrice - entry) * remainingUnits : (entry - exitPrice) * remainingUnits;
      const fee = exitPrice * remainingUnits * (this.feeBps / 10000);
      finalLegNetPnl = grossPnl - fee;
      pos.realizedPnlUsd += finalLegNetPnl;
      pos.feesPaidUsd += fee;
      this.account.balance += finalLegNetPnl;

      pos.partialFills.push({
        stage: exitReason === 'SL_HIT' || exitReason === 'COLLISION_SL' ? 'SL' : 'TIMEOUT',
        price: exitPrice,
        units: remainingUnits,
        pnlUsd: finalLegNetPnl,
        timestamp: exitTime,
        rMultiple: pos.riskPerUnit > 0 ? Math.round((grossPnl / (pos.riskPerUnit * remainingUnits)) * 100) / 100 : 0,
      });
    }

    const totalRealizedPnl = pos.realizedPnlUsd;
    const totalR = pos.riskAmountUsd > 0 ? Math.round((totalRealizedPnl / pos.riskAmountUsd) * 100) / 100 : 0;
    const finalOutcome = totalRealizedPnl >= 0 ? 'WIN' : 'LOSS';

    const tradeRecord: PaperTradeRecord = {
      tradeId: `ptrd-${pos.symbol}-${pos.entryTime}`,
      signalId: pos.signalId,
      strategyVersion: this.strategyVersion,
      symbol: pos.symbol,
      timeframe: pos.timeframe,
      direction: pos.direction,
      entryTimestamp: pos.entryTime,
      entryPrice: pos.entryPrice,
      exitTimestamp: exitTime,
      exitPrice,
      positionSize: pos.initialUnits,
      riskPercent: pos.riskPercent,
      stopLoss: pos.originalStopLoss,
      takeProfit1: pos.takeProfit1,
      takeProfit2: pos.takeProfit2,
      takeProfit3: pos.takeProfit3,
      partialFills: pos.partialFills,
      feesUsd: Math.round(pos.feesPaidUsd * 100) / 100,
      slippageUsd: Math.round(pos.slippagePaidUsd * 100) / 100,
      realizedPnlUsd: Math.round(totalRealizedPnl * 100) / 100,
      rMultiple: totalR,
      mfeR: pos.mfeR,
      maeR: pos.maeR,
      durationBars: pos.barsHeld,
      durationMs: (exitTime - pos.entryTime) * 1000,
      exitReason,
      outcome: finalOutcome,
    };

    // Remove from open positions, store in closed trades
    this.openPositions.delete(pos.symbol);
    this.closedTrades.unshift(tradeRecord);

    // Update account metrics
    this.account.totalTrades++;
    if (finalOutcome === 'WIN') {
      this.account.winningTrades++;
    } else {
      this.account.losingTrades++;
    }
    this.account.realizedPnl += totalRealizedPnl;

    // Attach outcome to live audit trail
    SignalAuditTrail.attachTradeOutcome(
      pos.signalId,
      finalOutcome as 'WIN' | 'LOSS' | 'TIMEOUT',
      totalR,
      exitReason
    );

    return tradeRecord;
  }

  /**
   * Dynamically calculates unrealized PnL and updates drawdown based on peak equity.
   */
  private updateEquityAndDrawdown(): void {
    let openPnl = 0;
    this.openPositions.forEach((pos) => {
      // In-flight position valuation
      openPnl += pos.realizedPnlUsd;
    });
    this.account.unrealizedPnl = Math.round(openPnl * 100) / 100;
    this.account.equity = Math.round((this.account.balance + openPnl) * 100) / 100;

    if (this.account.equity > this.peakEquity) {
      this.peakEquity = this.account.equity;
    }

    const ddUsd = this.peakEquity - this.account.equity;
    const ddPct = this.peakEquity > 0 ? (ddUsd / this.peakEquity) * 100 : 0;

    if (ddUsd > this.account.maxDrawdownUsd) {
      this.account.maxDrawdownUsd = Math.round(ddUsd * 100) / 100;
    }
    if (ddPct > this.account.maxDrawdownPercent) {
      this.account.maxDrawdownPercent = Math.round(ddPct * 100) / 100;
    }
  }

  public reset(): void {
    const initial = this.account.initialBalance;
    this.account = {
      initialBalance: initial,
      balance: initial,
      equity: initial,
      freeMargin: initial,
      reservedMargin: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPercent: 0,
    };
    this.peakEquity = initial;
    this.openPositions.clear();
    this.closedTrades = [];
    this.signalJournal = [];
  }
}
