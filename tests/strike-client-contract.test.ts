import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseExchangeInfo, parseFeeTiers, parseMarket, parseKlines } from "@nultra/strike-client";

const base = "/tmp/opencode/extracted/evidence-mainnet/strike-mainnet";

describe("Strike client contract", () => {
  it("parses markets BTC-USD", () => {
    const raw = JSON.parse(readFileSync(`${base}/markets.json`, "utf-8")) as { markets: Record<string, unknown> };
    const m = parseMarket(raw.markets["BTC-USD"]);
    expect(m.symbol).toBe("BTC-USD");
    expect(m.tickSize).toBe("1");
    expect(m.quantityStep).toBe("0.00001");
    expect(m.minNotional).toBe("10");
  });

  it("parses exchangeInfo", () => {
    const raw = JSON.parse(readFileSync(`${base}/exchange_info.json`, "utf-8"));
    const info = parseExchangeInfo(raw);
    const btc = info.symbols.find((s) => s.symbol === "BTC-USD");
    expect(btc).toBeTruthy();
    expect(info.rateLimits.length).toBeGreaterThan(0);
  });

  it("parses klines 1h", () => {
    const raw = JSON.parse(readFileSync(`${base}/klines_1h.json`, "utf-8"));
    const bars = parseKlines(raw);
    expect(bars.length).toBe(100);
    expect(bars[0].openTime).toBeGreaterThan(0);
  });

  it("parses fee tiers (live probe)", () => {
    // Use captured curl output shape
    const sample = { feeTiers: [{ Tier: 0, MinVolume: 0, TakerRate: 0.0005, MakerRate: -0.00005 }] };
    const ft = parseFeeTiers(sample);
    expect(ft.feeTiers[0].TakerRate).toBe(0.0005);
  });
});
