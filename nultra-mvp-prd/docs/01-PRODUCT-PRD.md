# Nultra — Product Requirements Document (MVP)
## Product identity (LOCKED)
**Name:** Nultra  
**Category:** Profit Intelligence Engine  
**Tagline:** Discover the edge. Capture the opportunity.  
**Core promise:** Turn potential market inefficiencies into measurable trading opportunities.  
**MVP infrastructure:** Strike Finance historical market data.  
**MVP approach:** A — Historical Profit Discovery. No live orders or guaranteed returns.

## Problem
Traders must manually invent and tune strategies, often overfit historical charts, and mistake gross backtest returns for realizable profits. A generic backtester waits for the user to provide a strategy; Nultra **actively discovers candidate opportunities** and supplies evidence for or against their historical net edge.

## Product thesis
Nultra automatically explores bounded, explicitly defined market-behavior hypotheses; constructs executable strategy rules; simulates costs under Strike market constraints; and ranks **opportunities** by out-of-sample net performance and robustness. The primary user object is a **Trading Opportunity**, not a backtest configuration. Validation is a credibility layer, not the product headline.

## Jobs to be done
1. Choose a Strike market, interval and historical window; inspect data provenance and integrity.
2. Run autonomous opportunity discovery **without writing a strategy**; engine explores three predefined hypothesis families.
3. Inspect each discovered opportunity's hypothesized market mechanism, entry/exit rules, net PnL after estimated costs, risk, robustness and failure conditions.
4. Compare qualified and rejected opportunities; export reproducible research evidence.

## Core MVP experience
Market → Opportunity Discovery → Strategy Construction → Net Profit Evaluation → Walk-Forward & Sealed Holdout → Opportunity Ranking → Opportunity Inspector.

## Opportunity object (product contract)
Each opportunity MUST contain `opportunityId`, `market`, `hypothesisFamily`, `hypothesisExplanation`, `strategyRules`, `parameterSet`, `datasetManifest`, `executionAssumptions`, `trainMetrics`, `validationMetrics`, `holdoutMetrics` (if evaluated), `riskMetrics`, `robustnessChecks`, `verdict`, `rejectionReasons`, `experimentId`. Do not imply the mechanism is causally proven.

## P0 screens
- **Opportunity Discovery:** market, interval, window, dataset health, estimated costs, search budget and Start Discovery.
- **Discovery Funnel:** generated → cost-positive → validated → holdout passed; explicit rejected count and failure reasons.
- **Opportunity Explorer:** ranking by OOS net return, risk and robustness, with visible sample size and costs; no ROI-only sorting as default.
- **Opportunity Inspector:** market-behavior hypothesis, precise entry/exit rules, equity curve, trade ledger, cost assumptions, regime caveats, chronological splits, provenance.
- **Experiment Export:** reproducible JSON; deterministic rerun.

## MVP success criteria
On real Strike BTC-USD candles, a user can start discovery without authoring a strategy; see opportunities created from tested hypotheses; inspect genuine cost-adjusted OOS results and rejection reasons; reproduce an experiment; and receive `NO ROBUST EDGE` when nothing passes. No fabricated PnL.

## Explicit non-goals
User-authored strategy IDE, generic chart terminal, AI signal chatbot, live trading, wallet, social/copy trading, strategy marketplace, L2/L3 historical backtesting without recorded history, guaranteed profit. Microstructure remains the **future research direction**, not a false MVP claim.

## Truth in marketing
Use `historical opportunity`, `potential net edge`, `research-validated candidate`, `estimated costs`. Never claim `guaranteed`, `verified live profit`, or that historical candle patterns prove order-book inefficiency.
