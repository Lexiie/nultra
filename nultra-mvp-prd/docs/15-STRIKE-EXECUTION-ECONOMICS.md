# Strike execution economics — normative P0 v1

## Honest model boundary
This is a **conservative candle-based hypothetical fill model**, not actual Strike order execution. Fees, spread and slippage must be independently sourced or labeled USER/DEFAULT ESTIMATE. Current funding values do not establish historical funding rates. P0 excludes funding-dependent and leveraged strategy claims.

## Locked P0 defaults
- **Spot-like unleveraged notional simulation** (1×, no borrowing, liquidation, margin or funding); if Strike market is a perpetual, label results `SIMPLIFIED UNLEVERAGED PRICE-RETURN MODEL — FUNDING EXCLUDED`, not executable net PnL. Do not claim complete perpetual profitability. No short selling until product and market-specific margin/borrow/funding accounting is validated; P0 long/flat only.
- Initial virtual equity 10,000 USD units (accounting denomination, not wallet balance); allocate **10% of current available equity** per new entry, at most one position per symbol, no compounding while position remains open. No negative cash; reserve estimated entry cost.
- Signal on close of fully completed candle `t`; marketable taker-style fill at **open(t+1)** with adverse execution adjustment. Exit signals use same rule. No same-bar stop/target fills. Final still-open position: mark-to-market for equity, separately report unrealized PnL; do not count as completed trade or assume liquidation fill.
- Default **fee per side = 10 bps**, **half-spread per side = 5 bps**, **slippage per side = 5 bps** as **unverified configurable estimates**, not asserted Strike rates. Total adverse execution: 10 bps per side excluding fee; explicit round trip cost ~40 bps before price movement, subject to actual quantity/fee base. UI prominently labels estimates. Users may adjust values, but never quietly auto-zero them.
- Buy fill `open × (1 + (halfSpreadBps+slippageBps)/10000)`; sell fill `open × (1 − (halfSpreadBps+slippageBps)/10000)`. Fee per side = `abs(filledQuantity × fillPrice) × feeBps/10000`. Cash and position accounting must balance. Avoid applying a full spread in addition to the two half-spread adjustments.
- Respect Strike symbol tick size, quantity step and minimum size/notional when verifiably present; round quantities **down**, prices to conservative executable ticks. Missing/ambiguous market constraints => no simulated fill and explicit error, not guessed compliance.
- Missing historical funding => `FUNDING_EXCLUDED` flag in every result; prohibit unqualified 'net profitability' claims for perpetuals. Use `net of modeled fees/spread/slippage; excludes funding` as visible UI label.

## Ledger invariants
Every trade records signal bar, next-bar fill, gross notional, filled quantity, execution adjustment, fee, realized gross and net PnL, cash and equity. Mark-to-market equity uses causally available bar close. Fees on both entry and exit; never charge unrealized exit fee as realized unless explicitly estimated separately. Handle zero-trade and zero-loss metrics with `N/A` semantics rather than Infinity.

## Required tests
- Flat price + any positive costs => negative realized net PnL on completed round trip.
- Identical fixed fills/ledger: increasing fees/spread/slippage cannot increase net PnL; distinguish cost-only stress from strategy rerun.
- Next-bar-only execution, long PnL sign, no negative cash, tick/step rounding, min notional rejection, cash reconciliation, 2× stress, partial final position, missing funding disclosure.

## Upgrade gate
Before enabling shorts, leverage, funding-inclusive net PnL or real trading, verify historical funding series, margin model, order execution rules and current Strike fee tiers from authoritative docs/skills and market metadata. This is P1+, not an agent discretion item.
