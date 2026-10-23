# Decisions log — Nultra MVP

## Locked (implemented)
- P0 long/flat, 1×, 10% current equity, next-open fills, estimated costs 10/5/5 bps, funding excluded.
- Split 60/20/20, 3 folds, trade floors 30/10, 2× cost stress, >=50% neighbor stability.
- Ranking by validation expectancy (no composite score).

## Deviations / notes
- Fee schedule sourced from upstream skill `/v2/fee-tiers` (default taker 5 bps) but MVP uses conservative 10 bps default per doc 15; user-adjustable.
- WebSocket unverified; P0 uses REST only.
- Web Crypto (crypto.subtle) used for manifest hashing to support browser build; Node 22 supports global crypto.
- Lint uses typescript-eslint; emitted vite config files ignored.
- Deployment executed: Cloudflare Pages live at https://nultra.pages.dev (latest https://c896053a.nultra.pages.dev).

## Outstanding evidence
- Upstream Strike skill lock SHA: 30ba679eb40538925a2cc0e2a71615812132f773.
- Real Strike smoke: 168 candles BTC-USD 1h, 0 gaps (2026-10-16 → 2026-10-23).