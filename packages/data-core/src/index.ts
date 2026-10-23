import type { Candle, DataGap, DatasetManifest, EnvName } from "@nultra/shared-types";
import { parseKlineRow, toCandle } from "@nultra/strike-client";
// use global Web Crypto (available in browser and Node 22+)

export interface CanonicalCandles {
  candles: Candle[];
  duplicatesRemoved: number;
  gaps: DataGap[];
  gapCount: number;
}

export function canonicalizeKlines(rows: unknown[]): CanonicalCandles {
  const parsed: Candle[] = rows.map((r) => toCandle(parseKlineRow(r)));
  // dedupe exact duplicates; reject conflicting duplicates (same openTime, different OHLCV)
  const byTime = new Map<number, Candle>();
  let duplicatesRemoved = 0;
  for (const c of parsed) {
    const existing = byTime.get(c.openTimeMs);
    if (existing) {
      const same = existing.open === c.open && existing.high === c.high && existing.low === c.low && existing.close === c.close && existing.volume === c.volume;
      if (same) { duplicatesRemoved++; continue; }
      throw new Error(`conflicting duplicate candle at ${c.openTimeMs}`);
    }
    byTime.set(c.openTimeMs, c);
  }
  const candles = [...byTime.values()].sort((a, b) => a.openTimeMs - b.openTimeMs);
  // audit gaps (exact interval spacing inferred from median diff; for P0 we require caller to pass intervalMs? We'll compute from consecutive diffs mode)
  const gaps: DataGap[] = [];
  let gapCount = 0;
  if (candles.length >= 2) {
    // infer interval as most common diff
    const diffs = new Map<number, number>();
    for (let i = 1; i < candles.length; i++) {
      const d = candles[i].openTimeMs - candles[i - 1].openTimeMs;
      diffs.set(d, (diffs.get(d) ?? 0) + 1);
    }
    let intervalMs = 0; let maxCount = 0;
    for (const [d, n] of diffs) { if (n > maxCount) { maxCount = n; intervalMs = d; } }
    if (intervalMs > 0) {
      for (let i = 1; i < candles.length; i++) {
        const diff = candles[i].openTimeMs - candles[i - 1].openTimeMs;
        if (diff > intervalMs) {
          const missing = Math.round(diff / intervalMs) - 1;
          if (missing > 0) {
            gaps.push({ fromMs: candles[i - 1].openTimeMs, toMs: candles[i].openTimeMs, missingBars: missing });
            gapCount += missing;
          }
        }
      }
    }
  }
  return { candles, duplicatesRemoved, gaps, gapCount };
}

export function validateCandle(c: Candle): string[] {
  const errors: string[] = [];
  const o = Number(c.open), h = Number(c.high), l = Number(c.low), cl = Number(c.close), v = Number(c.volume);
  if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(cl) || !Number.isFinite(v)) errors.push("non-finite");
  if (o <= 0 || h <= 0 || l <= 0 || cl <= 0) errors.push("non-positive price");
  if (v < 0) errors.push("negative volume");
  if (h < Math.max(o, cl, l)) errors.push("high < max(o,c,l)");
  if (l > Math.min(o, cl, h)) errors.push("low > min(o,c,h)");
  return errors;
}

export function validateAll(candles: Candle[]): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const c of candles) {
    for (const e of validateCandle(c)) errors.push(`${c.openTimeMs}: ${e}`);
    if (seen.has(c.openTimeMs)) errors.push(`${c.openTimeMs}: duplicate openTime`);
    seen.add(c.openTimeMs);
  }
  // monotonic
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].openTimeMs <= candles[i - 1].openTimeMs) errors.push(`non-increasing timestamp at ${candles[i].openTimeMs}`);
  }
  return errors;
}

export async function sha256Json(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildDatasetManifest(input: {
  env: EnvName;
  symbol: string;
  interval: string;
  priceType: "last" | "mark" | "index";
  candles: Candle[];
  rawPageHashes: string[];
  gaps: DataGap[];
  gapCount: number;
  downloadedAt: string;
}): Promise<DatasetManifest> {
  const startMs = input.candles.length ? input.candles[0].openTimeMs : 0;
  const endMs = input.candles.length ? input.candles[input.candles.length - 1].openTimeMs : 0;
  const normalizedHash = await sha256Json(input.candles);
  return {
    source: "strike",
    env: input.env,
    symbol: input.symbol,
    interval: input.interval,
    priceType: input.priceType,
    startMs,
    endMs,
    downloadedAt: input.downloadedAt,
    schemaVersion: "strike-klines-1.0",
    rawHash: input.rawPageHashes.join(":"),
    normalizedHash,
    sha256: normalizedHash,
    rawPageHashes: input.rawPageHashes,
    gapCount: input.gapCount,
    gaps: input.gaps,
    barCount: input.candles.length,
    dataKind: "ohlcv",
    provenance: "Strike REST /price/v2/klines (see docs/STRIKE-SKILL-LOCK.md)",
  };
}

import { fetchKlines, type KlineBar } from "@nultra/strike-client";

export interface IngestResult {
  candles: Candle[];
  manifest: DatasetManifest;
  pages: number;
  duplicatesRemoved: number;
  gapCount: number;
}

export async function ingestHistoricalKlines(input: {
  env: EnvName;
  symbol: string;
  interval: string;
  startMs: number;
  endMs: number;
  priceType?: "last" | "mark" | "index";
}): Promise<IngestResult> {
  if (input.startMs >= input.endMs) throw new Error("startMs must be < endMs");
  const allRows: unknown[] = [];
  const seenPageFirst = new Set<number>();
  let cursor = input.endMs;
  let pages = 0;
  const maxPages = 1000;
  while (pages < maxPages) {
    const bars = await fetchKlines(input.env, input.symbol, input.interval, {
      limit: 1500,
      endTime: cursor,
      priceType: input.priceType ?? "last",
    });
    if (!bars || bars.length === 0) break;
    // advancement check: first bar openTime must be <= cursor
    const firstOpen = bars[0].openTime;
    if (seenPageFirst.has(firstOpen)) throw new Error("pagination did not advance (possible ignored endTime)");
    seenPageFirst.add(firstOpen);
    allRows.push(...bars.map((b: KlineBar) => [
      b.openTime, b.open, b.high, b.low, b.close, b.volume, b.closeTime, b.quoteVolume, b.trades, b.takerBuyBase, b.takerBuyQuote, "0",
    ]));
    pages++;
    const oldest = bars[0].openTime;
    if (oldest <= input.startMs) break;
    const nextCursor = oldest - 1;
    if (nextCursor >= cursor) throw new Error("pagination cursor did not move backwards");
    cursor = nextCursor;
  }
  if (pages === 0) throw new Error("no data returned");
  const canon = canonicalizeKlines(allRows);
  // trim to requested range
  const trimmed = canon.candles.filter((c) => c.openTimeMs >= input.startMs && c.openTimeMs <= input.endMs);
  if (trimmed.length === 0) throw new Error("no candles in requested range");
  const manifest = await buildDatasetManifest({
    env: input.env,
    symbol: input.symbol,
    interval: input.interval,
    priceType: input.priceType ?? "last",
    candles: trimmed,
    rawPageHashes: [],
    gaps: canon.gaps,
    gapCount: canon.gapCount,
    downloadedAt: new Date().toISOString(),
  });
  return {
    candles: trimmed,
    manifest,
    pages,
    duplicatesRemoved: canon.duplicatesRemoved,
    gapCount: canon.gapCount,
  };
}

export { parseKlineRow } from "@nultra/strike-client";
