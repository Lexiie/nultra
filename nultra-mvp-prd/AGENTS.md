# Nultra — coding-agent contract (PRD v3.0)

Before touching code read `docs/00-AGENT-START-HERE.md`, `docs/12-POSITIONING-AND-OPPORTUNITY-CONTRACT.md`, `docs/08-ROADMAP-AND-AGENT-TASKS.md` and the active milestone's linked contracts. Treat `docs/14-STATISTICAL-VALIDATION-POLICY.md` and `docs/15-STRIKE-EXECUTION-ECONOMICS.md` as normative for all calculations.

## Product
Nultra is a **Profit Intelligence Engine**: Strike historical market data → automatic bounded hypothesis search → strategy construction → net-profit simulation → rigorous out-of-sample validation → ranked **Trading Opportunities**. It is NOT a user-authored generic backtester. No live trading, wallets, paper execution, invented microstructure, or guaranteed profits in P0.

## Source-of-truth and skills
Use official Strike documentation and applicable official agent skills as external reference, following `docs/13-STRIKE-AGENT-SKILLS.md`. Inspect skill contents before use; never assume a skill name, API contract, fee schedule or version. Repository code and included API evidence are verification inputs, not automatic proof of historical coverage.

## Execution discipline
Work **one milestone at a time** (M0 first). Run lint, typecheck, tests, and contract checks; report exact commands and results. Do not advance without milestone exit criteria. Freeze strategy selection before touching final holdout. Never change validation thresholds to make results pass. On uncertainty, record it in `DECISIONS.md` and fail closed. Use fixture results only when clearly marked SYNTHETIC.

## Required completion report
Milestone; changed files; assumptions; official Strike docs/skills inspected and commit/hash; tests with pass/fail output; API evidence; outstanding risks; acceptance checklist. No unsupported claims of profitability or tested WS.
