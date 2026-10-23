# Risk register and decision log
| Risk | Impact | Mitigation |
|---|---|---|
| API HTTP 200 but ignores pagination | Invalid history | timestamp advancement assertions and overlapping-page tests |
| Insufficient data | Weak OOS evidence | show insufficient data; smaller research claim; no invented history |
| Data snooping / repeated holdout | False alpha | immutable sealed holdout; experiment lineage |
| No historical orderbook | Microstructure claim invalid | keep P1 recorder separate; OHLCV features only in MVP |
| Incorrect fee schedule | Inflated ROI | configurable costs, conservative stress, explicit estimate label |
| WebSocket timeout | P1 blocked | do not depend on WS for P0 |
| Runtime CPU/RAM | Crash | bounded candidate budget, browser worker, cancellation |
| Deadline | Incomplete submission | prioritize M0-M5 core over extra features |
| No profitable strategies | Demo ambiguity | rejection is first-class output |

## Decisions already locked
Historical Profit Discovery approach A; combined Edge Miner + future Microstructure Alpha; Strike-powered; no live trading; reproducibility and no-lookahead mandatory.

## Decisions requiring evidence
Exact OHLCV response schema and pagination, actual fee tier, max historical range, feasible dataset size, whether leverage/funding simulation can be accurate. Default to documented limitation if unresolved.

## Positioning decision (locked)
Project renamed **Nultra**. Category **Profit Intelligence Engine**; primary output **Trading Opportunities**, not strategies or backtest reports. Historical OHLCV approach A is P0; microstructure L2/L3 research is a separate future phase. See doc 12.

## v3.0 locked decisions and unresolved evidence
**Locked:** P0 long/flat unleveraged price-return simulation; 10% available equity sizing; cost defaults explicitly estimates; no historical funding; 60/20/20 split, 3 folds, 30 pre-holdout OOS / 10 holdout completed trades, 2× cost stress, >=50% neighbor stability; validation ranking; no composite score; no L2/L3 runtime. See docs 14–16.
**Evidence required:** Strike fee tier and market instrument semantics, exact skill names/commit/license, historical klines pagination/coverage, market metadata quantity steps, historical funding availability. Missing evidence cannot be silently assumed.
