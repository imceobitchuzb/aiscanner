import { ReplayedTrade } from './historicalReplayEngine';

export interface MonteCarloPercentiles {
  p5: number;
  p25: number;
  p50: number; // Median
  p75: number;
  p95: number;
}

export interface MonteCarloSimulationResult {
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  totalSimulations: number;
  inputTradeCount: number;
  initialBalance: number;
  finalEquity: MonteCarloPercentiles;
  maxDrawdownPercent: MonteCarloPercentiles;
  probabilityOfNegativeReturn: number; // % of runs ending below initialBalance
  probabilityOfRuin: number; // % of runs touching > 50% drawdown
  ruinThresholdPercent: number;
  riskOfRuinVerdict: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'INSUFFICIENT_DATA';
}

export class MonteCarloEngine {
  /**
   * Resamples REAL historical trade returns via bootstrap sampling with replacement.
   * Completely avoids random Gaussian/arbitrary percentage generation.
   */
  public static simulate(
    trades: ReplayedTrade[],
    initialBalance = 10000,
    iterations = 10000,
    ruinThresholdPercent = 50
  ): MonteCarloSimulationResult {
    if (!trades || trades.length < 5) {
      return {
        status: 'INSUFFICIENT_DATA',
        totalSimulations: 0,
        inputTradeCount: trades?.length ?? 0,
        initialBalance,
        finalEquity: { p5: initialBalance, p25: initialBalance, p50: initialBalance, p75: initialBalance, p95: initialBalance },
        maxDrawdownPercent: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
        probabilityOfNegativeReturn: 0,
        probabilityOfRuin: 0,
        ruinThresholdPercent,
        riskOfRuinVerdict: 'INSUFFICIENT_DATA',
      };
    }

    const n = trades.length;
    // Extract real dollar PnL per trade
    const realPnLs = trades.map((t) => t.netPnlUsd);

    const finalEquities: number[] = new Array(iterations);
    const maxDrawdownsPct: number[] = new Array(iterations);

    let negativeReturnCount = 0;
    let ruinCount = 0;

    for (let sim = 0; sim < iterations; sim++) {
      let equity = initialBalance;
      let peak = initialBalance;
      let maxDd = 0;
      let hitRuin = false;

      for (let step = 0; step < n; step++) {
        // Uniform random sample with replacement from real trade returns
        const randIdx = Math.floor(Math.random() * n);
        const pnl = realPnLs[randIdx];

        equity += pnl;
        if (equity > peak) {
          peak = equity;
        }

        const ddPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        if (ddPct > maxDd) {
          maxDd = ddPct;
        }

        if (ddPct >= ruinThresholdPercent) {
          hitRuin = true;
        }
      }

      finalEquities[sim] = equity;
      maxDrawdownsPct[sim] = maxDd;

      if (equity < initialBalance) {
        negativeReturnCount++;
      }
      if (hitRuin) {
        ruinCount++;
      }
    }

    // Sort to extract true empirical percentiles
    finalEquities.sort((a, b) => a - b);
    maxDrawdownsPct.sort((a, b) => a - b);

    const getP = (arr: number[], pct: number) => {
      const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((pct / 100) * arr.length)));
      return Math.round(arr[idx] * 100) / 100;
    };

    const probNegReturn = Math.round((negativeReturnCount / iterations) * 10000) / 100;
    const probRuin = Math.round((ruinCount / iterations) * 10000) / 100;

    let riskOfRuinVerdict: MonteCarloSimulationResult['riskOfRuinVerdict'] = 'LOW';
    if (probRuin > 15) riskOfRuinVerdict = 'CRITICAL';
    else if (probRuin > 5) riskOfRuinVerdict = 'HIGH';
    else if (probRuin > 1) riskOfRuinVerdict = 'MODERATE';

    return {
      status: 'SUCCESS',
      totalSimulations: iterations,
      inputTradeCount: n,
      initialBalance,
      finalEquity: {
        p5: getP(finalEquities, 5),
        p25: getP(finalEquities, 25),
        p50: getP(finalEquities, 50),
        p75: getP(finalEquities, 75),
        p95: getP(finalEquities, 95),
      },
      maxDrawdownPercent: {
        p5: getP(maxDrawdownsPct, 5),
        p25: getP(maxDrawdownsPct, 25),
        p50: getP(maxDrawdownsPct, 50),
        p75: getP(maxDrawdownsPct, 75),
        p95: getP(maxDrawdownsPct, 95),
      },
      probabilityOfNegativeReturn: probNegReturn,
      probabilityOfRuin: probRuin,
      ruinThresholdPercent,
      riskOfRuinVerdict,
    };
  }
}
