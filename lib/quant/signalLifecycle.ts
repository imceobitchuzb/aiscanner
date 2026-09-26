import { Candle } from '../types';
import { UnifiedSignalResult } from './signalDecisionEngine';

export type SignalLifecycleState =
  | 'WATCHING'
  | 'FORMING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'TP1_HIT'
  | 'TP2_HIT'
  | 'SL_HIT'
  | 'INVALIDATED'
  | 'EXPIRED';

export interface SignalEvaluationOutcome {
  signalId: string;
  status: 'WIN' | 'LOSS' | 'TIMEOUT' | 'INVALIDATED' | 'IN_PROGRESS';
  finalLifecycleState: SignalLifecycleState;
  achievedRMultiple: number; // e.g. +1.6 or -1.0
  maxFavorableExcursionPct: number; // MFE %
  maxAdverseExcursionPct: number; // MAE %
  barsHeld: number;
  exitPrice: number;
  exitTime?: number;
  exitReason: string;
}

export interface SignalChangeLog {
  signalId: string;
  timestamp: number;
  previousQuality: number;
  newQuality: number;
  previousConfidence: number;
  newConfidence: number;
  reasons: string[];
}

export class SignalLifecycleEngine {
  /**
   * Tracks and evaluates the outcome of a signal on forward/subsequent candles.
   */
  public static evaluateOutcome(
    signal: UnifiedSignalResult,
    forwardCandles: Candle[]
  ): SignalEvaluationOutcome {
    if (!signal.tradePlan || signal.direction === 'NEUTRAL' || !forwardCandles || forwardCandles.length === 0) {
      return {
        signalId: signal.id,
        status: 'INVALIDATED',
        finalLifecycleState: 'INVALIDATED',
        achievedRMultiple: 0,
        maxFavorableExcursionPct: 0,
        maxAdverseExcursionPct: 0,
        barsHeld: 0,
        exitPrice: 0,
        exitReason: 'No actionable trade plan or forward candles.',
      };
    }

    const plan = signal.tradePlan;
    const isLong = signal.direction === 'LONG';
    const entry = plan.entryPrice;
    const sl = plan.stopLoss;
    const tp1 = plan.takeProfit1;
    const tp2 = plan.takeProfit2;
    const slDist = plan.stopLossDistance;

    let mfe = 0;
    let mae = 0;
    let tp1Hit = false;

    for (let i = 0; i < forwardCandles.length; i++) {
      const c = forwardCandles[i];

      // Track MFE and MAE
      if (isLong) {
        const fav = ((c.high - entry) / entry) * 100;
        const adv = ((c.low - entry) / entry) * 100;
        if (fav > mfe) mfe = fav;
        if (adv < mae) mae = adv;

        // Check SL hit
        if (c.low <= sl) {
          const r = tp1Hit ? 0.5 : -1.0;
          return {
            signalId: signal.id,
            status: tp1Hit ? 'WIN' : 'LOSS',
            finalLifecycleState: 'SL_HIT',
            achievedRMultiple: r,
            maxFavorableExcursionPct: Math.round(mfe * 100) / 100,
            maxAdverseExcursionPct: Math.round(mae * 100) / 100,
            barsHeld: i + 1,
            exitPrice: sl,
            exitTime: c.time,
            exitReason: tp1Hit ? 'Выход по скользящему стопу после взятия TP1' : 'Сработал защитный стоп-лосс',
          };
        }

        // Check TP2 hit
        if (c.high >= tp2) {
          const r = slDist > 0 ? (tp2 - entry) / slDist : 2.5;
          return {
            signalId: signal.id,
            status: 'WIN',
            finalLifecycleState: 'TP2_HIT',
            achievedRMultiple: Math.round(r * 10) / 10,
            maxFavorableExcursionPct: Math.round(mfe * 100) / 100,
            maxAdverseExcursionPct: Math.round(mae * 100) / 100,
            barsHeld: i + 1,
            exitPrice: tp2,
            exitTime: c.time,
            exitReason: 'Полное исполнение таргета Take Profit 2',
          };
        }

        // Check TP1 hit
        if (c.high >= tp1 && !tp1Hit) {
          tp1Hit = true;
        }
      } else {
        // Short Position logic
        const fav = ((entry - c.low) / entry) * 100;
        const adv = ((entry - c.high) / entry) * 100;
        if (fav > mfe) mfe = fav;
        if (adv < mae) mae = adv;

        // Check SL hit
        if (c.high >= sl) {
          const r = tp1Hit ? 0.5 : -1.0;
          return {
            signalId: signal.id,
            status: tp1Hit ? 'WIN' : 'LOSS',
            finalLifecycleState: 'SL_HIT',
            achievedRMultiple: r,
            maxFavorableExcursionPct: Math.round(mfe * 100) / 100,
            maxAdverseExcursionPct: Math.round(mae * 100) / 100,
            barsHeld: i + 1,
            exitPrice: sl,
            exitTime: c.time,
            exitReason: tp1Hit ? 'Выход по безубытку после взятия TP1' : 'Сработал защитный стоп-лосс',
          };
        }

        // Check TP2 hit
        if (c.low <= tp2) {
          const r = slDist > 0 ? (entry - tp2) / slDist : 2.5;
          return {
            signalId: signal.id,
            status: 'WIN',
            finalLifecycleState: 'TP2_HIT',
            achievedRMultiple: Math.round(r * 10) / 10,
            maxFavorableExcursionPct: Math.round(mfe * 100) / 100,
            maxAdverseExcursionPct: Math.round(mae * 100) / 100,
            barsHeld: i + 1,
            exitPrice: tp2,
            exitTime: c.time,
            exitReason: 'Полное исполнение таргета Take Profit 2',
          };
        }

        // Check TP1 hit
        if (c.low <= tp1 && !tp1Hit) {
          tp1Hit = true;
        }
      }
    }

    // Still in progress
    return {
      signalId: signal.id,
      status: 'IN_PROGRESS',
      finalLifecycleState: tp1Hit ? 'TP1_HIT' : 'ACTIVE',
      achievedRMultiple: tp1Hit ? 1.0 : 0,
      maxFavorableExcursionPct: Math.round(mfe * 100) / 100,
      maxAdverseExcursionPct: Math.round(mae * 100) / 100,
      barsHeld: forwardCandles.length,
      exitPrice: forwardCandles[forwardCandles.length - 1].close,
      exitReason: 'Позиция удерживается в рамках диапазона ожидания таргета.',
    };
  }

