import { describe, expect, it } from "vitest";
import { runBacktest, enumerateCandidates, discoverOpportunities } from "@nultra/quant-core";
import type { Candle, CostAssumptions } from "@nultra/shared-types";

const costs: CostAssumptions = {
  feeBpsPerSide: 10,
  halfSpreadBpsPerSide: 5,
  slippageBpsPerSide: 5,
  fundingIncluded: false,
  source: "DEFAULT_ESTIMATE",
  label: "FUNDING_EXCLUDED",
};

function makeCandles(prices: number[]): Candle[] {
  return prices.map((p, i) => ({
    openTimeMs: (i + 1) * 3600000,
    open: String(p),
    high: String(p + 1),
    low: String(p - 1),
    close: String(p),
    volume: "10",
    closeTimeMs: (i + 1) * 3600000 + 3599999,
    quoteVolume: String(p * 10),
    trades: 5,
    takerBuyBase: "4",
    takerBuyQuote: String(p * 4),
  }));
}

describe("quant core", () => {
  it("flat-ish round trip loses money to costs", () => {
    // rise then fall back to start
    const prices: number[] = [];
    for (let i = 0; i < 20; i++) prices.push(100 + i);
    for (let i = 0; i < 20; i++) prices.push(120 - i);
    const candles = makeCandles(prices);
    const spec = { family: "momentum" as const, params: { lookback: 5, threshold: 0.01, trendWindow: 5 }, gridVersion: "t" };
    const res = runBacktest(candles, spec, costs);
    expect(res.tradeCount).toBeGreaterThan(0);
    // net return should be <= gross-ish; realized net < realized gross due to fees
    const t = res.trades[0];
    expect(Number(t.realizedNetPnl)).toBeLessThan(Number(t.realizedGrossPnl));
  });

  it("deterministic replay", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5);
    const candles = makeCandles(prices);
    const spec = { family: "mean_reversion" as const, params: { window: 10, entryZ: 1.5, exitZ: 0 }, gridVersion: "t" };
    const a = runBacktest(candles, spec, costs);
    const b = runBacktest(candles, spec, costs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("no negative cash", () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = makeCandles(prices);
    const spec = { family: "volatility_breakout" as const, params: { lookback: 5, atrMult: 1.0, volWindow: 10 }, gridVersion: "t" };
    const res = runBacktest(candles, spec, costs);
    for (const t of res.trades) {
      expect(Number(t.cashAfter)).toBeGreaterThanOrEqual(0);
    }
  });

  it("enumerateCandidates is non-empty and sorted", () => {
    const c = enumerateCandidates();
    expect(c.length).toBeGreaterThan(40);
    // sorted by family then params
    for (let i = 1; i < c.length; i++) {
      const key = (x: { family: string; params: unknown }) => x.family + JSON.stringify(x.params);
      expect(key(c[i - 1]) <= key(c[i])).toBe(true);
    }
  });

  it("discoverOpportunities produces opportunities with validation metrics", () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 4);
    const candles = makeCandles(prices);
    const opps = discoverOpportunities(candles, undefined, costs, 42);
    expect(opps.length).toBeGreaterThan(0);
    const o = opps[0];
    expect(o.trainMetrics).toBeTruthy();
    expect(o.validationMetrics).toBeTruthy();
    expect(o.verdict).toBe("CANDIDATE — HISTORICAL ONLY");
  });
});
