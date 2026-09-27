import { Timeframe } from '../types';
import { PaperTradingEngine, PaperTradeRecord, LiveSignalJournalRecord } from './paperTradingEngine';
import { FROZEN_STRATEGY_CONFIG, FROZEN_STRATEGY_HASH, validateStrategyIntegrity } from './frozenStrategyConfig';

export interface DailyValidationStatistics {
  date: string; // YYYY-MM-DD
  signalsGenerated: number;
  signalsRejected: number;
  paperTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  expectancyR: number;
  profitFactor: number;
  netPnlUsd: number;
  maxDrawdownPercent: number;
  averageR: number;
  medianR: number;
  meanMfeR: number;
  meanMaeR: number;
  averageDurationBars: number;
  feesUsd: number;
  slippageUsd: number;
  rejectionBreakdown: Record<string, number>;
}

export interface WeeklyValidationReport {
  weekIndex: number;
  startDate: string;
  endDate: string;
  strategyVersion: 'phase6-frozen';
  parameterIntegrity: {
    isValid: boolean;
    activeHash: string;
    expectedHash: string;
    status: 'VERIFIED' | 'COMPROMISED';
  };
  performanceSummary: {
    totalTrades: number;
    winRate: number;
    expectancyR: number;
    profitFactor: number;
    netPnlUsd: number;
    maxDrawdownPercent: number;
    averageR: number;
  };
  rejectionReasons: Record<string, { count: number; percentage: number }>;
  regimeBreakdown: Record<string, { trades: number; wins: number; winRate: number; netPnlUsd: number }>;
  sessionBreakdown: Record<string, { trades: number; wins: number; winRate: number; netPnlUsd: number }>;
  governanceNote: string;
}

export interface ForwardValidationMatrix {
  primaryAssets: Array<{ symbol: string; timeframe: Timeframe }>;
  secondaryAssets: Array<{ symbol: string; timeframe: Timeframe }>;
  validationDurationDays: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE_FORWARD_TEST' | 'COMPLETED' | 'PAUSED';
}

/**
 * 60-Day Forward Validation Engine.
 * Accumulates empirical live/forward out-of-sample data without parameter mutation.
 */
export class ForwardValidationEngine {
  public static readonly VALIDATION_MATRIX: ForwardValidationMatrix = {
    primaryAssets: [
      { symbol: 'BTCUSDT', timeframe: '1h' },
      { symbol: 'XAUUSD', timeframe: '1h' },
    ],
    secondaryAssets: [
      { symbol: 'ETHUSDT', timeframe: '1h' },
      { symbol: 'BTCUSDT', timeframe: '15m' },
      { symbol: 'ETHUSDT', timeframe: '15m' },
      { symbol: 'EURUSD', timeframe: '15m' },
      { symbol: 'EURUSD', timeframe: '1h' },
      { symbol: 'GBPUSD', timeframe: '15m' },
      { symbol: 'GBPUSD', timeframe: '1h' },
    ],
    validationDurationDays: 60,
    startDate: '2026-09-28',
    endDate: '2026-11-27',
    status: 'ACTIVE_FORWARD_TEST',
  };

  /**
   * Aggregates daily trading statistics for a specific calendar date (UTC).
   */
  public static computeDailyStatistics(
    trades: PaperTradeRecord[],
    signals: LiveSignalJournalRecord[],
    targetDate: string
  ): DailyValidationStatistics {
    const dayTrades = trades.filter((t) => {
      const d = new Date(t.exitTimestamp * 1000).toISOString().slice(0, 10);
      return d === targetDate;
    });

    const daySignals = signals.filter((s) => {
      const d = new Date(s.timestamp).toISOString().slice(0, 10);
      return d === targetDate;
    });

    const signalsGenerated = daySignals.filter((s) => s.decision === 'EXECUTE').length;
    const signalsRejected = daySignals.filter((s) => s.decision === 'REJECT').length;

    const rejectionBreakdown: Record<string, number> = {};
    for (const s of daySignals) {
      if (s.decision === 'REJECT') {
        const code = s.rejectionCode || 'OTHER';
        rejectionBreakdown[code] = (rejectionBreakdown[code] || 0) + 1;
      }
    }

    const wins = dayTrades.filter((t) => t.outcome === 'WIN').length;
    const losses = dayTrades.filter((t) => t.outcome === 'LOSS').length;
    const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 1000) / 10 : 0;

    const netPnlUsd = Math.round(dayTrades.reduce((s, t) => s + t.realizedPnlUsd, 0) * 100) / 100;
    const feesUsd = Math.round(dayTrades.reduce((s, t) => s + t.feesUsd, 0) * 100) / 100;
    const slippageUsd = Math.round(dayTrades.reduce((s, t) => s + t.slippageUsd, 0) * 100) / 100;

    const grossWins = dayTrades.filter((t) => t.realizedPnlUsd > 0).reduce((s, t) => s + t.realizedPnlUsd, 0);
    const grossLosses = Math.abs(dayTrades.filter((t) => t.realizedPnlUsd < 0).reduce((s, t) => s + t.realizedPnlUsd, 0));
    const profitFactor = grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? 999 : 0;

    const totalR = dayTrades.reduce((s, t) => s + t.rMultiple, 0);
    const averageR = dayTrades.length > 0 ? Math.round((totalR / dayTrades.length) * 100) / 100 : 0;

    // Median R
    let medianR = 0;
    if (dayTrades.length > 0) {
      const sortedR = [...dayTrades.map((t) => t.rMultiple)].sort((a, b) => a - b);
      const mid = Math.floor(sortedR.length / 2);
      medianR = sortedR.length % 2 !== 0 ? sortedR[mid] : Math.round(((sortedR[mid - 1] + sortedR[mid]) / 2) * 100) / 100;
    }

