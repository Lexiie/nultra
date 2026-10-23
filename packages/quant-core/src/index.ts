import type {
  BacktestResult,
  Candle,
  CostAssumptions,
  MarketConfig,
  StrategyDefinition,
  Trade,
  TradingOpportunity,
} from "@nultra/shared-types";
import { P0_DEFAULTS } from "@nultra/shared-types";

export const QUANT_CORE_VERSION = "0.2.0-m2";

// ---------- Indicators ----------
export function sma(values: number[], n: number): number | null {
  if (n <= 0 || values.length < n) return null;
  let s = 0;
  for (let i = values.length - n; i < values.length; i++) s += values[i];
  return s / n;
}

export function stdDev(values: number[], n: number): number | null {
  const m = sma(values, n);
  if (m === null) return null;
  let s = 0;
  for (let i = values.length - n; i < values.length; i++) s += (values[i] - m) ** 2;
  return Math.sqrt(s / n);
}

export function maxOf(values: number[], n: number): number | null {
  if (n <= 0 || values.length < n) return null;
  let m = -Infinity;
  for (let i = values.length - n; i < values.length; i++) if (values[i] > m) m = values[i];
  return m;
}

export function minOf(values: number[], n: number): number | null {
  if (n <= 0 || values.length < n) return null;
  let m = Infinity;
  for (let i = values.length - n; i < values.length; i++) if (values[i] < m) m = values[i];
  return m;
}

// ---------- Parameter grids ----------
export interface CandidateSpec {
  family: StrategyDefinition["hypothesisFamily"];
  params: StrategyDefinition["params"];
  gridVersion: string;
}

const GRID_VERSION = "m2-grid-1";

export function enumerateCandidates(): CandidateSpec[] {
  const out: CandidateSpec[] = [];
  // Momentum
  for (const lookback of [5, 10, 20]) {
    for (const threshold of [0.01, 0.02, 0.05]) {
      for (const trendWindow of [10, 20, 50]) {
        out.push({ family: "momentum", params: { lookback, threshold, trendWindow }, gridVersion: GRID_VERSION });
      }
    }
  }
  // Mean reversion
  for (const window of [10, 20, 30]) {
    for (const entryZ of [1.5, 2.0, 2.5]) {
      out.push({ family: "mean_reversion", params: { window, entryZ, exitZ: 0 }, gridVersion: GRID_VERSION });
    }
  }
  // Volatility breakout
  for (const lookback of [5, 10, 20]) {
    for (const atrMult of [1.0, 1.5, 2.0]) {
      for (const volWindow of [10, 20]) {
        out.push({ family: "volatility_breakout", params: { lookback, atrMult, volWindow }, gridVersion: GRID_VERSION });
      }
    }
  }
  // deterministic ordering
  out.sort((a, b) => a.family.localeCompare(b.family) || JSON.stringify(a.params).localeCompare(JSON.stringify(b.params)));
  return out;
}

export function buildStrategy(spec: CandidateSpec): StrategyDefinition {
  return {
    strategyId: `${spec.family}-${JSON.stringify(spec.params)}`,
    hypothesisFamily: spec.family,
    params: spec.params,
    gridVersion: spec.gridVersion,
    engineVersion: QUANT_CORE_VERSION,
    rulesText: describeRules(spec),
  };
}

function describeRules(spec: CandidateSpec): string {
  const p = spec.params;
  if (spec.family === "momentum") return `Momentum: enter long if ${p.lookback}-bar return > ${p.threshold} and close > SMA(${p.trendWindow}); exit otherwise.`;
  if (spec.family === "mean_reversion") return `Mean reversion: enter long if z-score(close,${p.window}) < -${p.entryZ}; exit if z-score > ${p.exitZ}.`;
  return `Volatility breakout: enter long if close > maxHigh(${p.lookback}) and realizedVol(${p.volWindow}) filter; exit on breakdown.`;
}

// ---------- Market constraints ----------
function qtyStep(market?: MarketConfig): number {
  return market ? Number(market.quantityStep) : 1;
}
function minNotional(market?: MarketConfig): number {
  return market ? Number(market.minNotional) : 0;
}
function roundDownQty(qty: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return qty;
  return Math.floor(qty / step) * step;
}

