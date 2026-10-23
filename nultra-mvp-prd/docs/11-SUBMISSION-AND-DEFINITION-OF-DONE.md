# MVP definition of done and submission pack
## Functional DoD
User can ingest genuine Strike historical candles; audit dataset; run bounded discovery; view full rejection funnel; inspect cost-adjusted trades and holdout results; export experiment; rerun deterministically.

## Evidence DoD
Unit/integration/E2E test logs; screenshots; short video of real flow; deployed link; source repository; README with setup, assumptions, caveats, Strike endpoints, demo limitations. Do not state a deadline or prize without reconfirming official hackathon page.

## Demo script (2–3 minutes)
Select market → fetch verified dataset → show data integrity → run strategy discovery → show candidate count and rejection funnel → inspect OOS result → change costs and show impact → export reproducible manifest. Explicitly explain historical ≠ guaranteed future profit.

## Agent handoff template
`Milestone`, `Scope completed`, `Files changed`, `API evidence`, `Tests run/results`, `Known limitations`, `Next milestone`, `Scope deviations`. No silent scope creep.

## v3.0 evidence additions
Attach skill lock with upstream SHA/path/license check, actual Strike data manifest/fixtures, quantitative policy version, explicit estimated costs/funding exclusion, gate-by-gate experiment results, and screenshot of NO ROBUST EDGE / INSUFFICIENT DATA. Confirm organizer rules and deadline from official source at submission time; do not infer from old announcement.
