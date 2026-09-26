import { DigitalTwinSimulation } from '../types';

interface CorrelatedAssetMeta {
  symbol: string;
  beta: number; // sensitivity relative to base asset
  correlation: number;
}

const CORRELATION_MAP: Record<string, CorrelatedAssetMeta[]> = {
  BTCUSDT: [
    { symbol: 'ETHUSDT', beta: 1.22, correlation: 0.88 },
    { symbol: 'SOLUSDT', beta: 1.54, correlation: 0.81 },
    { symbol: 'NVDA', beta: 0.42, correlation: 0.46 },
    { symbol: 'XAUUSD', beta: 0.18, correlation: 0.24 },
    { symbol: 'EURUSD', beta: -0.12, correlation: -0.15 },
  ],
  ETHUSDT: [
    { symbol: 'BTCUSDT', beta: 0.82, correlation: 0.88 },
    { symbol: 'SOLUSDT', beta: 1.28, correlation: 0.84 },
    { symbol: 'NVDA', beta: 0.38, correlation: 0.42 },
  ],
  DEFAULT: [
    { symbol: 'BTCUSDT', beta: 0.65, correlation: 0.52 },
    { symbol: 'ETHUSDT', beta: 0.72, correlation: 0.50 },
    { symbol: 'XAUUSD', beta: 0.25, correlation: 0.30 },
  ],
};

export function simulateDigitalTwin(
  currentPrice: number,
  deltaPercent: number, // e.g. -4.0 or +3.5
  positionType: 'LONG' | 'SHORT' = 'LONG',
  leverage = 5,
  positionSizeUsd = 10000,
  symbol = 'BTCUSDT'
): DigitalTwinSimulation {
  const simulatedPrice = Math.round(currentPrice * (1 + deltaPercent / 100) * 100) / 100;
  const priceMovePct = deltaPercent;

  // P&L calculation
  const pnlPercent = positionType === 'LONG'
    ? priceMovePct * leverage
    : -priceMovePct * leverage;

  const pnlUsd = Math.round((positionSizeUsd * (pnlPercent / 100)) * 100) / 100;

  // Liquidation calculation (assuming standard maintenance margin e.g. 1% / leverage)
  const maintenanceMarginRate = 0.01;
  const liquidationPrice = positionType === 'LONG'
    ? currentPrice * (1 - (1 / leverage) + maintenanceMarginRate)
    : currentPrice * (1 + (1 / leverage) - maintenanceMarginRate);

  // Margin health percentage (100% = safe, 0% = liquidated)
  let marginHealth = 100;
  if (positionType === 'LONG') {
    const dropToLiq = currentPrice - liquidationPrice;
    const currentDrop = currentPrice - simulatedPrice;
    marginHealth = Math.max(0, Math.min(100, Math.round((1 - (currentDrop / dropToLiq)) * 100)));
  } else {
    const riseToLiq = liquidationPrice - currentPrice;
    const currentRise = simulatedPrice - currentPrice;
    marginHealth = Math.max(0, Math.min(100, Math.round((1 - (currentRise / riseToLiq)) * 100)));
  }

  // Expected Value calculation
  const probProfit = positionType === 'LONG'
    ? Math.max(10, Math.min(90, Math.round(52 + (deltaPercent * 1.8))))
    : Math.max(10, Math.min(90, Math.round(52 - (deltaPercent * 1.8))));

  const ev = Math.round(((probProfit / 100) * Math.max(0, pnlUsd) - ((100 - probProfit) / 100) * Math.abs(Math.min(0, pnlUsd))) * 100) / 100;

  // Correlated assets stress test
  const corrList = CORRELATION_MAP[symbol.toUpperCase()] || CORRELATION_MAP.DEFAULT;
  const correlatedAssetsImpact = corrList.map((c) => ({
    symbol: c.symbol,
    expectedMovePercent: Math.round(deltaPercent * c.beta * 10) / 10,
    correlation: c.correlation,
  }));

  return {
    assetPrice: currentPrice,
    deltaPercent,
    simulatedPrice,
    positionType,
    leverage,
    positionSizeUsd,
    pnlUsd,
    pnlPercent: Math.round(pnlPercent * 10) / 10,
    liquidationPrice: Math.round(liquidationPrice * 100) / 100,
    marginHealth,
    probabilityOfProfit: probProfit,
    ev,
    correlatedAssetsImpact,
  };
}
