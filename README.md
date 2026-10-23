# Nultra — Profit Intelligence Engine

PRD v3.0 implementation workspace. See `nultra-mvp-prd/` for the full PRD and `docs/STRIKE-SKILL-LOCK.md` for the upstream Strike skill lock.

## Layout
- `packages/shared-types` — shared versioned types (`TradingOpportunity`, etc.)
- `packages/strike-client` — read-only Strike transport + runtime schemas
- `packages/data-core` — canonicalization, validation, dataset manifest
- `packages/quant-core` — indicators/strategies/fills/PnL (M2)
- `packages/validation` — splits/verdict/ranking (M3)
- `apps/web` — React UI (M4)
- `apps/api` — optional Worker proxy

## Commands
- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## Status
- M0 complete: scaffold, shared types, skill lock, CI baseline.
- M1 complete: Strike client transport/schemas, canonicalization, pagination guard, real-download smoke.
- M2 complete: 3 hypothesis families, bounded grids, chronological backtest engine, metrics, opportunity discovery.
- M3 complete: 60/20/20 splits, walk-forward, cost stress, neighbor stability, verdict gates, validation ranking, baselines.
- M4 complete: Vite+React+Tailwind UI (discovery funnel, explorer, inspector, export) — production build passes.
- M5 complete: deployed at https://nultra.pages.dev (latest https://c896053a.nultra.pages.dev).