# M2 — Automated opportunity hypothesis search, strategy construction and backtesting
## Three P0 families
1. Momentum: rolling return threshold + trend filter.
2. Mean reversion: trailing z-score entry, neutral reversion exit.
3. Volatility breakout: trailing range breakout + volatility filter.
Each parameter grid bounded and versioned. No hidden feature optimization or external AI-generated strategies in MVP.

## Temporal rules
Indicators at bar t use only closed bars <=t; signal at close(t); earliest fill at open(t+1) plus cost. No same-bar high/low stop fills without conservative deterministic intrabar rule. No future data access. Enforce warm-up and final open position liquidation convention.

## Execution model
Position size defined as fraction of initial/current equity (choose and document); long/short support only if market metadata permits; configurable leverage with margin-aware limitations or explicitly disable leverage P0. Round to market tick/step; reject orders below minimum notional; calculate turnover, entry/exit fees, slippage, and spread without double-counting. Mark all costs estimated until verified. Optional funding: OFF unless reliable historical series.

## Metrics
Trade ledger with timestamp, direction, price, quantity, costs, realized PnL; equity curve; net return; max drawdown; profit factor (define zero-loss case); win rate; expectancy; number of trades. No annualized Sharpe on very small sample without warning.

## Determinism
Stable iteration ordering, fixed seed, stable numeric precision and rounding, engine version in every output.

## Tests
No-lookahead adversarial test; flat price with fees loses money; fees monotonic; market min-notional rejection; trade accounting balances; deterministic replay; no same-bar cheating; short/long PnL sign correctness.

## Opportunity construction (required)
Every candidate must be emitted as a testable opportunity with `hypothesisFamily`, plain-language `hypothesisExplanation`, generated `strategyRules`, parameter provenance and a unique ID. Strategy families are search templates, not the primary product object.

## v3.0 locked P0 decisions (override earlier open choices)
P0 is **long/flat, 1×, 10% current available equity**, taker-style next-open execution; use precise defaults, fee model, funding disclaimer and ledger invariants in `15-STRIKE-EXECUTION-ECONOMICS.md`. No shorts/leverage in P0. Use `16-MICROSTRUCTURE-EXTENSION-CONTRACT.md` feature-provider seam only. Strategy grid and seed must be declared before research. A candidate with no executable trades is ineligible, not profitable.
