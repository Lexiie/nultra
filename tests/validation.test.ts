import { describe, expect, it } from "vitest";
import { validateOpportunities } from "@nultra/validation";
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

describe("validation", () => {
  it("runs gates and returns noRobustEdge flag", () => {
    const prices = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 5) * 8 + (i % 7));
    const candles = makeCandles(prices);
    const res = validateOpportunities({ candles, market, costs, seed: 7 });
    expect(res.attempted).toBeGreaterThan(0);
    expect(res.opportunities.length).toBe(res.attempted);
    expect(typeof res.noRobustEdge).toBe("boolean");
    const o = res.opportunities[0];
    expect(o.validationMetrics).toBeTruthy();
    // holdoutMetrics present only for the selected candidate (if any)
    expect(o.validationMetrics).toBeTruthy();
    expect(o.robustnessChecks.walkForwardFoldsTotal).toBeGreaterThanOrEqual(3);
  });

  it("insufficient data yields INSUFFICIENT DATA", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = makeCandles(prices);
    const res = validateOpportunities({ candles, market, costs, seed: 1 });
    expect(res.opportunities[0].verdict).toBe("INSUFFICIENT DATA");
  });
});
