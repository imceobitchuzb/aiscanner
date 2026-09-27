import { MarketRegimeType } from '../types';
import { ConflictSeverity } from './signalConflictEngine';

export interface PositionSizingConfig {
  accountBalance: number;
  baseRiskPercent: number; // e.g. 1.0%
  maxRiskPercent?: number;  // hard ceiling, e.g. 2.0%
}

export interface PositionSizeResult {
  units: number;
  notionalUsd: number;
  riskUsd: number;
  actualRiskPercent: number;
  effectiveLeverage: number;
  qualityMultiplier: number;
  conflictMultiplier: number;
  regimeMultiplier: number;
  explanation: string;
}

export class PositionSizingEngine {
  /**
   * Deterministically sizes position based on structural risk, quality, conflict severity and volatility.
   * Enforces configurable hard ceilings to protect account equity.
   */
  public static calculateSize(
    entryPrice: number,
    stopLoss: number,
    setupQuality: number,
    conflictSeverity: ConflictSeverity,
    regime: MarketRegimeType,
    config: PositionSizingConfig
  ): PositionSizeResult {
    const balance = Math.max(100, config.accountBalance);
    const baseRiskPct = Math.max(0.1, config.baseRiskPercent || 1.0);
    const maxRiskPct = config.maxRiskPercent || 2.0;

    // 1. Quality Multiplier (0.7x to 1.0x)
    let qualityMultiplier = 0.70;
    if (setupQuality >= 80) qualityMultiplier = 1.0;
    else if (setupQuality >= 70) qualityMultiplier = 0.85;
    else if (setupQuality >= 60) qualityMultiplier = 0.75;

    // 2. Conflict Severity Multiplier
    let conflictMultiplier = 1.0;
    if (conflictSeverity === 'HIGH') conflictMultiplier = 0.50;
    else if (conflictSeverity === 'MEDIUM') conflictMultiplier = 0.75;
    else if (conflictSeverity === 'LOW') conflictMultiplier = 0.90;

    // 3. Regime Multiplier (defensive in high volatility or uncertainty)
    let regimeMultiplier = 1.0;
    if (regime === 'HIGH_VOLATILITY') regimeMultiplier = 0.60;
    else if (regime === 'UNCERTAIN') regimeMultiplier = 0.70;
    else if (regime === 'RANGE') regimeMultiplier = 0.85;

    // Effective risk percentage capped at maxRiskPct
    const combinedMultiplier = qualityMultiplier * conflictMultiplier * regimeMultiplier;
    const actualRiskPercent = Math.min(maxRiskPct, Math.max(0.1, baseRiskPct * combinedMultiplier));
    const riskUsd = Math.round(balance * (actualRiskPercent / 100) * 100) / 100;

    // Risk per unit (distance to stop loss)
    const riskPerUnit = Math.max(0.00001, Math.abs(entryPrice - stopLoss));
    const rawUnits = riskUsd / riskPerUnit;
    const units = Math.round(rawUnits * 10000) / 10000;
    const notionalUsd = Math.round(units * entryPrice * 100) / 100;
    const effectiveLeverage = Math.round((notionalUsd / balance) * 100) / 100;

    const explanation = `Базовый риск: ${baseRiskPct.toFixed(1)}%. Модификаторы: Качество (${qualityMultiplier}x) × Конфликты (${conflictMultiplier}x) × Режим (${regimeMultiplier}x) = Итоговый риск ${actualRiskPercent.toFixed(2)}% ($${riskUsd}). Плечо: ${effectiveLeverage}x.`;

    return {
      units,
      notionalUsd,
      riskUsd,
      actualRiskPercent,
      effectiveLeverage,
      qualityMultiplier,
      conflictMultiplier,
      regimeMultiplier,
      explanation,
    };
  }
}
