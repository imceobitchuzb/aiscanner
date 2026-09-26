import { MonteCarloSimulationResult, TradeRecord } from '../types';

export function runMonteCarloSimulation(
  trades: TradeRecord[],
  initialBalance = 10000,
  iterations = 1000,
  tradesPerSimulation = 60
): MonteCarloSimulationResult {
  if (trades.length === 0) {
    return {
      iterations,
      probabilityOfRuin: 0,
      expectedMaxDrawdown: 0,
      p5TerminalEquity: initialBalance,
      p50TerminalEquity: initialBalance,
      p95TerminalEquity: initialBalance,
      samplePaths: [],
    };
  }

  const pnlPcts = trades.map((t) => t.pnlPercent / 100);
  const terminalEquities: number[] = [];
  const maxDrawdowns: number[] = [];
  let ruinCount = 0;
  const ruinThreshold = initialBalance * 0.5; // 50% drawdown = ruin

  const samplePaths: { step: number; equity: number }[][] = [];

  for (let iter = 0; iter < iterations; iter++) {
    let equity = initialBalance;
    let peak = equity;
    let maxDd = 0;
    const path: { step: number; equity: number }[] = [{ step: 0, equity }];

    for (let step = 1; step <= tradesPerSimulation; step++) {
      // Bootstrap resample with replacement
      const randomIndex = Math.floor(Math.random() * pnlPcts.length);
      const ret = pnlPcts[randomIndex];
      
      const tradePnl = equity * 0.15 * ret; // 15% position risk
      equity += tradePnl;
      if (equity < 100) equity = 100;

      if (equity > peak) peak = equity;
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;

      if (equity <= ruinThreshold && ruinThreshold > 0) {
        ruinCount++;
        break;
      }

      if (iter < 8 && step % 4 === 0) {
        path.push({ step, equity: Math.round(equity) });
      }
    }

    if (iter < 8) {
      path.push({ step: tradesPerSimulation, equity: Math.round(equity) });
      samplePaths.push(path);
    }

    terminalEquities.push(equity);
    maxDrawdowns.push(maxDd);
  }

  terminalEquities.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const p5Idx = Math.floor(iterations * 0.05);
  const p50Idx = Math.floor(iterations * 0.50);
  const p95Idx = Math.floor(iterations * 0.95);

  const avgMaxDd = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;
  const probabilityOfRuin = Math.round((ruinCount / iterations) * 1000) / 10;

  return {
    iterations,
    probabilityOfRuin,
    expectedMaxDrawdown: Math.round(avgMaxDd * 10) / 10,
    p5TerminalEquity: Math.round(terminalEquities[p5Idx]),
    p50TerminalEquity: Math.round(terminalEquities[p50Idx]),
    p95TerminalEquity: Math.round(terminalEquities[p95Idx]),
    samplePaths,
  };
}
