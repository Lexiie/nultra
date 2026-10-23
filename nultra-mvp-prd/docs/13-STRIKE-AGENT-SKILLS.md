# Official Strike agent skills — integration contract (P0)

## Canonical sources
- Skills repository: https://github.com/strike-finance/strike-finance-skills
- API docs: https://docs.strikefinance.org/api
- Reference implementation: https://github.com/strike-finance/strike-builder-reference
- Recorded API evidence: `evidence/strike-mainnet.zip`, `evidence/strike-testnet.zip`, `evidence/strike_validate.py`.

**Verification status:** This PRD does not bundle or claim to have installed the remote skills. Skill folder names, compatibility, and installation instructions must be inspected from the official repository during M0. Never invent a skill name or copy third-party skill content without license review.

## M0 skill intake (mandatory before coding API integration)
1. Read official repository README and directory tree; enumerate **actual** skill paths and each relevant `SKILL.md` (if present). Record upstream Git commit SHA, retrieval date, and relevant file paths in `docs/STRIKE-SKILL-LOCK.md` in implementation repository.
2. Verify license and installation mechanism from upstream. Prefer read-only referencing; install only if agent environment supports the published format. No `curl | bash` from unreviewed scripts.
3. Create a contract mapping: `Strike endpoint / response field → official documentation / skill path → real audit fixture → runtime schema → test`.
4. In conflicts, do not guess: record discrepancy, reproduce against read-only live endpoint where safe, update schema only with fixture evidence. Never prefer an old example over observed V2 payload without review.
5. Do not introduce private key / wallet / order execution skills for P0.

## Milestone routing (capabilities, not asserted skill filenames)
| Milestone | Inspect applicable upstream capability | Proof |
|---|---|---|
| M0 | V2 API, market metadata, OHLCV docs | lock SHA + endpoint/schema map |
| M1 | Historical klines, pagination, symbol/interval constraints | real response fixtures + pagination tests |
| M2 | Market tick/size rules and fee/execution conventions | constrained PnL tests + provenance |
| M3 | Historical funding availability, costs, constraints | explicit assumptions and rejection gates |
| M4 | Read-only market-data UX examples if available | live/synthetic labels + error states |
| M5 | API integration examples / attribution requirements | documented deployed read-only integration |

If no corresponding skill exists, use official API docs and state `NO MATCHING SKILL` explicitly. Re-check lock only when changing upstream version; avoid silent upgrades. Skills inform implementation, but Nultra's validation/economics policies remain authoritative unless formally revised.
