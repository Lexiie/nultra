# Nultra — Profit Intelligence Engine
**PRD v3.0 — Implementation-Locked MVP** | Discover the edge. Capture the opportunity.

Nultra discovers potential profit opportunities from **historical Strike OHLCV**, constructs bounded systematic strategies, models transaction costs and validates opportunities chronologically. **No live execution, no guaranteed profits, no fabricated orderflow history.** For perpetuals, funding is **excluded** from P0 cost estimates and must be disclosed.

## Agent starting point
Read `AGENTS.md`, then `docs/00-AGENT-START-HERE.md`, `docs/12-POSITIONING-AND-OPPORTUNITY-CONTRACT.md`, and `docs/08-ROADMAP-AND-AGENT-TASKS.md`. Normative new contracts: `docs/13-STRIKE-AGENT-SKILLS.md`, `docs/14-STATISTICAL-VALIDATION-POLICY.md`, `docs/15-STRIKE-EXECUTION-ECONOMICS.md`, `docs/16-MICROSTRUCTURE-EXTENSION-CONTRACT.md`.

## Roadmap
M0 contracts/skills/scaffold → M1 ingestion → M2 opportunity discovery and execution simulation → M3 statistical validation → M4 Opportunity Explorer → M5 deployment/evidence. Implement one milestone per PR, with test evidence.

## Sources and caveats
`evidence/` contains earlier user-run Strike API audit results and script. HTTP 200 does not prove historical pagination or complete coverage. Official Strike skills repository is **referenced but not bundled or installed**; agent must inspect and version-lock upstream in M0. Estimated fees are illustrative, not asserted Strike rates.
