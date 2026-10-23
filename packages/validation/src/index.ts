import type {
  Candle,
  CostAssumptions,
  MarketConfig,
  TradingOpportunity,
  ValidationReport,
  DatasetManifest,
} from "@nultra/shared-types";
import { P0_DEFAULTS } from "@nultra/shared-types";
import { runBacktest, enumerateCandidates, buildStrategy, type CandidateSpec } from "@nultra/quant-core";

export const VALIDATION_VERSION = "0.3.0-m3";

const NEIGHBOR_VALUES: Record<string, Record<string, number[]>> = {
  momentum: { lookback: [5, 10, 20], threshold: [0.01, 0.02, 0.05], trendWindow: [10, 20, 50] },
  mean_reversion: { window: [10, 20, 30], entryZ: [1.5, 2.0, 2.5], exitZ: [0] },
  volatility_breakout: { lookback: [5, 10, 20], atrMult: [1.0, 1.5, 2.0], volWindow: [10, 20] },
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCosts2x(c: CostAssumptions): CostAssumptions {
  return { ...c, feeBpsPerSide: c.feeBpsPerSide * 2, halfSpreadBpsPerSide: c.halfSpreadBpsPerSide * 2, slippageBpsPerSide: c.slippageBpsPerSide * 2, source: c.source };
}

function oneStepNeighbors(spec: CandidateSpec): CandidateSpec[] {
  const allowed = NEIGHBOR_VALUES[spec.family];
  if (!allowed) return [];
  const keys = Object.keys(spec.params);
  const out: CandidateSpec[] = [];
  for (const key of keys) {
    const vals = allowed[key];
    if (!vals) continue;
    const idx = vals.indexOf(Number(spec.params[key]));
    if (idx < 0) continue;
    for (const di of [-1, 1]) {
      const ni = idx + di;
      if (ni < 0 || ni >= vals.length) continue;
      const newParams = { ...spec.params, [key]: vals[ni] };
      out.push({ family: spec.family, params: newParams, gridVersion: spec.gridVersion });
    }
  }
  // dedupe
  const seen = new Set<string>();
  const uniq: CandidateSpec[] = [];
  for (const n of out) {
    const k = JSON.stringify(n.params);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
  }
  return uniq;
}

function buyAndHoldReturn(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  const first = Number(candles[0].open);
  const last = Number(candles[candles.length - 1].close);
  return first !== 0 ? (last - first) / first : 0;
}

function randomBaselineReturn(candles: Candle[], costs: CostAssumptions, market: MarketConfig | undefined, seed: number): number {
  const rng = mulberry32(seed);
  const initial = P0_DEFAULTS.initialEquity;
  let cash = initial;
  let position = 0;
  let quantity = 0;
  const execBps = costs.halfSpreadBpsPerSide + costs.slippageBpsPerSide;
  const feeBps = costs.feeBpsPerSide;
  const step = market ? Number(market.quantityStep) : 1;
  const minNot = market ? Number(market.minNotional) : 0;
  for (let i = 0; i < candles.length; i++) {
    const openPrice = Number(candles[i].open);
    const target = rng() > 0.5 ? 1 : 0;
    if (position === 0 && target === 1) {
      const alloc = cash * P0_DEFAULTS.sizingFraction;
      const buyFill = openPrice * (1 + execBps / 10000);
      const qty = Math.floor(alloc / buyFill / step) * step;
      if (qty > 0 && qty * buyFill >= minNot) {
        const notional = qty * buyFill;
        const fee = (notional * feeBps) / 10000;
        cash -= notional + fee;
        position = 1;
        quantity = qty;
      }
    } else if (position === 1 && target === 0) {
      const sellFill = openPrice * (1 - execBps / 10000);
      const notional = quantity * sellFill;
      const fee = (notional * feeBps) / 10000;
      cash += notional - fee;
      position = 0;
      quantity = 0;
    }
    // no MTM cash change for random baseline (approx)
  }
  let finalEquity = cash;
  if (position === 1) finalEquity += quantity * Number(candles[candles.length - 1].close);
  return (finalEquity - initial) / initial;
}

export interface ValidateInput {
  candles: Candle[];
  market?: MarketConfig;
  costs: CostAssumptions;
  candidates?: CandidateSpec[];
  seed: number;
  datasetManifest?: DatasetManifest;
  interval?: string;
  env?: "mainnet" | "testnet";
  onProgress?: (msg: string) => void;
}

export interface ValidateOutput {
  opportunities: TradingOpportunity[];
  reports: ValidationReport[];
  noRobustEdge: boolean;
  attempted: number;
  dataStatus: "OK" | "INSUFFICIENT_MARKET_DATA";
  diagnostics: {
    insufficientMarketData: boolean;
    insufficientTrades: number;
    failedProfitability: number;
    failedWalkForward: number;
    failedCostStress: number;
    failedNeighborStability: number;
    failedHoldout: number;
  };
  baselines: { buyAndHoldNetReturn: string; randomTimingNetReturn: string };
}

export async function validateOpportunities(input: ValidateInput): Promise<ValidateOutput> {
  const { candles, market, costs, seed } = input;
  if (!market) throw new Error("market config required for validation");
  const candidates = input.candidates ?? enumerateCandidates();
  const interval = input.interval ?? "1h";
  const env = input.env ?? "mainnet";
  const datasetManifest = input.datasetManifest;

  const n = candles.length;
  const trainEnd = Math.floor(n * 0.6);
  const valEnd = Math.floor(n * 0.8);
  const warmup = Math.min(60, trainEnd);
  const train = candles.slice(0, trainEnd);
  const validation = candles.slice(trainEnd - warmup, valEnd);
  const validationStart = warmup;
  const holdout = candles.slice(Math.max(0, valEnd - warmup), n);
  const holdoutStart = Math.min(warmup, valEnd);

  const stressCosts = makeCosts2x(costs);

  // walk-forward folds within pre-holdout
  const pre = candles.slice(0, valEnd);
  const seg = Math.floor(pre.length / 4);
  const folds: Array<{ train: Candle[]; validation: Candle[]; startIndex: number }> = [];
  if (seg > 0) {
    for (let k = 0; k < 3; k++) {
      const tr = pre.slice(0, (k + 1) * seg);
      const wa = Math.min(60, tr.length);
      const va = pre.slice((k + 1) * seg - wa, (k + 2) * seg);
      if (tr.length > 0 && va.length > 0) folds.push({ train: tr, validation: va, startIndex: wa });
    }
  }

  const insufficientData = train.length < 20 || validation.length < 10 || holdout.length < 10 || folds.length < 3;

  const reports: ValidationReport[] = [];
  const opps: TradingOpportunity[] = [];
  const passingIndices: number[] = [];
  const dataStatus: "OK" | "INSUFFICIENT_MARKET_DATA" = insufficientData ? "INSUFFICIENT_MARKET_DATA" : "OK";

  for (let ci = 0; ci < candidates.length; ci++) {
    const spec = candidates[ci];
    input.onProgress?.(`Validating candidate ${ci + 1}/${candidates.length}...`);
    // yield to event loop so progress messages can be delivered
    await new Promise((resolve) => setTimeout(resolve, 0));
    const strategy = buildStrategy(spec);
    const trainRes = runBacktest(train, spec, costs, market, 0);
    const valRes = runBacktest(validation, spec, costs, market, validationStart);
    const stressRes = runBacktest(validation, spec, stressCosts, market, validationStart);

    const foldReturns: number[] = [];
    let foldsPositive = 0;
    let foldExpectancySum = 0;
    for (const f of folds) {
      const fr = runBacktest(f.validation, spec, costs, market, f.startIndex);
      const er = Number(fr.expectancy);
      foldReturns.push(er);
      foldExpectancySum += er;
      if (Number(fr.netReturn) > 0) foldsPositive++;
    }
    const aggFoldExpectancy = folds.length > 0 ? foldExpectancySum / folds.length : 0;

    // neighbor stability
    const neighbors = oneStepNeighbors(spec);
    let posNeighbors = 0;
    for (const nb of neighbors) {
      const nbRes = runBacktest(validation, nb, costs, market, validationStart);
      if (Number(nbRes.expectancy) > 0) posNeighbors++;
    }
    const neighborPct = neighbors.length > 0 ? (posNeighbors / neighbors.length) * 100 : 0;

    const preHoldoutOosTrades = valRes.completedTrades;
    const holdoutTrades = 0;

    const gateResults: Array<{ gate: string; value: string; threshold: string; pass: boolean; reason: string }> = [];
    const addGate = (gate: string, value: string, threshold: string, pass: boolean, reason: string) => {
      gateResults.push({ gate, value, threshold, pass, reason });
    };

    if (insufficientData) {
      addGate("data_integrity", "n/a", "adequate", false, "insufficient data for splits/folds");
    } else {
      addGate("data_integrity", "ok", "ok", true, "dataset validated");
    }
    const tradeGate = preHoldoutOosTrades >= P0_DEFAULTS.minPreHoldoutOosTrades;
    addGate("min_trades", `${preHoldoutOosTrades}/${holdoutTrades}`, `${P0_DEFAULTS.minPreHoldoutOosTrades}/${P0_DEFAULTS.minHoldoutTrades}`, tradeGate, tradeGate ? "ok" : "trade count below floor");

    const valProfitGate = Number(valRes.expectancy) > 0 && Number(valRes.netReturn) > 0;
    addGate("validation_profit", `${valRes.expectancy}/${valRes.netReturn}`, ">0", valProfitGate, valProfitGate ? "ok" : "validation not profitable");

    const wfGate = folds.length >= P0_DEFAULTS.minWalkForwardFolds && foldsPositive >= 2 && aggFoldExpectancy > 0;
    addGate("walk_forward", `${foldsPositive}/${folds.length}`, ">=2 of 3", wfGate, wfGate ? "ok" : "walk-forward not robust");

    const stressGate = Number(stressRes.expectancy) > 0;
    addGate("cost_stress_2x", stressRes.expectancy, ">0", stressGate, stressGate ? "ok" : "fails 2x costs");

    const neighborGate = neighborPct >= P0_DEFAULTS.minNeighborStabilityPct;
    addGate("neighbor_stability", `${neighborPct.toFixed(1)}%`, `>=${P0_DEFAULTS.minNeighborStabilityPct}%`, neighborGate, neighborGate ? "ok" : "unstable neighbors");

    const validationPass = !insufficientData && tradeGate && valProfitGate && wfGate && stressGate && neighborGate;
    const allPass = validationPass;

    let verdict: ValidationReport["verdict"];
    const rejectionReasons: string[] = [];
    if (insufficientData) {
      verdict = "INSUFFICIENT DATA";
      rejectionReasons.push("insufficient market data");
    } else if (!tradeGate) {
      verdict = "INSUFFICIENT DATA";
      rejectionReasons.push("insufficient trades");
    } else if (allPass) {
      verdict = "CANDIDATE — HISTORICAL ONLY";
    } else {
      verdict = "REJECTED";
      for (const g of gateResults) if (!g.pass) rejectionReasons.push(`${g.gate}: ${g.reason}`);
    }

    const report: ValidationReport = {
      trainRange: { startMs: train[0]?.openTimeMs ?? 0, endMs: train[train.length - 1]?.openTimeMs ?? 0 },
      validationRange: { startMs: candles[trainEnd]?.openTimeMs ?? 0, endMs: candles[valEnd - 1]?.openTimeMs ?? 0 },
      holdoutRange: { startMs: candles[valEnd]?.openTimeMs ?? 0, endMs: candles[n - 1]?.openTimeMs ?? 0 },
      folds: folds.length,
      foldNetReturns: foldReturns.map((x) => x.toFixed(8)),
      preHoldoutOosTrades,
      holdoutTrades,
      costStress2xExpectancy: stressRes.expectancy,
      neighborStabilityPct: neighborPct,
      benchmarks: {
        buyAndHoldNetReturn: buyAndHoldReturn(validation).toFixed(8),
        randomTimingNetReturn: randomBaselineReturn(validation, costs, market, seed).toFixed(8),
      },
      gateResults,
      verdict,
      rejectionReasons,
    };

    const opp: TradingOpportunity = {
      opportunityId: `${strategy.strategyId}-${seed}`,
      market: market?.symbol ?? "UNKNOWN",
      hypothesisFamily: spec.family,
      hypothesisExplanation: `Hypothesis family ${spec.family} with params ${JSON.stringify(spec.params)}.`,
      strategyRules: strategy.rulesText,
      parameterSet: spec.params,
      datasetManifest: datasetManifest ?? {
        source: "strike",
        env: env as "mainnet" | "testnet",
        symbol: market?.symbol ?? "UNKNOWN",
        interval: interval,
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
        provenance: "M3 validation (no manifest provided)",
      },
      executionAssumptions: costs,
      trainMetrics: trainRes,
      validationMetrics: valRes,
      holdoutMetrics: undefined,
      riskMetrics: {
        maxDrawdown: valRes.maxDrawdown,
        tradeCount: valRes.tradeCount,
        completedTrades: valRes.completedTrades,
      },
      robustnessChecks: {
        walkForwardFoldsPositive: foldsPositive,
        walkForwardFoldsTotal: folds.length,
        costStress2xPass: stressGate,
        neighborStabilityPct: neighborPct,
      },
      verdict,
      rejectionReasons,
      experimentId: `exp-${seed}`,
      createdAt: new Date().toISOString(),
      engineVersion: "0.3.1-m3",
      randomSeed: seed,
    };

    reports.push(report);
    opps.push(opp);
    if (validationPass) passingIndices.push(opps.length - 1);
  }



  // Sealed holdout: evaluate only the selected candidate once.
  let selectedIndex = -1;
  if (passingIndices.length > 0) {
    selectedIndex = passingIndices.reduce((best, idx) => {
      if (best === -1) return idx;
      const a = opps[idx], b = opps[best];
      const va = Number(a.validationMetrics.expectancy), vb = Number(b.validationMetrics.expectancy);
      if (va !== vb) return va > vb ? idx : best;
      const da = Number(a.validationMetrics.maxDrawdown), db = Number(b.validationMetrics.maxDrawdown);
      if (da !== db) return da < db ? idx : best;
      return a.opportunityId < b.opportunityId ? idx : best;
    }, -1);
  }
  if (selectedIndex >= 0) {
    const selSpec = candidates[selectedIndex];
    const holdoutRes = runBacktest(holdout, selSpec, costs, market, holdoutStart);
    opps[selectedIndex].holdoutMetrics = holdoutRes;
    const holdoutTrades = holdoutRes.completedTrades;
    const holdoutGate = holdoutTrades >= P0_DEFAULTS.minHoldoutTrades && Number(holdoutRes.expectancy) > 0 && Number(holdoutRes.netReturn) > 0;
    if (holdoutGate) {
      opps[selectedIndex].verdict = "CANDIDATE — HISTORICAL ONLY";
      opps[selectedIndex].rejectionReasons = [];
    } else {
      opps[selectedIndex].verdict = "REJECTED";
      opps[selectedIndex].rejectionReasons = [holdoutTrades < P0_DEFAULTS.minHoldoutTrades ? "holdout: trade count below floor" : "holdout: not profitable"];
    }
    reports[selectedIndex].verdict = opps[selectedIndex].verdict as ValidationReport["verdict"];
    reports[selectedIndex].rejectionReasons = opps[selectedIndex].rejectionReasons;
    reports[selectedIndex].holdoutTrades = holdoutTrades;
    reports[selectedIndex].gateResults.push({ gate: "holdout", value: `${holdoutRes.expectancy}/${holdoutRes.netReturn}`, threshold: ">0", pass: holdoutGate, reason: holdoutGate ? "ok" : "holdout not profitable" });

  }
  // non-selected validation-passing candidates: not evaluated on holdout
  for (const idx of passingIndices) {
    if (idx === selectedIndex) continue;
    opps[idx].verdict = "REJECTED";
    opps[idx].rejectionReasons = ["not selected for sealed holdout evaluation"];
    opps[idx].holdoutMetrics = undefined;
    reports[idx].verdict = "REJECTED";
    reports[idx].rejectionReasons = opps[idx].rejectionReasons;
  }

  // ranking: eligible first, then validation expectancy desc, drawdown asc, cost stress desc, holdout trades desc, id asc
  opps.sort((a, b) => {
    const aElig = a.verdict === "CANDIDATE — HISTORICAL ONLY" ? 0 : 1;
    const bElig = b.verdict === "CANDIDATE — HISTORICAL ONLY" ? 0 : 1;
    if (aElig !== bElig) return aElig - bElig;
    const va = Number(a.validationMetrics.expectancy);
    const vb = Number(b.validationMetrics.expectancy);
    if (vb !== va) return vb - va;
    const da = Number(a.validationMetrics.maxDrawdown);
    const db = Number(b.validationMetrics.maxDrawdown);
    if (da !== db) return da - db;
    // cost stress tie-breaker (recompute pass as 0/1; expectancy not stored, use robustness flag)
    const csa = a.robustnessChecks.costStress2xPass ? 1 : 0;
    const csb = b.robustnessChecks.costStress2xPass ? 1 : 0;
    if (csb !== csa) return csb - csa;
    const ha = a.holdoutMetrics ? Number(a.holdoutMetrics.completedTrades) : 0;
    const hb = b.holdoutMetrics ? Number(b.holdoutMetrics.completedTrades) : 0;
    if (hb !== ha) return hb - ha;
    return a.opportunityId.localeCompare(b.opportunityId);
  });

  const diagnostics = {
    insufficientMarketData: dataStatus === "INSUFFICIENT_MARKET_DATA",
    insufficientTrades: reports.filter((r) => r.gateResults.some((g) => g.gate === "min_trades" && !g.pass)).length,
    failedProfitability: reports.filter((r) => r.gateResults.some((g) => g.gate === "validation_profit" && !g.pass)).length,
    failedWalkForward: reports.filter((r) => r.gateResults.some((g) => g.gate === "walk_forward" && !g.pass)).length,
    failedCostStress: reports.filter((r) => r.gateResults.some((g) => g.gate === "cost_stress_2x" && !g.pass)).length,
    failedNeighborStability: reports.filter((r) => r.gateResults.some((g) => g.gate === "neighbor_stability" && !g.pass)).length,
    failedHoldout: reports.filter((r) => r.gateResults.some((g) => g.gate === "holdout" && !g.pass)).length,
  };
  const baselines = {
    buyAndHoldNetReturn: reports.length ? reports[0].benchmarks.buyAndHoldNetReturn : "0",
    randomTimingNetReturn: reports.length ? reports[0].benchmarks.randomTimingNetReturn : "0",
  };

  const noRobustEdge = !opps.some((o) => o.verdict === "CANDIDATE — HISTORICAL ONLY");

  return { opportunities: opps, reports, noRobustEdge, attempted: candidates.length, dataStatus, diagnostics, baselines };
}