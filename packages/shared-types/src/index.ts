// Shared, versioned types for Nultra (PRD v3.0). Single source of truth for UI + core.

export type EnvName = "mainnet" | "testnet";

export interface MarketConfig {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: "PERPETUAL" | "SPOT" | string;
  status: string;
  tickSize: string;
  quantityStep: string;
  marketMinSize: string;
  marketMaxSize: string;
  limitMinSize: string;
  limitMaxSize: string;
  minNotional: string;
  pricePrecision: number;
  quantityPrecision: number;
  // Margin tiers carried from /v2/markets (P1+); P0 uses only price/qty constraints.
  marginTiers?: Array<{
    maxNotional: string;
    maxLeverage: number;
    maintenanceMarginRate: string;
    maintenanceAmount: string;
  }>;
  fundingRate?: string;
  nextFundingTime?: number;
  liquidationFeeRate?: string;
  defaultLeverage?: number;
}

export interface Candle {
  openTimeMs: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTimeMs: number;
  quoteVolume: string;
  trades: number;
  takerBuyBase: string; // volume of trades with isBuyerMaker=true (taker sells)
  takerBuyQuote: string;
}

export interface DataGap {
  fromMs: number;
  toMs: number;
  missingBars: number;
}

export interface DatasetManifest {
  source: "strike";
  env: EnvName;
  symbol: string;
  interval: string;
  priceType: "last" | "mark" | "index";
  startMs: number;
  endMs: number;
  downloadedAt: string;
  schemaVersion: string;
  rawHash: string;
  normalizedHash: string;
  sha256: string;
  rawPageHashes: string[];
  gapCount: number;
  gaps: DataGap[];
  barCount: number;
  dataKind: "ohlcv";
  provenance: string;
}

export interface CostAssumptions {
  feeBpsPerSide: number; // default 10 (unverified estimate)
  halfSpreadBpsPerSide: number; // default 5
  slippageBpsPerSide: number; // default 5
  fundingIncluded: false; // P0 always false
  source: "USER_ESTIMATE" | "DEFAULT_ESTIMATE" | "VERIFIED";
  label: "FUNDING_EXCLUDED";
}

export interface StrategyDefinition {
  strategyId: string;
  hypothesisFamily: "momentum" | "mean_reversion" | "volatility_breakout";
  params: Record<string, number | string | boolean>;
  gridVersion: string;
  engineVersion: string;
  rulesText: string;
}

export type Side = "long" | "flat";

export interface Trade {
  tradeId: string;
  opportunityId: string;
  signalBarOpenTimeMs: number;
  fillBarOpenTimeMs: number;
  direction: "long";
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  grossNotional: string;
  entryFee: string;
  exitFee: string;
  entryExecAdjustmentBps: number;
  exitExecAdjustmentBps: number;
  realizedGrossPnl: string;
  realizedNetPnl: string;
  cashAfter: string;
  equityAfter: string;
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: Array<{ timeMs: number; equity: string }>;
  netReturn: string;
  maxDrawdown: string;
  profitFactor: string; // "N/A" if no losses
  winRate: string;
  expectancy: string;
  tradeCount: number;
  completedTrades: number;
  unrealizedPnl: string;
  fundingExcluded: true;
}

export interface ValidationReport {
  trainRange: { startMs: number; endMs: number };
  validationRange: { startMs: number; endMs: number };
  holdoutRange: { startMs: number; endMs: number };
  folds: number;
  foldNetReturns: string[];
  preHoldoutOosTrades: number;
  holdoutTrades: number;
  costStress2xExpectancy: string;
  neighborStabilityPct: number;
  benchmarks: { buyAndHoldNetReturn: string; randomTimingNetReturn: string };
  gateResults: Array<{ gate: string; value: string; threshold: string; pass: boolean; reason: string }>;
  verdict: "CANDIDATE — HISTORICAL ONLY" | "REJECTED" | "INSUFFICIENT DATA";
  rejectionReasons: string[];
}

export type Verdict = ValidationReport["verdict"];

export interface TradingOpportunity {
  opportunityId: string;
  market: string;
  hypothesisFamily: StrategyDefinition["hypothesisFamily"];
  hypothesisExplanation: string;
  strategyRules: string;
  parameterSet: StrategyDefinition["params"];
  datasetManifest: DatasetManifest;
  executionAssumptions: CostAssumptions;
  trainMetrics: BacktestResult;
  validationMetrics: BacktestResult;
  holdoutMetrics?: BacktestResult;
  riskMetrics: {
    maxDrawdown: string;
    tradeCount: number;
    completedTrades: number;
  };
  robustnessChecks: {
    walkForwardFoldsPositive: number;
    walkForwardFoldsTotal: number;
    costStress2xPass: boolean;
    neighborStabilityPct: number;
  };
  verdict: Verdict;
  rejectionReasons: string[];
  experimentId: string;
  createdAt: string;
  engineVersion: string;
  randomSeed: number;
}

export interface ExperimentManifest {
  experimentId: string;
  engineVersion: string;
  randomSeed: number;
  datasetHash: string;
  candidateCount: number;
  selectedOpportunityIds: string[];
  feeAssumptions: CostAssumptions;
  timeRanges: { train: [number, number]; validation: [number, number]; holdout: [number, number] };
  generatedAt: string;
}

// Microstructure extension seam (P0 implements OHLCV only).
export interface MarketDatasetManifestSeam {
  source: "strike";
  symbol: string;
  timeRange: [number, number];
  dataKind: "ohlcv" | "orderbook-l2" | "orderbook-l3" | "trades";
  schemaVersion: string;
  rawHash: string;
  normalizedHash: string;
  interval?: string;
  gaps: DataGap[];
  provenance: string;
}

export interface FeatureProvider {
  id: string;
  version: string;
  supportedDataKinds: MarketDatasetManifestSeam["dataKind"][];
  compute(dataset: unknown, asOfTimeMs: number): unknown;
}

export interface OpportunityHypothesis {
  id: string;
  family: StrategyDefinition["hypothesisFamily"];
  requiredFeatures: string[];
  parameterGridVersion: string;
  generateRules: (params: StrategyDefinition["params"]) => string;
}

// Constants (frozen defaults per docs 14/15).
export const P0_DEFAULTS = {
  feeBpsPerSide: 10,
  halfSpreadBpsPerSide: 5,
  slippageBpsPerSide: 5,
  sizingFraction: 0.1,
  initialEquity: 10000,
  split: { train: 0.6, validation: 0.2, holdout: 0.2 },
  minPreHoldoutOosTrades: 30,
  minHoldoutTrades: 10,
  minWalkForwardFolds: 3,
  costStressMultiplier: 2,
  minNeighborStabilityPct: 50,
  longFlatOnly: true,
  leverage: 1,
} as const;
