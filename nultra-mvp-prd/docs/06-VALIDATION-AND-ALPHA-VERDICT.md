# M3 — Statistical validation / anti-overfit
## Partition
Chronological training / validation / sealed final holdout, e.g. 60/20/20, with indicator warmup boundaries and no label overlap. Parameter search ONLY training; selection on validation; final holdout evaluated ONCE after freeze. Walk-forward folds within pre-holdout period where sample permits. No random shuffling of bars.

## Funnel
Generated → valid trades → positive train net → validation eligible → walk-forward robust → cost stress robust → sealed holdout PASS/FAIL. Display every rejection reason and denominator.

## Decision policy
Default `INSUFFICIENT_DATA` if coverage/trade count below configured threshold; `REJECTED` if net negative or robustness fails; `CANDIDATE — HISTORICAL ONLY` if all checks pass. Do not label `proven profitable` or `live validated`.

## Robustness
Test >=2x assumed costs (explicit assumption); nearby parameters; performance across non-overlapping time windows. Baseline buy-and-hold or random-timing benchmark with same exposure/cost constraints. Report multiple-testing count and uncertainty; no p-value claims without appropriate correction.

## Critical test
Random walk dataset must not systematically yield approved strategies across repeated seeded runs; a deliberate synthetic pattern should be detectable but does not establish market alpha.

## Opportunity ranking
Rank opportunities using out-of-sample **net** performance together with drawdown, trade count, robustness and cost sensitivity. Show hypothesis and failure mode. No ranking purely by in-sample ROI. Do not represent an Opportunity Score as a probability of future profit.

## v3.0 normative gate policy
`14-STATISTICAL-VALIDATION-POLICY.md` locks split, fold minimum, trade floors, cost stress, neighbor stability, freeze/holdout semantics, baselines and ranking. Never lower thresholds in response to a failed result. Rank by **validation** net expectancy (not holdout) and display holdout as one-time post-freeze audit. No composite score P0.
