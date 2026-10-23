# M1 — Historical data pipeline
## Inputs / outputs
Input: environment, symbol, timeframe, UTC start/end, page limit. Output: canonical candles `{openTimeMs,open,high,low,close,volume}` with decimal-safe parsing; dataset metadata `{source,downloadedAt,range,interval,sha256,rawPageHashes,gapCount}`.

## Algorithm
Fetch market metadata → fetch pages → validate returned timestamps are in requested range and move between pages → dedupe exact duplicates (record count) → reject conflicting duplicates → sort strictly increasing → audit gaps and OHLC constraints → exclude unfinished final candle → immutable dataset hash. Handle API boundary semantics explicitly.

## Integrity checks
High >= max(open,close,low), low <= min(open,close,high), prices >0, volume >=0, finite numbers, unique open times, exact interval spacing (or documented exchange maintenance). No forward-fill for backtest P0. Data gaps: block or explicitly split eligible contiguous segments.

## Acceptance tests
Known synthetic valid data passes; malformed OHLC fails; duplicate conflicts fail; missing bar is detected; ignored `startTime` fails pagination validation; incomplete candle excluded; two identical downloads hash the same canonical data.
