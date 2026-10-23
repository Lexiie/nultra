# M0 — Technical architecture
## Proposed stack
React + TypeScript + Vite + Tailwind frontend; Cloudflare Worker for REST proxy/caching; D1 optional for experiment metadata; browser Web Worker for bounded CPU-heavy research. Avoid requiring a paid external service. Charts: Lightweight Charts or equivalent.

## Package boundaries
`packages/strike-client` (read-only transport + schemas); `packages/data-core` (canonicalization and quality); `packages/quant-core` (indicators, strategies, fills, PnL); `packages/validation` (splits and verdict); `apps/web` (UI + worker); `apps/api` (optional API proxy). No frontend components in quant-core.

## TypeScript interfaces
`MarketConfig`, `Candle`, `DatasetManifest`, `StrategyDefinition`, `Trade`, `CostAssumptions`, `BacktestResult`, `ValidationReport`, `ExperimentManifest` are shared, versioned types.

## Storage
Cache candles by `(env,symbol,interval,window,sourceHash)`; persist only small metadata/results to D1 if needed; large datasets browser IndexedDB or R2 only if required. Do not store secrets.

## Performance guardrails
Bound candidate count and candle count; progress and cancel via Web Worker; chunk processing; avoid Workers long synchronous CPU loops. Prefer client computation for MVP; verify memory on Android.

## Security
Allowlist upstream host and routes, restrict symbol/timeframe query, CORS origin policy, request timeouts, no arbitrary URL proxy, no authenticated API keys.

## v3.0 boundary
Root `AGENTS.md` is agent entrypoint. Add `FeatureProvider` seam per doc 16, but implement OHLCV only. All PnL computations run in a deterministic, independently tested pure core; UI never recalculates metrics differently. Do not require D1/remote persistence for MVP unless proven necessary.
