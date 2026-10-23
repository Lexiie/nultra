import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalizeKlines, validateAll, buildDatasetManifest } from "@nultra/data-core";
import { parseKlines } from "@nultra/strike-client";

describe("Strike kline contract", () => {
  it("parses real mainnet 1h fixture", async () => {
    // fallback: read from extracted evidence dir
    const p = "/tmp/opencode/extracted/evidence-mainnet/strike-mainnet/klines_1h.json";
    const raw = JSON.parse(readFileSync(p, "utf-8")) as unknown[];
    const bars = parseKlines(raw);
    expect(bars.length).toBe(100);
    const canon = canonicalizeKlines(raw);
    expect(canon.candles.length).toBe(100);
    expect(canon.gapCount).toBe(0);
    const errors = validateAll(canon.candles);
    expect(errors).toEqual([]);
    const manifest = await buildDatasetManifest({
      env: "mainnet",
      symbol: "BTC-USD",
      interval: "1h",
      priceType: "last",
      candles: canon.candles,
      rawPageHashes: ["test-hash"],
      gaps: canon.gaps,
      gapCount: canon.gapCount,
      downloadedAt: new Date().toISOString(),
    });
    expect(manifest.barCount).toBe(100);
    expect(manifest.source).toBe("strike");
    expect(manifest.dataKind).toBe("ohlcv");
  });

  it("rejects malformed OHLC", () => {
    const bad = [[1700000000000, "10", "9", "11", "10", "1", 1700003599999, "10", 1, "0", "0", "0"]];
    expect(() => canonicalizeKlines(bad)).not.toThrow(); // canonicalize doesn't validate OHLC values
    const canon = canonicalizeKlines(bad);
    const errors = validateAll(canon.candles);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("detects duplicate open times", () => {
    const row = [1700000000000, "10", "11", "9", "10", "1", 1700003599999, "10", 1, "0", "0", "0"];
    const dup = [row, row];
    const canon = canonicalizeKlines(dup);
    expect(canon.candles.length).toBe(1);
    expect(canon.duplicatesRemoved).toBe(1);
  });
});