  /**
   * Explains shifts in signal quality and confidence between evaluations.
   */
  public static trackChange(
    prev: UnifiedSignalResult,
    curr: UnifiedSignalResult
  ): SignalChangeLog {
    const reasons: string[] = [];

    if (curr.setupQuality > prev.setupQuality) {
      reasons.push(`Качество сетапа выросло (+${curr.setupQuality - prev.setupQuality} п.): усиление тренда и объёма.`);
    } else if (curr.setupQuality < prev.setupQuality) {
      reasons.push(`Качество сетапа снизилось (-${prev.setupQuality - curr.setupQuality} п.): ослабление импульса или приближение к сопротивлению.`);
    }

    if (curr.modelConfidence > prev.modelConfidence) {
      reasons.push(`Уверенность модели увеличилась: улучшилась синхронизация ТФ (${curr.mtf.alignmentScore}%).`);
    } else if (curr.modelConfidence < prev.modelConfidence) {
      reasons.push(`Уверенность модели снизилась: появились разногласия между младшими и старшими ТФ.`);
    }

    if (prev.setupState !== curr.setupState) {
      reasons.push(`Статус сетапа изменился: ${prev.setupState} → ${curr.setupState}.`);
    }

    return {
      signalId: curr.id,
      timestamp: Date.now(),
      previousQuality: prev.setupQuality,
      newQuality: curr.setupQuality,
      previousConfidence: prev.modelConfidence,
      newConfidence: curr.modelConfidence,
      reasons,
    };
  }
}
