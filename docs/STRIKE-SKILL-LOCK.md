# Strike Skill Lock — Nultra MVP

**Upstream repository:** https://github.com/strike-finance/strike-finance-skills
**Commit SHA:** `30ba679eb40538925a2cc0e2a71615812132f773` (shallow clone, retrieved 2026-10-23)
**License:** MIT (per upstream README)
**Install mechanism:** `npx strike-finance-skills install` (copies skill folders). Nultra does **not** install or execute upstream scripts in P0; skills are used as read-only reference. No `curl | bash`.

## Relevant skills (capabilities, not asserted filenames beyond actual paths)

| Capability | Upstream path | Nultra milestone | Notes |
|---|---|---|---|
| Klines / candles | `skills/strike-klines/SKILL.md` | M0, M1, M2 | REST `/price/v2/klines`, intervals, pagination semantics, gap fill, WS klines (P1) |
| Market data overview | `skills/strike-market-data/SKILL.md` | M0, M1, M4 | Base URLs, endpoint list, errors, caching, exchange info, markets, depth, trades, sparklines, OI |
| Calculations (fees, tiers, funding) | `skills/strike-calculations/SKILL.md` | M0, M2, M3 | Fee tiers, margin tiers, funding formula, liquidation (P1) |
| Account / markets config | `skills/strike-account/SKILL.md` | M0, M1, M2 | `/v2/markets`, `/v2/markets/:symbol`, `/v2/fee-tiers`, server time |
| History | `skills/strike-history/SKILL.md` | P1 only | Positions/order/fill/funding history; not P0 |
| Price feeds (WS) | `skills/strike-price-feeds/SKILL.md` | P1 only | Public WS; unverified in supplied probe |
| Orderbook | `skills/strike-orderbook/SKILL.md` | P1 only | L2/L3; no historical claim in P0 |
| Trades (WS) | `skills/strike-trades/SKILL.md` | P1 only | Real-time trades |
| Auth / trading / deposit / withdraw / bots / copy / rfq / vaults | `skills/strike-*` | Excluded P0 | No wallets, orders, or user funds in MVP |

If no matching skill exists for a capability, official API docs + recorded evidence are used and `NO MATCHING SKILL` is stated. (All P0 capabilities above have matching skills.)

## Endpoint → skill → evidence → schema mapping (P0)

| Endpoint | Skill | Evidence fixture | Runtime schema | Test |
|---|---|---|---|---|
| `GET /v2/time` | strike-account / strike-market-data | `evidence/strike-mainnet.zip` → `server_time.json` | `ServerTime { serverTime: number }` | clock skew / parse |
| `GET /v2/markets` | strike-account / strike-calculations | `markets.json` | `MarketsResponse { markets: Record<symbol, Market> }` | parse BTC-USD, constraints |
| `GET /v2/markets/:symbol` | strike-account | live probe (2026-10-23) | `Market` | parse constraints |
| `GET /price/v2/exchangeInfo` | strike-market-data | `exchange_info.json` | `ExchangeInfo { timezone, serverTime, rateLimits, symbols[] }` | parse BTC-USD filters |
| `GET /price/v2/klines` | strike-klines | `klines_1h.json`, `klines_start_*` | `KlineRow = [number,string×4,string,number,string,number,string,string,string]` (12 cols) | parse, pagination, gaps, OHLC |
| `GET /price/v2/depth` | strike-market-data | `depth_20.json` | `Depth { lastUpdateId, E, T, bids:[string,string][], asks:... }` | parse |
| `GET /price/v2/trades` | strike-market-data | `trades_recent.json` | `Trade { id, price, qty, quoteQty, time, isBuyerMaker }` | parse |
| `GET /price/v2/ticker/price` | strike-market-data | `ticker_price.json` | `TickerPrice { symbol, price, time }` | parse |
| `GET /price/v2/ticker/bookTicker` | strike-market-data | `book_ticker.json` | `BookTicker { symbol, bidPrice, bidQty, askPrice, askQty, time }` | parse |
| `GET /price/v2/depth`, `/price/v2/trades` | strike-market-data | as above | same | optional diagnostics only |
| `GET /v2/fee-tiers` | strike-calculations / strike-account | live probe (2026-10-23) | `FeeTiers { feeTiers: { Tier, MinVolume, TakerRate, MakerRate }[] }` | parse default tier |
| `GET /v2/l3/snapshot` | strike-orderbook | `l3_snapshot_exploratory.json` | exploratory | P1 only; not P0 dependency |

## Verified facts from upstream skills + live probe (2026-10-23)

- Base URLs: mainnet `https://api.strikefinance.org` (REST auth/account/trading) and `https://api.strikefinance.org/price` (market data); testnet `https://api-v2-testnet.strikefinance.org` / `.../price`.
- Klines: intervals `1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h 1d 3d 1w 1M`; default limit 500, max 1500; `startTime`/`endTime` ms; gap-filled flat candles; `priceType` last/mark/index.
- `startTime`-only queries can return a seed candle with `openTime < startTime`; drop rows below strict bound.
- `endTime`-only queries anchor at `endTime` and gap-fill forward; drop rows with `openTime < startTime` if a strict lower bound is needed.
- exchangeInfo is cached (non-expiring); `serverTime` is cache-fill time, not current clock. Use `/v2/time` for clock skew.
- `/price/v2/exchangeInfo` does **not** carry margin tiers; `/v2/markets` (and `/v2/markets/:symbol`) does.
- Fee tiers public endpoint: `GET /v2/fee-tiers` returns tiered rates (default tier 0: taker 5 bps, maker -0.5 bps). Access may require a browser-like `User-Agent` (default urllib UA returned 403 in probe; browser UA returned 200). Treat as estimate until account-specific tier verified.
- Historical funding: `/v2/markets` exposes current `funding_rate` and `next_funding_time` only; no historical funding series. P0 excludes funding-dependent claims (`FUNDING_EXCLUDED`).
- WebSocket (`wss://.../ws/price`) timed out in supplied probe → **unverified**; not a P0 dependency.
- L2/L3 (`/v2/l3/snapshot`, `/ws/l3`) = P1 exploratory only; never fabricate historical microstructure from candles.

## Explicitly excluded from P0 (per PRD + skill scope)
No live trading, wallets, private keys, builder fees, leverage, shorts, funding-inclusive net PnL, L2/L3 historical backtesting, real orders. P0 is long/flat, 1×, 10% current equity, next-open fills, estimated costs, OHLCV only.

## Open uncertainties (record in DECISIONS.md when implementing)
- Exact Strike fee tier for an anonymous/research account (use configurable default 10 bps/side per doc 15, stress 2×).
- Maximum reliable historical range / pagination coverage (must prove non-overlap).
- Market metadata quantity steps/tick sizes per symbol (use `/v2/markets` + `/price/v2/exchangeInfo` filters; fail closed if ambiguous).
- Whether `startTime` ignored in some windows (assert timestamp advancement).