// ---------- Backtest engine ----------
export function runBacktest(
  candles: Candle[],
  spec: CandidateSpec,
  costs: CostAssumptions,
  market?: MarketConfig,
): BacktestResult {
  const strategy = buildStrategy(spec);
  const closes = candles.map((c) => Number(c.close));
  const highs = candles.map((c) => Number(c.high));
  const lows = candles.map((c) => Number(c.low));
  const opens = candles.map((c) => Number(c.open));

  const step = qtyStep(market);
  const minNot = minNotional(market);
  const feeBps = costs.feeBpsPerSide;
  const execBps = costs.halfSpreadBpsPerSide + costs.slippageBpsPerSide;

  let cash = P0_DEFAULTS.initialEquity;
  let position = 0; // 0 flat, 1 long
  let entryPrice = 0;
  let quantity = 0;
  let entryIndex = -1;
  let entrySignalIndex = -1;
  const trades: Trade[] = [];
  const equityCurve: Array<{ timeMs: number; equity: string }> = [];

  // helper to compute desired position given current position and bar index i (decision uses bars < i)
  function desiredPosition(currentPos: number, i: number): number {
    const p = spec.params;
    if (i < 2) return 0;
    if (spec.family === "momentum") {
      const lb = Number(p.lookback);
      const tw = Number(p.trendWindow);
      const thr = Number(p.threshold);
      if (i - 1 < lb + 1 || i - 1 < tw) return currentPos; // warmup: hold
      const lastClose = closes[i - 1];
      const prevClose = closes[i - 1 - lb];
      const ret = prevClose !== 0 ? lastClose / prevClose - 1 : 0;
      const tr = sma(closes.slice(0, i), tw);
      const trendOk = tr !== null && lastClose > tr;
      const enter = ret > thr && trendOk;
      if (currentPos === 0) return enter ? 1 : 0;
      // exit if no longer enter
      return enter ? 1 : 0;
    }
    if (spec.family === "mean_reversion") {
      const w = Number(p.window);
      const entryZ = Number(p.entryZ);
      const exitZ = Number(p.exitZ);
      if (i - 1 < w) return currentPos;
      const m = sma(closes.slice(0, i), w);
      const sd = stdDev(closes.slice(0, i), w);
      if (m === null || sd === null || sd === 0) return currentPos;
      const z = (closes[i - 1] - m) / sd;
      if (currentPos === 0) return z < -entryZ ? 1 : 0;
      return z > exitZ ? 0 : 1;
    }
    // volatility breakout
    const lb = Number(p.lookback);
    const volWindow = Number(p.volWindow);
    if (i - 1 < Math.max(lb, volWindow)) return currentPos;
    const lastClose = closes[i - 1];
    const maxHigh = maxOf(highs.slice(0, i - 1), lb);
    const minLow = minOf(lows.slice(0, i - 1), lb);
    const vol = stdDev(closes.slice(0, i), volWindow);
    const avgVol = sma(closes.slice(0, i).map((_, idx, arr) => idx > 0 ? Math.abs(arr[idx] - arr[idx - 1]) : 0), volWindow);
    const volOk = vol !== null && avgVol !== null && vol > 0; // basic filter
    if (currentPos === 0) {
      const breakout = maxHigh !== null && lastClose > maxHigh;
      return breakout && volOk ? 1 : 0;
    }
    // exit on breakdown below minLow or volatility collapse
    const breakdown = minLow !== null && lastClose < minLow;
    return breakdown ? 0 : 1;
  }

  for (let i = 0; i < candles.length; i++) {
    const openPrice = opens[i];
    // process exits/entries at open of bar i based on decision from previous bars
    const target = desiredPosition(position, i);
    if (position === 0 && target === 1) {
      // enter long
      const equityBefore = cash; // no open position
      const alloc = equityBefore * P0_DEFAULTS.sizingFraction;
      const buyFill = openPrice * (1 + execBps / 10000);
      let qty = alloc / buyFill;
      qty = roundDownQty(qty, step);
      const notional = qty * buyFill;
      if (qty > 0 && notional >= minNot) {
        const fee = (notional * feeBps) / 10000;
        cash -= notional + fee;
        position = 1;
        entryPrice = buyFill;
        quantity = qty;
        entryIndex = i;
        entrySignalIndex = i > 0 ? i - 1 : 0;
      }
    } else if (position === 1 && target === 0) {
      // exit long
      const sellFill = openPrice * (1 - execBps / 10000);
      const notional = quantity * sellFill;
      const fee = (notional * feeBps) / 10000;
      // entry fee was deducted at entry; exit fee now
      cash += notional - fee;
      const entryFee = (quantity * entryPrice * feeBps) / 10000;
      const totalFees = entryFee + fee;
      const realizedGross = quantity * (sellFill - entryPrice);
      const realizedNet = realizedGross - totalFees;
      trades.push({
        tradeId: `${strategy.strategyId}-${trades.length}`,
        opportunityId: "",
        signalBarOpenTimeMs: candles[entrySignalIndex >= 0 ? entrySignalIndex : entryIndex].openTimeMs,
        fillBarOpenTimeMs: candles[i].openTimeMs,
        direction: "long",
        entryPrice: entryPrice.toFixed(8),
        exitPrice: sellFill.toFixed(8),
        quantity: quantity.toString(),
        grossNotional: (quantity * entryPrice).toFixed(8),
        entryFee: entryFee.toFixed(8),
        exitFee: fee.toFixed(8),
        entryExecAdjustmentBps: execBps,
        exitExecAdjustmentBps: execBps,
        realizedGrossPnl: realizedGross.toFixed(8),
        realizedNetPnl: realizedNet.toFixed(8),
        cashAfter: cash.toFixed(8),
        equityAfter: cash.toFixed(8),
      });
      position = 0;
      quantity = 0;
    }

    // mark-to-market equity at close
    let equity = cash;
    if (position === 1) equity += quantity * closes[i];
    equityCurve.push({ timeMs: candles[i].openTimeMs, equity: equity.toFixed(8) });
  }

  // final open position: MTM, not a completed trade
  let finalEquity = cash;
  let unrealized = 0;
  if (position === 1) {
    unrealized = quantity * (closes[closes.length - 1] - entryPrice);
    finalEquity += quantity * closes[closes.length - 1];
  }

  // metrics
  const initial = P0_DEFAULTS.initialEquity;
  const netReturn = (finalEquity - initial) / initial;
  // max drawdown
  let peak: number = initial;
  let maxDd = 0;
  for (const pt of equityCurve) {
    const eq = Number(pt.equity);
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? (peak - eq) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  const wins = trades.filter((t) => Number(t.realizedNetPnl) > 0);
  const losses = trades.filter((t) => Number(t.realizedNetPnl) < 0);
  const grossWin = wins.reduce((s, t) => s + Number(t.realizedNetPnl), 0);
  const grossLoss = losses.reduce((s, t) => s + Math.abs(Number(t.realizedNetPnl)), 0);
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? "Infinity" : "N/A") : (grossWin / grossLoss).toFixed(6);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const totalNet = trades.reduce((s, t) => s + Number(t.realizedNetPnl), 0);
  const expectancy = trades.length > 0 ? totalNet / trades.length : 0;

  return {
    trades,
    equityCurve,
    netReturn: netReturn.toFixed(8),
    maxDrawdown: maxDd.toFixed(8),
    profitFactor: profitFactor === "Infinity" ? "N/A" : profitFactor,
    winRate: winRate.toFixed(6),
    expectancy: expectancy.toFixed(8),
    tradeCount: trades.length,
    completedTrades: trades.length,
    unrealizedPnl: unrealized.toFixed(8),
    fundingExcluded: true,
  };
}

