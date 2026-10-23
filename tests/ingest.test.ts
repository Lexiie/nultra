import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ingestHistoricalKlines } from "@nultra/data-core";

function makeBar(openTime: number) {
  return [openTime, "100", "101", "99", "100.5", "1", openTime + 3599999, "100", 5, "0.4", "40", "0"];
}

describe("ingestHistoricalKlines", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    let call = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      call++;
      const u = new URL(url);
      const endTime = Number(u.searchParams.get("endTime"));
      if (call === 1) {
        const bars = [makeBar(endTime - 3600000), makeBar(endTime)];
        return new Response(JSON.stringify(bars), { status: 200 });
      }
      // oldest <= startMs (0)
      return new Response(JSON.stringify([makeBar(0)]), { status: 200 });
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns candles and manifest", async () => {
    const res = await ingestHistoricalKlines({
      env: "mainnet",
      symbol: "BTC-USD",
      interval: "1h",
      startMs: 0,
      endMs: 2000000000000,
    });
    expect(res.candles.length).toBeGreaterThan(0);
    expect(res.manifest.source).toBe("strike");
    expect(res.pages).toBeGreaterThan(0);
  });
});
