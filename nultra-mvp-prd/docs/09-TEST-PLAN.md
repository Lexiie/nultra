# QA and acceptance matrix
## Unit
Data canonicalization, time boundaries, candle validity, strategy indicator warm-up, order rounding, PnL, fees, spread/slippage accounting, drawdown, metrics, deterministic seed.

## Integration
Recorded Strike mainnet/testnet fixtures parse; live smoke optionally downloads <=100 bars; rate-limit/retry and timeout handling; pagination boundaries tested using controlled fake server; Web Worker cancellation.

## E2E
Select BTC-USD → download → discover → no-qualifier path → inspect result → export → import/replay. Test mobile viewport, offline API error, no gaps hidden.

## Audit artifacts
Raw fixture SHA256, dataset manifest, experiment JSON, tests report, one passing synthetic strategy, one rejected random strategy, real Strike result (which may have zero passing candidates).

## Release gates
No red tests, no live trading, no fabricated performance numbers, no unverified WS claims, complete README with known limitations.

## Positioning regression tests
- User starts discovery with only market/timeframe/cost/budget; no authored strategy required.
- Each result has hypothesis, generated rules, cost-adjusted metrics, risk and verdict.
- Default ranking is not in-sample ROI.
- No qualified opportunities produces NO ROBUST EDGE, never fabricated positive results.

## v3.0 required regression suite
- **Skill intake:** skill SHA/path map exists or explicit `NO MATCHING SKILL`; no invented upstream capability.
- **Economics:** 10% equity sizing, next-open-only, long/flat, full round-trip costs, no negative cash, rounding, missing funding label, fee monotonicity.
- **Validation:** exact 60/20/20 chronology, >=3 folds or insufficient, >=30 pre-holdout OOS trades and >=10 holdout trades, 2× costs, >=50% valid neighbors, holdout access audit and validation-only ranking.
- **Adversarial:** leakage trap, repeated seeded random walk, gap injection, duplicate candles, no winner, insufficient data, changing upstream response schema.
- **UI:** every estimated net metric says funding excluded for perps; synthetic fixture never presented as live; `NO ROBUST EDGE` path usable.