// ---------- Opportunity discovery (M2: simple 80/20 split) ----------
export function discoverOpportunities(
  candles: Candle[],
  market: MarketConfig | undefined,
  costs: CostAssumptions,
  seed: number,
): TradingOpportunity[] {
  const splitIdx = Math.floor(candles.length * 0.8);
  const train = candles.slice(0, splitIdx);
  const validation = candles.slice(splitIdx);
  const out: TradingOpportunity[] = [];
  for (const spec of enumerateCandidates()) {
    const strategy = buildStrategy(spec);
    const trainRes = runBacktest(train, spec, costs, market);
    const valRes = runBacktest(validation, spec, costs, market);
    const opp: TradingOpportunity = {
      opportunityId: `${strategy.strategyId}-${seed}`,
      market: market?.symbol ?? "UNKNOWN",
      hypothesisFamily: spec.family,
      hypothesisExplanation: `Hypothesis family ${spec.family} with params ${JSON.stringify(spec.params)}.`,
      strategyRules: strategy.rulesText,
      parameterSet: spec.params,
      datasetManifest: {
        source: "strike",
        env: "mainnet",
        symbol: market?.symbol ?? "UNKNOWN",
        interval: "1h",
        priceType: "last",
        startMs: candles[0]?.openTimeMs ?? 0,
        endMs: candles[candles.length - 1]?.openTimeMs ?? 0,
        downloadedAt: new Date().toISOString(),
        schemaVersion: "strike-klines-1.0",
        rawHash: "",
        normalizedHash: "",
        sha256: "",
        rawPageHashes: [],
        gapCount: 0,
        gaps: [],
        barCount: candles.length,
        dataKind: "ohlcv",
        provenance: "M2 discovery",
      },
      executionAssumptions: costs,
      trainMetrics: trainRes,
      validationMetrics: valRes,
      riskMetrics: {
        maxDrawdown: valRes.maxDrawdown,
        tradeCount: valRes.tradeCount,
        completedTrades: valRes.completedTrades,
      },
      robustnessChecks: {
        walkForwardFoldsPositive: 0,
        walkForwardFoldsTotal: 0,
        costStress2xPass: false,
        neighborStabilityPct: 0,
      },
      verdict: "CANDIDATE — HISTORICAL ONLY",
      rejectionReasons: [],
      experimentId: `exp-${seed}`,
      createdAt: new Date().toISOString(),
      engineVersion: QUANT_CORE_VERSION,
      randomSeed: seed,
    };
    out.push(opp);
  }
  return out;
}