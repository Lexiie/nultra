import { validateOpportunities } from "@nultra/validation";

self.onmessage = async (e: MessageEvent) => {
  const { candles, market, costs, seed, interval, env, datasetManifest } = e.data;
  try {
    const res = validateOpportunities({
      candles,
      market,
      costs,
      seed,
      datasetManifest,
      interval,
      env,
    });
    self.postMessage({ ok: true, result: res });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};