    const meanMfeR = dayTrades.length > 0 ? Math.round((dayTrades.reduce((s, t) => s + t.mfeR, 0) / dayTrades.length) * 100) / 100 : 0;
    const meanMaeR = dayTrades.length > 0 ? Math.round((dayTrades.reduce((s, t) => s + t.maeR, 0) / dayTrades.length) * 100) / 100 : 0;
    const averageDurationBars = dayTrades.length > 0 ? Math.round(dayTrades.reduce((s, t) => s + t.durationBars, 0) / dayTrades.length) : 0;

    return {
      date: targetDate,
      signalsGenerated,
      signalsRejected,
      paperTrades: dayTrades.length,
      wins,
      losses,
      winRate,
      expectancyR: averageR,
      profitFactor,
      netPnlUsd,
      maxDrawdownPercent: 0,
      averageR,
      medianR,
      meanMfeR,
      meanMaeR,
      averageDurationBars,
      feesUsd,
      slippageUsd,
      rejectionBreakdown,
    };
  }

  /**
   * Generates a 7-day Weekly Validation Report with parameter integrity verification.
   */
  public static generateWeeklyReport(
    trades: PaperTradeRecord[],
    signals: LiveSignalJournalRecord[],
    weekIndex = 1
  ): WeeklyValidationReport {
    // 1. Verify frozen strategy integrity hash
    const integrity = validateStrategyIntegrity(FROZEN_STRATEGY_CONFIG);

    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.outcome === 'WIN').length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 1000) / 10 : 0;

    const grossWins = trades.filter((t) => t.realizedPnlUsd > 0).reduce((s, t) => s + t.realizedPnlUsd, 0);
    const grossLosses = Math.abs(trades.filter((t) => t.realizedPnlUsd < 0).reduce((s, t) => s + t.realizedPnlUsd, 0));
    const profitFactor = grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? 999 : 0;

    const totalR = trades.reduce((s, t) => s + t.rMultiple, 0);
    const averageR = totalTrades > 0 ? Math.round((totalR / totalTrades) * 100) / 100 : 0;
    const netPnlUsd = Math.round(trades.reduce((s, t) => s + t.realizedPnlUsd, 0) * 100) / 100;

    // 2. Rejection reasons breakdown
    const rejections = signals.filter((s) => s.decision === 'REJECT');
    const rejCounts: Record<string, number> = {};
    for (const r of rejections) {
      const code = r.rejectionCode || 'OTHER';
      rejCounts[code] = (rejCounts[code] || 0) + 1;
    }
    const totalRej = Math.max(1, rejections.length);
    const rejectionReasons: Record<string, { count: number; percentage: number }> = {};
    for (const [code, count] of Object.entries(rejCounts)) {
      rejectionReasons[code] = {
        count,
        percentage: Math.round((count / totalRej) * 1000) / 10,
      };
    }

    // 3. Performance by Regime
    const regimeBreakdown: Record<string, { trades: number; wins: number; winRate: number; netPnlUsd: number }> = {};
    for (const t of trades) {
      const sig = signals.find((s) => s.id === t.signalId);
      const reg = sig?.regime || 'UNKNOWN';
      if (!regimeBreakdown[reg]) {
        regimeBreakdown[reg] = { trades: 0, wins: 0, winRate: 0, netPnlUsd: 0 };
      }
      regimeBreakdown[reg].trades++;
      if (t.outcome === 'WIN') regimeBreakdown[reg].wins++;
      regimeBreakdown[reg].netPnlUsd += t.realizedPnlUsd;
    }
    for (const r in regimeBreakdown) {
      const item = regimeBreakdown[r];
      item.winRate = item.trades > 0 ? Math.round((item.wins / item.trades) * 1000) / 10 : 0;
      item.netPnlUsd = Math.round(item.netPnlUsd * 100) / 100;
    }

    // 4. Performance by Session
    const sessionBreakdown: Record<string, { trades: number; wins: number; winRate: number; netPnlUsd: number }> = {};
    for (const t of trades) {
      const sig = signals.find((s) => s.id === t.signalId);
      const sess = sig?.session || 'OFF_HOURS';
      if (!sessionBreakdown[sess]) {
        sessionBreakdown[sess] = { trades: 0, wins: 0, winRate: 0, netPnlUsd: 0 };
      }
      sessionBreakdown[sess].trades++;
      if (t.outcome === 'WIN') sessionBreakdown[sess].wins++;
      sessionBreakdown[sess].netPnlUsd += t.realizedPnlUsd;
    }
    for (const s in sessionBreakdown) {
      const item = sessionBreakdown[s];
      item.winRate = item.trades > 0 ? Math.round((item.wins / item.trades) * 1000) / 10 : 0;
      item.netPnlUsd = Math.round(item.netPnlUsd * 100) / 100;
    }

    return {
      weekIndex,
      startDate: new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      strategyVersion: 'phase6-frozen',
      parameterIntegrity: {
        isValid: integrity.isValid,
        activeHash: integrity.activeHash,
        expectedHash: integrity.expectedHash,
        status: integrity.isValid ? 'VERIFIED' : 'COMPROMISED',
      },
      performanceSummary: {
        totalTrades,
        winRate,
        expectancyR: averageR,
        profitFactor,
        netPnlUsd,
        maxDrawdownPercent: 0,
        averageR,
      },
      rejectionReasons,
      regimeBreakdown,
      sessionBreakdown,
      governanceNote: 'CRITICAL DIRECTIVE: Strategy parameters are locked. No automatic parameter tuning is permitted during the 60-day forward validation period.',
    };
  }
}
