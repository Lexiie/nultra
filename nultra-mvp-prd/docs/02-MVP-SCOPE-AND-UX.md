# Scope, user flows and UX contracts
## Happy path
Select BTC-USD → choose 1h timeframe and date window → fetch & audit → configure budget (max candidates) → discover opportunities → validation funnel → inspect qualified/rejected opportunity → export JSON.

## Error states
API unavailable, rate limit, invalid schema, insufficient history, duplicate candles, missing intervals, non-monotonic timestamps, compute budget exceeded, no qualified strategy, data-source unavailable. All require explicit recoverable messaging; never auto-switch to mock data.

## UX copy rules
Use `Historical backtest`, `Estimated transaction costs`, `Out-of-sample`, `Candidate`, `Not investment advice`. Do not use `Guaranteed profit`, `Verified live returns`, or `AI predicts 90% win rate`.

## MVP defaults
BTC-USD, 1h; 3 families; bounded search budget e.g. 100-300 candidates, adjustable with runtime warning; user chooses conservative fee/slippage values until confirmed schedule is available. These are proposed defaults, not exchange facts.

## Acceptance
All metrics indicate dataset and period; disabled Run when invalid; no data causes an explicit error; rejected opportunities visible; results export and import work.

## Primary UX naming
Navigation and CTA must emphasize `Discover Opportunities`, `Opportunity Explorer`, and `Opportunity Inspector`, not `Strategy Backtester`. Every card must explain the hypothesis, strategy rules, estimated net edge and failure conditions.
