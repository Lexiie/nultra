# Statistical validation policy — normative P0 v1

## Objective and limitations
The output is a **historical research candidate**, not proof of live alpha. All numbers below are fixed MVP engineering defaults, **not universal statistical significance thresholds**. No uncorrected p-value-based claims.

## Data split and selection isolation
- Require chronologically ordered, gap-audited, fully closed bars. Default 60% train / 20% validation / 20% **sealed holdout** by timestamp; round boundaries deterministically and record them in manifest.
- Precompute features causally, with indicator warmup using prior bars only; never use later bars. Account for trades crossing boundaries: close or exclude at split boundary according to deterministic engine policy, never credit cross-boundary PnL twice. Train folds must not see validation/holdout labels or realized trade outcomes.
- Search strategy families/parameter grids on TRAIN only. Select/rank finalists using VALIDATION only. Run expanding-window walk-forward checks on the pre-holdout span with **3 folds minimum when data supports them**; each fold's optimization uses only its earlier train segment. If 3 valid folds cannot be constructed, `INSUFFICIENT_DATA` (do not silently reduce folds).
- Freeze strategy ID, parameters, fee assumptions, candidate ordering, code version and data cutoff before opening holdout. Evaluate the sealed holdout **once per frozen research run**; any later redesign creates a new research run and must disclose prior holdout exposure. Do not repeatedly retune using the same holdout.

## Candidate gates (all required)
1. Data integrity: no unhandled gaps, duplicate timestamps, partial bars, malformed OHLCV or unverified interval boundaries.
2. Minimum **30 completed trades in aggregate pre-holdout out-of-sample evaluation** AND at least **10 completed trades on sealed holdout**; additionally report trade counts per fold. These are practical floor values, not adequate proof of statistical power.
3. Validation net expectancy > 0 and validation net return > 0, with costs included.
4. At least **2 of 3** chronological walk-forward evaluation folds have positive net return; aggregate fold net expectancy > 0. More folds allowed only if frozen before search.
5. **2× fee+spread+slippage cost stress** must leave validation net expectancy > 0; maintain same fills/trade decisions for a cost-only stress test, or explicitly label any full rerun separately.
6. Neighbor stability: at least **50%** of valid one-step parameter neighbors retain positive validation net expectancy; define neighbors and excluded invalid combinations before search.
7. Holdout net expectancy > 0 and holdout net return > 0, with minimum holdout trade count. Failure => `REJECTED`, not retuning.

## Ranking (no opaque composite score P0)
Eligible candidates only; deterministic lexicographic ranking: descending holdout net expectancy, ascending holdout max drawdown, descending cost-stress expectancy, descending holdout completed-trade count, ascending stable opportunity ID. **Important:** Holdout-based ordering is descriptive post-freeze reporting only; never use it for further selection, optimization, or iterative search. For a stricter scientific leaderboard, default ranking must use validation expectancy and show holdout separately; use this stricter validation-based order for the P0 UI. No invented 0–100 Opportunity Score.

## Benchmarks and uncertainty
- Run buy-and-hold (where comparable) and at least one seeded random-timing baseline with matched gross exposure, trade count/holding-time distribution where feasible, and identical costs. Record limitations if exact matching is impossible.
- Show number of attempted candidates, search grid, selected candidates, and repeated search warning. Show per-trade distribution, sample size, and optional block-bootstrap confidence interval (if implemented, preserve temporal dependence and seed). Do not claim statistically significant alpha without a defensible multiple-testing correction.
- Report regime breakdown descriptively when supported (trend/range × high/low volatility using trailing-only labels); regime filter optimization is **not** required P0. Do not use future-defined regimes in signals.

## Verdicts
`INSUFFICIENT_DATA` if history, coverage, fold count, or trade counts are inadequate; `REJECTED` on failed quality/profit/robustness/holdout gates; `CANDIDATE — HISTORICAL ONLY` on passing all gates. Aggregate empty results => `NO ROBUST EDGE`. Every gate must emit measured value, threshold, reason, and manifest reference.
