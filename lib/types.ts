export type AssetCategory = 'CRYPTO' | 'FOREX' | 'COMMODITIES' | 'EQUITIES';

export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  volatility: number; // annualized or ATR %
  regime: MarketRegimeType;
  signalState: 'LONG' | 'SHORT' | 'NEUTRAL';
  isLiveSupported: boolean;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W';

export type MarketRegimeType = 
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'RANGE'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'UNCERTAIN';

export interface MarketRegimeState {
  regime: MarketRegimeType;
  confidence: number; // 0-100
  durationHours: number;
  stability: 'LOW' | 'MEDIUM' | 'HIGH';
  transitionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  transitionProbabilities: {
    targetRegime: MarketRegimeType;
    probability: number;
  }[];
  explanation: string;
}

export interface MultiTimeframeRow {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  structure: 'BULL_BREAK' | 'BEAR_BREAK' | 'RANGE_BOUND' | 'SWING_LOW' | 'SWING_HIGH';
  volatility: 'COMPRESSION' | 'NORMAL' | 'EXPANSION';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface MultiTimeframeAnalysis {
  rows: MultiTimeframeRow[];
  alignmentScore: number; // 0-100
  conflicts: string[];
  synthesis: string;
}

export interface ProbabilisticScenario {
  id: 'BULL' | 'BASE' | 'BEAR';
  title: string;
  probability: number; // 0-100
  targetPrice: number;
  expectedMovePercent: number;
  horizon: string;
  rationale: string;
  invalidationLevel: number;
}

export interface ForecastConePoint {
  time: number;
  timestampStr: string;
  upper95: number;
  upper68: number;
  median: number;
  lower68: number;
  lower95: number;
}

export interface ProbabilisticForecast {
  currentPrice: number;
  modelType: string;
  isBaseline: boolean;
  uncertaintyScore: number; // 0-100
  cone: ForecastConePoint[];
  scenarios: ProbabilisticScenario[];
}

export interface SignalQualityBreakdown {
  overallScore: number; // 0-100
  trendScore: number;
  momentumScore: number;
  structureScore: number;
  volumeScore: number;
  mtfScore: number;
  riskPenalty: number;
  newsPenalty: number;
}

export interface AISignal {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  setupGrade: 'A+' | 'A' | 'B' | 'C';
  confidence: number;
  quality: SignalQualityBreakdown;
  entryZone: [number, number];
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  expectedHoldingTime: string;
  marketRegime: string;
  mtfAlignment: number;
  whyList: string[];
  riskList: string[];
  invalidation: string;
  timestamp: number;
}

export interface HistoricalAnalogResult {
  similarSetupsFound: number;
  winRateTP: number; // e.g. 61.4%
  lossRateSL: number; // e.g. 28.6%
  neutralRate: number; // 10.0%
  averageMovePercent: number; // +2.8%
  averageAdverseMovePercent: number; // -1.1%
  medianDurationHours: number;
  topMatches: {
    id: string;
    asset: string;
    date: string;
    similarity: number; // e.g. 92%
    outcome: 'TP' | 'SL' | 'NEUTRAL';
    movePercent: number;
    regime: string;
  }[];
}

export interface DigitalTwinSimulation {
  assetPrice: number;
  deltaPercent: number;
  simulatedPrice: number;
  positionType: 'LONG' | 'SHORT';
  leverage: number;
  positionSizeUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  liquidationPrice: number;
  marginHealth: number; // 0-100%
  probabilityOfProfit: number;
  ev: number;
  correlatedAssetsImpact: {
    symbol: string;
    expectedMovePercent: number;
    correlation: number;
  }[];
}

export interface IndicatorSnapshot {
  rsi14: number;
  macd: { macd: number; signal: number; histogram: number };
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  bollinger: { upper: number; middle: number; lower: number; bandwidth: number };
  atr14: number;
  adx14: number;
  supertrend: { value: number; direction: 'BULL' | 'BEAR' };
}

export interface MarketStructure {
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  keySupport: number;
  keyResistance: number;
  fairValueGaps: { high: number; low: number; type: 'BULLISH' | 'BEARISH' }[];
  orderBlocks: { high: number; low: number; type: 'BULLISH' | 'BEARISH' }[];
  liquidityPools: { price: number; type: 'BUY_SIDE' | 'SELL_SIDE' }[];
  pivotPoints: { r2: number; r1: number; pp: number; s1: number; s2: number };
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  sentimentScore: number; // -1.0 to 1.0
  eventRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  relatedAssets: string[];
}

export interface BacktestStrategyConfig {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  initialBalance: number;
  riskPerTradePercent: number;
  stopLossAtrMultiplier: number;
  takeProfitAtrMultiplier: number;
  indicators: {
    useEmaCross: boolean;
    useRsiFilter: boolean;
    useStructureBreakout: boolean;
    useVolumeExpansion: boolean;
  };
}

export interface TradeRecord {
  id: string;
  entryTime: number;
  exitTime: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_REVERSAL';
}

export interface BacktestReport {
  netProfitUsd: number;
  netProfitPercent: number;
  totalTrades: number;
  winRatePercent: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  expectancyUsd: number;
  averageTradeUsd: number;
  averageWinUsd: number;
  averageLossUsd: number;
  consecutiveLosses: number;
  recoveryFactor: number;
  equityCurve: { time: string; equity: number; drawdown: number }[];
  monthlyReturns: { month: string; returnPercent: number }[];
  trades: TradeRecord[];
}

export interface MonteCarloSimulationResult {
  iterations: number;
  probabilityOfRuin: number; // 0-100%
  expectedMaxDrawdown: number;
  p5TerminalEquity: number;
  p50TerminalEquity: number;
  p95TerminalEquity: number;
  samplePaths: { step: number; equity: number }[][];
}

export interface WalkForwardResult {
  inSampleSharpe: number;
  outOfSampleSharpe: number;
  degradationPercent: number;
  inSampleWinRate: number;
  outOfSampleWinRate: number;
  robustnessGrade: 'ROBUST' | 'MODERATE' | 'OVERFITTED';
}
