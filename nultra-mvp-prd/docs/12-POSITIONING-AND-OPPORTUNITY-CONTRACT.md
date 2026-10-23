# Nultra positioning & opportunity contract (normative)
## Brand
Nultra — **Profit Intelligence Engine**. Tagline: **Discover the edge. Capture the opportunity.**

## Non-negotiable distinction
Generic backtester: user supplies strategy → platform tests it.  
**Nultra:** user selects market → system searches predefined hypotheses → constructs strategies → evaluates net profitability → validates → presents **ranked trading opportunities** with evidence.

## Product hierarchy
1. **Trading Opportunity** = primary domain object and primary UI card.
2. **Hypothesis** = testable mechanism, not established market inefficiency.
3. **Strategy** = executable entry/exit/risk rule set generated to test a hypothesis.
4. **Backtest** = measurement tool, not product identity.
5. **Validation** = guardrail and evidence, not the hero headline.

## MVP hypothesis families
- Momentum continuation from past close-to-close returns and trend filter.
- Mean reversion from trailing price deviation/z-score.
- Volatility expansion from historical range and realized volatility.
- Volume-price divergence only if volume semantics are confirmed; otherwise deferred.
No L2/L3 claims using OHLCV. Recorded orderflow (L2/L3) is P1 after actual ingestion and replay validation.

## Discovery / ranking requirements
The system proposes candidate rules automatically from bounded parameter grids; no manual strategy specification needed. The leaderboard is **Opportunity Explorer**, with `hypothesis`, `estimated net OOS return`, `net expectancy`, `max drawdown`, `trade count`, `robustness`, `cost sensitivity`, `verdict`. A composite Opportunity Score may be displayed only if transparent, deterministic, versioned and never labeled probability of profit; not required P0.

## Verdict semantics
`CANDIDATE — HISTORICAL ONLY` = passes defined research gates, NOT live-verified. `REJECTED` = fails gate. `INSUFFICIENT DATA` = inadequate coverage/sample. `NO ROBUST EDGE` = no candidate passes. The app must never fabricate a positive winner for the demo.

## Messaging for agent
Hero: `Find potential trading opportunities hidden in Strike market data.`  
Subheading: `Nultra automatically discovers, constructs and stress-tests trading strategies for estimated net profitability.`  
CTA: `Discover Opportunities`.  
Avoid `Backtest your strategy` as main CTA, `AI predicts profit`, or claims of live microstructure alpha in MVP.

## Boundary
Brand positioning is profit-first; research methodology is evidence-first. Both must be true. Opportunity discovery is bounded hypothesis search, not unconstrained AI discovery. The user's profit is never promised.

## v3.0 profit-claim accuracy
For P0 perpetual markets, `net` means **net of modeled entry/exit fees, spread and slippage only; historical funding excluded**. Display this beside returns and opportunity ranking. A passing historical candidate is not an actionable live execution recommendation. Use validation ranking, never retune against sealed holdout (docs 14–15).
