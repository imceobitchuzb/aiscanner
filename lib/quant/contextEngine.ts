import { AssetCategory } from '../market/types';

export interface MacroBar {
  time: number; // Unix timestamp in seconds
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface MacroContextSeries {
  btc?: MacroBar[];
  dxy?: MacroBar[];
  us10y?: MacroBar[];
  sp500?: MacroBar[];
  vix?: MacroBar[];
}

export interface AssetContextState {
  timestamp: number;
  asset: string;
  btcRegime: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  dxyTrend: 'STRENGTHENING' | 'WEAKENING' | 'SIDEWAYS';
  us10yDirection: 'RISING' | 'FALLING' | 'FLAT';
  sp500Regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  vixLevel: number;
  vixCategory: 'NORMAL' | 'ELEVATED' | 'EXTREME';
  macroAlignmentScore: number; // -100 (Extremely Bearish / Risk-off) to +100 (Extremely Bullish / Risk-on)
  isFavorableForLong: boolean;
  isFavorableForShort: boolean;
  warnings: string[];
}

export class ContextEngine {
  /**
   * Deterministically finds the latest bar strictly at or before the given target timestamp.
   * Ensures STRICT ZERO FUTURE DATA LEAKAGE.
   */
  public static getLatestPointAtOrBefore(series?: MacroBar[], targetTimestamp = 0): { current: MacroBar; previous: MacroBar | null } | null {
    if (!series || series.length === 0) return null;

    let low = 0;
    let high = series.length - 1;
    let bestIdx = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (series[mid].time <= targetTimestamp) {
        bestIdx = mid;
        low = mid + 1; // look for closer timestamps <= targetTimestamp
      } else {
        high = mid - 1;
      }
    }

    if (bestIdx < 0) return null;

    return {
      current: series[bestIdx],
      previous: bestIdx > 0 ? series[bestIdx - 1] : null,
    };
  }

  /**
   * Evaluates macro context strictly as of targetTimestamp for an asset.
   */
  public static evaluateContextAt(
    targetTimestamp: number,
    asset: string,
    assetClass: AssetCategory,
    contextData: MacroContextSeries
  ): AssetContextState {
    const warnings: string[] = [];

    // 1. BTC Context (Strict alignment)
    const btcPoint = this.getLatestPointAtOrBefore(contextData.btc, targetTimestamp);
    let btcRegime: AssetContextState['btcRegime'] = 'NEUTRAL';
    if (btcPoint && btcPoint.previous) {
      const btcChangePct = ((btcPoint.current.close - btcPoint.previous.close) / btcPoint.previous.close) * 100;
      if (btcChangePct > 0.3) btcRegime = 'BULLISH';
      else if (btcChangePct < -0.3) btcRegime = 'BEARISH';
    }

    // 2. DXY (US Dollar Index) Context
    const dxyPoint = this.getLatestPointAtOrBefore(contextData.dxy, targetTimestamp);
    let dxyTrend: AssetContextState['dxyTrend'] = 'SIDEWAYS';
    if (dxyPoint && dxyPoint.previous) {
      const dxyChangePct = ((dxyPoint.current.close - dxyPoint.previous.close) / dxyPoint.previous.close) * 100;
      if (dxyChangePct > 0.08) dxyTrend = 'STRENGTHENING';
      else if (dxyChangePct < -0.08) dxyTrend = 'WEAKENING';
    }

    // 3. US10Y (US 10-Year Treasury Yield)
    const us10yPoint = this.getLatestPointAtOrBefore(contextData.us10y, targetTimestamp);
    let us10yDirection: AssetContextState['us10yDirection'] = 'FLAT';
    if (us10yPoint && us10yPoint.previous) {
      const yieldDiff = us10yPoint.current.close - us10yPoint.previous.close;
      if (yieldDiff > 0.01) us10yDirection = 'RISING';
      else if (yieldDiff < -0.01) us10yDirection = 'FALLING';
    }

    // 4. S&P 500 Index
    const spPoint = this.getLatestPointAtOrBefore(contextData.sp500, targetTimestamp);
    let sp500Regime: AssetContextState['sp500Regime'] = 'NEUTRAL';
    if (spPoint && spPoint.previous) {
      const spChangePct = ((spPoint.current.close - spPoint.previous.close) / spPoint.previous.close) * 100;
      if (spChangePct > 0.2) sp500Regime = 'RISK_ON';
      else if (spChangePct < -0.2) sp500Regime = 'RISK_OFF';
    }

    // 5. VIX Volatility Index
    const vixPoint = this.getLatestPointAtOrBefore(contextData.vix, targetTimestamp);
    const vixLevel = vixPoint ? vixPoint.current.close : 18;
    let vixCategory: AssetContextState['vixCategory'] = 'NORMAL';
    if (vixLevel >= 30) {
      vixCategory = 'EXTREME';
      warnings.push(`VIX на экстремальном уровне (${vixLevel.toFixed(1)}): высокая вероятность панических распродаж.`);
    } else if (vixLevel >= 20) {
      vixCategory = 'ELEVATED';
      warnings.push(`Повышенная рыночная турбулентность (VIX ${vixLevel.toFixed(1)}).`);
    }

    // Compute Macro Alignment Score for the target asset
    let macroAlignmentScore = 0;

    if (assetClass === 'CRYPTO') {
      if (btcRegime === 'BULLISH') macroAlignmentScore += 45;
      else if (btcRegime === 'BEARISH') macroAlignmentScore -= 45;

      if (sp500Regime === 'RISK_ON') macroAlignmentScore += 30;
      else if (sp500Regime === 'RISK_OFF') macroAlignmentScore -= 30;

      if (vixCategory === 'EXTREME') macroAlignmentScore -= 25;
    } else if (assetClass === 'METALS') {
      // Gold inverse to DXY and Real Yields
      if (dxyTrend === 'WEAKENING') macroAlignmentScore += 45;
      else if (dxyTrend === 'STRENGTHENING') {
        macroAlignmentScore -= 45;
        warnings.push('Укрепление доллара США (DXY) создаёт встречный ветер для котировок золота.');
      }

      if (us10yDirection === 'FALLING') macroAlignmentScore += 30;
      else if (us10yDirection === 'RISING') macroAlignmentScore -= 30;

      if (vixCategory === 'EXTREME') {
        // Gold acts as safe haven during equity panic
        macroAlignmentScore += 25;
      }
    } else if (assetClass === 'FOREX') {
      if (dxyTrend === 'WEAKENING') macroAlignmentScore += 40;
      else if (dxyTrend === 'STRENGTHENING') macroAlignmentScore -= 40;

      if (sp500Regime === 'RISK_ON') macroAlignmentScore += 20;
    } else {
      // Equities
      if (sp500Regime === 'RISK_ON') macroAlignmentScore += 50;
      else if (sp500Regime === 'RISK_OFF') macroAlignmentScore -= 50;

      if (vixCategory === 'EXTREME') macroAlignmentScore -= 40;
    }

    macroAlignmentScore = Math.max(-100, Math.min(100, macroAlignmentScore));

    const isFavorableForLong = macroAlignmentScore >= 20 && vixCategory !== 'EXTREME';
    const isFavorableForShort = macroAlignmentScore <= -20;

    return {
      timestamp: targetTimestamp,
      asset,
      btcRegime,
      dxyTrend,
      us10yDirection,
      sp500Regime,
      vixLevel,
      vixCategory,
      macroAlignmentScore,
      isFavorableForLong,
      isFavorableForShort,
      warnings,
    };
  }
}
