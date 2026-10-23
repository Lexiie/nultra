# Strike API contracts — tested evidence vs assumptions
## Documentation / source references
- Official docs: https://docs.strikefinance.org/
- API overview: https://docs.strikefinance.org/api
- Market WS docs: https://docs.strikefinance.org/api/market/websocket
- Official code: https://github.com/strike-finance/strike-builder-reference
- Official skills: https://github.com/strike-finance/strike-finance-skills
- Raw evidence: `evidence/strike-mainnet.zip`, `evidence/strike-testnet.zip` (included with this package).

## Base URLs observed in uploaded validation script
- Mainnet `https://api.strikefinance.org`
- Testnet `https://api-v2-testnet.strikefinance.org`

## MVP required endpoints (observed HTTP 200 in user's October 23 audit)
| Method/path | Purpose | MVP use |
|---|---|---|
| GET `/v2/time` | server clock | clock skew check |
| GET `/v2/markets` | symbol metadata, min sizes, price tick, margin tiers, mark/index/funding fields | market selector and constraints |
| GET `/price/v2/exchangeInfo` | exchange market info | cross-check metadata |
| GET `/price/v2/klines?symbol=BTC-USD&interval=1h&limit=100` | candles | P0 ingestion |
| GET `/price/v2/depth?symbol=BTC-USD&limit=20` | depth snapshot | optional research/diagnostics; not historical |
| GET `/price/v2/trades?symbol=BTC-USD&limit=100` | recent trades | optional; verify path from script before use |
| GET `/v2/l3/snapshot` | L3 snapshot | P1 exploratory only |

## Additional probed market endpoints
`/price/v2/ticker/price`, `/price/v2/ticker/bookTicker`, `/price/v2/ticker/24hr`, `/price/v2/premiumIndex`, `/price/v2/markPrice`, `/price/v2/indexPrice`, `/price/v2/openInterest` — see actual `strike_validate.py` for authoritative exact query names; not all needed by MVP.

## Historical query validation
Probe used `startTime` / `endTime` in epoch milliseconds and `limit=100`. HTTP 200 alone does **not** prove reliable full-range pagination or history coverage. Implement two-page test: query adjacent non-overlapping windows, confirm timestamps change, ordering and boundaries, detect ignored params, overlaps and gaps. Do not infer full-year coverage from a 365-day-old `startTime` request.

## WebSocket
`wss://api.strikefinance.org/ws/price` timed out in supplied probe; **unverified**. Mainnet/testnet WS are not MVP dependencies. Never mark live streaming as tested.

## Contract rules
Parse JSON using runtime schemas, inspect actual evidence before choosing candle response shape; fail closed on unknown schema. Retry 429/5xx with bounded exponential backoff; do not retry 4xx blindly. Cache immutable windows, preserve UTC milliseconds and exact raw response checksum. Rate limits are not established; be conservative.

## Fee and funding caveat
Markets metadata includes funding fields, but a current funding value is NOT historical funding history. Trading fee tier/commission must be verified independently; until then label user-entered fee assumptions as estimates. Funding-sensitive strategies must be excluded from P0 unless historical funding can be reconstructed reliably.

## v3.0 source lock and integration gate
Follow `13-STRIKE-AGENT-SKILLS.md`. Before using an endpoint, capture official skill/docs version, actual JSON fixture, runtime schema and contract test. Historical pagination and fee tiers remain unverified until explicitly proven. Economic calculations must follow `15-STRIKE-EXECUTION-ECONOMICS.md`; **do not treat current funding fields as historical series**.
