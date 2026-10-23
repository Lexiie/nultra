# Microstructure extension seam — interface only in P0

Nultra combines historical Edge Miner now and Microstructure Alpha later. **Do not** build a live L2/L3 collector, websocket listener, orderflow signals, paper trading or execution in P0.

## Minimal forward-compatible interfaces
`MarketDatasetManifest { source:'strike', symbol, timeRange, dataKind:'ohlcv', schemaVersion, rawHash, normalizedHash, interval, gaps, provenance }`
`FeatureProvider { id, version, supportedDataKinds, compute(dataset, asOfTime): causal features }`
`OpportunityHypothesis { id, family, requiredFeatures, parameterGridVersion, generateRules }`

For P0, implement only `OhlcvFeatureProvider` and three existing strategy families. Feature computation cannot see events after `asOfTime`. Do not force a universal raw event format onto candles. The P1 design can add `orderbook-l2`, `orderbook-l3`, and `trades` data kinds and capture metadata without modifying opportunity verdict semantics.

## Future research (not MVP acceptance)
Record timestamped exchange sequence IDs and receive timestamps, snapshot+delta reconciliation, resync on gaps, deterministic replay, market-specific latency and queue-position assumptions, survivorship checks. Never derive historical order book imbalance from OHLCV or claim historical L3 exists based on a current snapshot endpoint.

## P0 acceptance
Interface compiles; OHLCV provider implements it; synthetic future provider can be stubbed in unit tests **without building live infrastructure**. All UX labels accurately state OHLCV-only discovery.
