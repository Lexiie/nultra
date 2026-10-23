// Read-only Strike transport + runtime schemas. No auth, no writes.

import type { Candle, EnvName, MarketConfig } from "@nultra/shared-types";

export const BASE_URLS = {
  mainnet: { rest: "https://api.strikefinance.org", market: "https://api.strikefinance.org/price", ws: "wss://api.strikefinance.org/ws/price" },
  testnet: { rest: "https://api-v2-testnet.strikefinance.org", market: "https://api-v2-testnet.strikefinance.org/price", ws: "wss://api-v2-testnet.strikefinance.org/ws/price" },
} as const;

export type KlineRow = [number, string, string, string, string, string, number, string, number, string, string, string];

export interface KlineBar {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBase: string;
  takerBuyQuote: string;
}

export function parseKlineRow(row: unknown): KlineBar {
  if (!Array.isArray(row) || row.length < 11) throw new Error("invalid kline row: expected 12-element array");
  const arr = row as unknown[];
  const openTime = arr[0] as number;
  const open = arr[1] as string;
  const high = arr[2] as string;
  const low = arr[3] as string;
  const close = arr[4] as string;
  const volume = arr[5] as string;
  const closeTime = arr[6] as number;
  const quoteVolume = arr[7] as string;
  const trades = arr[8] as number;
  const takerBuyBase = arr[9] as string;
  const takerBuyQuote = arr[10] as string;
  if (typeof openTime !== "number" || typeof closeTime !== "number") throw new Error("invalid kline row: bad timestamps");
  if (typeof trades !== "number") throw new Error("invalid kline row: bad trades");
  for (const v of [open, high, low, close, volume, quoteVolume, takerBuyBase, takerBuyQuote]) {
    if (typeof v !== "string") throw new Error("invalid kline row: non-string price/volume");
  }
  return { openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote };
}

export function parseKlines(payload: unknown): KlineBar[] {
  if (!Array.isArray(payload)) throw new Error("invalid klines response: expected array");
  return payload.map(parseKlineRow);
}

export function toCandle(bar: KlineBar): Candle {
  return {
    openTimeMs: bar.openTime,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    closeTimeMs: bar.closeTime,
    quoteVolume: bar.quoteVolume,
    trades: bar.trades,
    takerBuyBase: bar.takerBuyBase,
    takerBuyQuote: bar.takerBuyQuote,
  };
}

export interface StrikeMarketRaw {
  symbol: string;
  name?: string;
  base_asset?: string;
  baseAsset?: string;
  status?: string;
  order_tick_price?: string;
  order_min_price?: string;
  order_max_price?: string;
  order_limit_step_size?: string;
  order_limit_min_size?: string;
  order_limit_max_size?: string;
  order_market_step_size?: string;
  order_market_min_size?: string;
  order_market_max_size?: string;
  order_min_notional?: string;
  tickSize?: string;
  stepSize?: string;
  minNotional?: string;
  funding_rate?: string;
  next_funding_time?: number;
  liquidation_fee_rate?: string;
  default_leverage?: number;
  pricePrecision?: number;
  quantityPrecision?: number;
  base_prec?: number;
  quote_prec?: number;
}

export function parseMarket(raw: unknown): MarketConfig {
  const r = raw as StrikeMarketRaw;
  if (!r || typeof r.symbol !== "string") throw new Error("invalid market: missing symbol");
  const tickSize = r.order_tick_price ?? r.tickSize ?? "";
  const qtyStep = r.order_market_step_size ?? r.order_limit_step_size ?? r.stepSize ?? "";
  const minSize = r.order_market_min_size ?? r.order_limit_min_size ?? "";
  const maxSize = r.order_market_max_size ?? r.order_limit_max_size ?? "";
  const minNotional = r.order_min_notional ?? r.minNotional ?? "";
  if (!tickSize || !qtyStep || !minNotional) throw new Error(`invalid market ${r.symbol}: missing constraints`);
  return {
    symbol: r.symbol,
    baseAsset: r.base_asset ?? r.baseAsset ?? r.symbol.split("-")[0],
    quoteAsset: "USD",
    contractType: "PERPETUAL",
    status: r.status ?? "trading",
    tickSize,
    quantityStep: qtyStep,
    marketMinSize: minSize,
    marketMaxSize: maxSize,
    limitMinSize: minSize,
    limitMaxSize: maxSize,
    minNotional,
    pricePrecision: r.pricePrecision ?? r.quote_prec ?? 8,
    quantityPrecision: r.quantityPrecision ?? r.base_prec ?? 8,
    fundingRate: r.funding_rate,
    nextFundingTime: r.next_funding_time,
    liquidationFeeRate: r.liquidation_fee_rate,
    defaultLeverage: r.default_leverage,
  };
}

export interface ExchangeInfoSymbol {
  symbol: string;
  status: string;
  pricePrecision: number;
  quantityPrecision: number;
  filters: Array<{ filterType: string; [k: string]: unknown }>;
}

export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: Array<{ rateLimitType: string; interval: string; intervalNum: number; limit: number }>;
  symbols: ExchangeInfoSymbol[];
}

export function parseExchangeInfo(payload: unknown): ExchangeInfo {
  const p = payload as ExchangeInfo;
  if (!p || !Array.isArray(p.symbols)) throw new Error("invalid exchangeInfo: missing symbols");
  if (typeof p.serverTime !== "number") throw new Error("invalid exchangeInfo: bad serverTime");
  return p;
}

export interface FeeTier {
  Tier: number;
  MinVolume: number;
  TakerRate: number;
  MakerRate: number;
}

export interface FeeTiersResponse {
  feeTiers: FeeTier[];
}

export function parseFeeTiers(payload: unknown): FeeTiersResponse {
  const p = payload as FeeTiersResponse;
  if (!p || !Array.isArray(p.feeTiers)) throw new Error("invalid fee-tiers: missing feeTiers");
  return p;
}

export async function fetchJson(env: EnvName, path: string, params?: Record<string, string | number>, base: "rest" | "market" = "market"): Promise<unknown> {
  const baseStr = BASE_URLS[env][base];
  const url = new URL(baseStr + (path.startsWith("/") ? path : "/" + path));
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Convenience: fetch klines
export async function fetchKlines(env: EnvName, symbol: string, interval: string, opts: { limit?: number; startTime?: number; endTime?: number; priceType?: "last" | "mark" | "index" } = {}): Promise<KlineBar[]> {
  const params: Record<string, string | number> = { symbol, interval, limit: Math.min(opts.limit ?? 500, 1500) };
  if (opts.startTime !== undefined) params.startTime = opts.startTime;
  if (opts.endTime !== undefined) params.endTime = opts.endTime;
  if (opts.priceType) params.priceType = opts.priceType;
  // market base = .../price, path /v2/klines => .../price/v2/klines
  const payload = await fetchJson(env, "/v2/klines", params, "market");
  return parseKlines(payload);
}
