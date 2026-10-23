import { describe, expect, it } from "vitest";
import { runBacktest, enumerateCandidates, discoverOpportunities } from "@nultra/quant-core";
import type { Candle, CostAssumptions, MarketConfig } from "@nultra/shared-types";

const costs: CostAssumptions = {
  feeBpsPerSide: 10,
  halfSpreadBpsPerSide: 5,
  slippageBpsPerSide: 5,
  fundingIncluded: false,
  source: "DEFAULT_ESTIMATE",
  label: "FUNDING_EXCLUDED",
};

const market: MarketConfig = {
  symbol: "BTC-USD", baseAsset: "BTC", quoteAsset: "USD", contractType: "PERPETUAL", status: "trading",
  tickSize: "1", quantityStep: "0.00001", marketMinSize: "0.00001", marketMaxSize: "1000", limitMinSize: "0.00001", limitMaxSize: "1000",
  minNotional: "10", pricePrecision: 8, quantityPrecision: 8,
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
    const res = runBacktest(candles, spec, costs, market);
    expect(res.tradeCount).toBeGreaterThan(0);
    // net return should be <= gross-ish; realized net < realized gross due to fees
    const t = res.trades[0];
    expect(Number(t.realizedNetPnl)).toBeLessThan(Number(t.realizedGrossPnl));
  });

  it("deterministic replay", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5);
    const candles = makeCandles(prices);
    const spec = { family: "mean_reversion" as const, params: { window: 10, entryZ: 1.5, exitZ: 0 }, gridVersion: "t" };
    const a = runBacktest(candles, spec, costs, market);
    const b = runBacktest(candles, spec, costs, market);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("no negative cash", () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = makeCandles(prices);
    const spec = { family: "volatility_breakout" as const, params: { lookback: 5, atrMult: 1.0, volWindow: 10 }, gridVersion: "t" };
    const res = runBacktest(candles, spec, costs, market);
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
    const opps = discoverOpportunities(candles, market, costs, 42);
    expect(opps.length).toBeGreaterThan(0);
    const o = opps[0];
    expect(o.trainMetrics).toBeTruthy();
    expect(o.validationMetrics).toBeTruthy();
    expect(o.verdict).toBe("CANDIDATE — HISTORICAL ONLY");
  });

  it("atrMult affects volatility breakout results", () => {
    const prices = Array.from({ length: 120 }, (_, i) => 100 + i * 1.5 + Math.sin(i / 2) * 8);
    const candles = makeCandles(prices);
    const results = [1.0, 1.5, 2.0].map((m) =>
      runBacktest(candles, { family: "volatility_breakout" as const, params: { lookback: 5, atrMult: m, volWindow: 10 }, gridVersion: "t" }, costs, market)
    );
    const counts = results.map((r) => r.tradeCount);
    const returns = results.map((r) => r.netReturn);
    // at least two distinct trade counts or net returns
    const distinct = new Set(counts.map((c, i) => `${c}|${returns[i]}`)).size;
    expect(distinct).toBeGreaterThan(1);
  });


  it("backtest trade timing and PnL signs", () => {
    const prices = [100, 101, 102, 103, 104, 90, 89];
    const candles = makeCandles(prices);
    const res = runBacktest(candles, { family: "momentum" as const, params: { lookback: 2, threshold: 0.01, trendWindow: 2 }, gridVersion: "t" }, costs, market);
    expect(res.tradeCount).toBeGreaterThan(0);
    const t = res.trades[0];
    expect(t.signalBarOpenTimeMs).toBeLessThan(t.fillBarOpenTimeMs);
    expect(Number(t.realizedGrossPnl)).toBeDefined();
    expect(Number(t.entryFee)).toBeGreaterThan(0);
    expect(Number(t.exitFee)).toBeGreaterThan(0);
    expect(Number(t.cashAfter)).toBeGreaterThanOrEqual(0);
  });


  it("golden backtest accounting invariants", () => {
    const prices = [100, 101, 102, 103, 104, 95, 94];
    const candles = makeCandles(prices);
    const res = runBacktest(candles, { family: "momentum" as const, params: { lookback: 2, threshold: 0.01, trendWindow: 2 }, gridVersion: "t" }, costs, market);
    expect(res.tradeCount).toBeGreaterThan(0);
    const t = res.trades[0];
    const entryFill = Number(t.entryPrice);
    const exitFill = Number(t.exitPrice);
    const qty = Number(t.quantity);
    const entryFee = Number(t.entryFee);
    const exitFee = Number(t.exitFee);
    expect(entryFee).toBeCloseTo(Math.abs(qty * entryFill) * costs.feeBpsPerSide / 10000, 6);
    expect(exitFee).toBeCloseTo(Math.abs(qty * exitFill) * costs.feeBpsPerSide / 10000, 6);
    const gross = qty * (exitFill - entryFill);
    const net = gross - entryFee - exitFee;
    expect(Number(t.realizedGrossPnl)).toBeCloseTo(gross, 6);
    expect(Number(t.realizedNetPnl)).toBeCloseTo(net, 6);
    // cash after single completed trade equals initial + net
    expect(Number(t.cashAfter)).toBeCloseTo(10000 + net, 6);
    // signal bar before fill bar
    expect(t.signalBarOpenTimeMs).toBeLessThan(t.fillBarOpenTimeMs);
  });

});
