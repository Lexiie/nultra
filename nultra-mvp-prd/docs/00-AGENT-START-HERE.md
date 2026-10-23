# Agent entrypoint — Nultra MVP
**Read order:** 00 → 01 → 12 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11. Read only the relevant module in depth when implementing a milestone. Do not invent requirements.

## One-sentence mission
Autonomously discover potential **net-profitable trading opportunities**, construct testable strategies, and reject or qualify them on Strike market data with reproducible, chronological evaluation. **No live trading.**

## Non-negotiables
- Historical OHLCV discovery is P0. L2/L3 collection is future/P1, never fabricate historical microstructure from candles.
- No guaranteed profits; positive in-sample results are not proof of alpha.
- Source all market data from actual Strike REST; demo fixture must be clearly marked and never silently substituted.
- No wallet, private keys, real orders, builder fees, or user funds in MVP.
- Every result must record dataset hash, engine version, strategy parameters, fee assumptions, random seed, time ranges.
- Never access final holdout during search/tuning. A failed holdout is not a cue to retune against it.
- On insufficient data, show INSUFFICIENT DATA; on no passing candidates, show NO ROBUST EDGE.
- Read 03 for exact API evidence and unverified assumptions.

## Change control
Implement only the current roadmap milestone. Add tests before marking done. Record deviations and API uncertainty in `DECISIONS.md`; do not silently expand scope.

## Positioning guardrail
Read `12-POSITIONING-AND-OPPORTUNITY-CONTRACT.md` before any UI/domain modeling. Opportunity is primary; strategy/backtest are implementation layers. Never revert to generic strategy tester positioning.

## v3.0 normative contracts
Read root `AGENTS.md` first. Read docs 13 (Strike skills), 14 (statistical policy), 15 (execution economics), 16 (microstructure seam) before M0 design; for subsequent milestones load relevant documents. In any contradiction, these locked quantitative contracts supersede illustrative defaults in earlier docs. No silent threshold changes.
