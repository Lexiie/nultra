# Roadmap — milestone gated, MVP ONLY
## M0 — Contracts & scaffolding (first)
Tasks: inspect attached audit JSON and source script; lock exact candle schema; monorepo scaffold; lint/typecheck/test CI; shared types including `TradingOpportunity` contract from doc 12. **Exit:** contract tests parse real sample responses and all CI green.

## M1 — Data ingestion
Tasks: Strike client, market selector metadata, paginated history, integrity audit, manifest/hash, fixtures. **Exit:** real BTC-USD contiguous window downloaded; errors and ignored pagination detected; unit tests green.

## M2 — Quant core
Tasks: 3 hypothesis families → generated opportunity/strategy records, chronological fill engine, fee/slippage, market constraints, trade ledger/metrics. **Exit:** deterministic synthetic correctness suite green; no-lookahead tests green.

## M3 — Validation
Tasks: chronological splits, walk-forward, parameter search budget, sealed holdout, cost stress, opportunity verdict funnel and risk-aware ranking. **Exit:** random baseline and anti-overfit tests pass; no candidate is falsely guaranteed.

## M4 — Product UI
Tasks: dataset selector, progress/cancel, Opportunity Explorer, Opportunity Inspector, equity/trades, provenance, export. **Exit:** end-to-end real-data workflow runs in browser; all failure states visible.

## M5 — Deployment & evidence
Tasks: deploy Worker + web, smoke tests, collect demo screenshots/video, README, audit report, exact Strike integration evidence. **Exit:** publicly accessible demo; reproducible sample experiment; no mock data masquerading as real.

## P1 deferred
Live WebSocket reconnection, L2/L3 recorder, paper trading, historical microstructure after enough capture. **Not part of MVP acceptance.**

## Agent execution rule
Implement one milestone per PR. Each PR must list changed files, commands run, test results, known gaps, and evidence. Never claim a milestone complete based only on UI appearance.

## Positioning acceptance gates (all milestones)
M0: primary domain type `TradingOpportunity` exists. M2: opportunity hypotheses/rules are generated automatically, not user-authored. M3: opportunities ranked by net OOS evidence and risks. M4: `Discover Opportunities` is primary CTA, not `Backtest Strategy`; inspector shows profit mechanism and failure conditions. M5: pitch/demo starts with opportunity discovery and does not promise profits.

## v3.0 milestone gates — additions (mandatory)
- **M0:** Read and version-lock real upstream Strike skills (doc 13); map relevant skills to API fixture contracts; commit root `AGENTS.md`; freeze numeric defaults docs 14/15; define `FeatureProvider` seam doc 16. No remote skill install without review.
- **M1:** Prove non-overlapping real pagination, interval ordering, integrity, immutable manifest and explicit insufficient-history behavior; capture fee/constraint source status.
- **M2:** Implement locked long/flat execution economics, no funding claim, complete cash ledger; test flat-price loss, costs monotonicity, next-open fills and minimums. Generate TradingOpportunity automatically.
- **M3:** Implement exact gate order, 3 valid folds, trade floors, 2× cost stress, neighbor stability, sealed holdout once, validation-based rank and rejected/no-edge output. Log attempted candidate count and baseline fairness.
- **M4:** Display funding exclusion and cost provenance next to all net metrics; show uncertainty, gate-level rejection, cancel/progress and synthetic-data warning.
- **M5:** Submission evidence includes upstream skill lock, real Strike API fixture source, test output, methodology disclaimers and a real-data run even when `NO ROBUST EDGE`.

**Change control:** Any numeric policy change requires explicit PRD version bump, reason, test updates and human approval; not an agent optimization.
