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

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const p = 100 + Math.sin(i / 5) * 8 + (i % 7);
    return {
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
    };
  });
}

describe("performance", () => {
  it("processes 2160 candles within 30s", { timeout: 30000 }, async () => {
    const candles = makeCandles(2160);
    const t0 = Date.now();
    const res = await validateOpportunities({ candles, market, costs, seed: 7 });
    const dt = Date.now() - t0;
    console.log(`2160 candles: ${dt}ms, attempted=${res.attempted}`);
    expect(res.attempted).toBeGreaterThan(0);
    expect(dt).toBeLessThan(30000);
  });

  it("processes 8640 candles within 120s", { timeout: 120000 }, async () => {
    const candles = makeCandles(8640);
    const t0 = Date.now();
    const res = await validateOpportunities({ candles, market, costs, seed: 7 });
    const dt = Date.now() - t0;
    console.log(`8640 candles: ${dt}ms, attempted=${res.attempted}`);
    expect(res.attempted).toBeGreaterThan(0);
    expect(dt).toBeLessThan(120000);
  });
});
