import React, { useState } from "react";
import { ingestHistoricalKlines } from "@nultra/data-core";
import { parseMarket } from "@nultra/strike-client";

import type { TradingOpportunity } from "@nultra/shared-types";

interface Diagnostics {
  insufficientMarketData: boolean;
  insufficientTrades: number;
  failedProfitability: number;
  failedWalkForward: number;
  failedCostStress: number;
  failedNeighborStability: number;
  failedHoldout: number;
}
interface Baselines { buyAndHoldNetReturn: string; randomTimingNetReturn: string }
import type { CostAssumptions } from "@nultra/shared-types";
import DiscoveryWorker from "./discovery.worker?worker";

const defaultCosts: CostAssumptions = {
  feeBpsPerSide: 10,
  halfSpreadBpsPerSide: 5,
  slippageBpsPerSide: 5,
  fundingIncluded: false,
  source: "DEFAULT_ESTIMATE",
  label: "FUNDING_EXCLUDED",
};

export default function App() {
  const [env, setEnv] = useState<"mainnet" | "testnet">("mainnet");
  const [symbol, setSymbol] = useState("BTC-USD");
  const [interval, setInterval] = useState("1h");
  const [days, setDays] = useState(14);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const workerRef = React.useRef<Worker | null>(null);
  const [opps, setOpps] = useState<TradingOpportunity[]>([]);
  const [selected, setSelected] = useState<TradingOpportunity | null>(null);
  const [noRobustEdge, setNoRobustEdge] = useState(false);
  const [attempted, setAttempted] = useState(0);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [baselines, setBaselines] = useState<Baselines | null>(null);

  async function discover() {
    setBusy(true);
    setOpps([]);
    setSelected(null);
    setNoRobustEdge(false);
    try {
      setStatus("Fetching historical candles...");
      const end = Date.now();
      const start = end - days * 24 * 3600 * 1000;
      const ingested = await ingestHistoricalKlines({
        env,
        symbol,
        interval,
        startMs: start,
        endMs: end,
      });
      setStatus(`Ingested ${ingested.candles.length} candles (${ingested.pages} pages, ${ingested.gapCount} gaps). Loading market config...`);
      const mres = await fetch(`${env === "mainnet" ? "https://api.strikefinance.org" : "https://api-v2-testnet.strikefinance.org"}/v2/markets`);
      if (!mres.ok) throw new Error(`market metadata HTTP ${mres.status}`);
      const mjson = await mres.json() as { markets: Record<string, unknown> };
      if (!mjson.markets || !mjson.markets[symbol]) throw new Error(`no market metadata for ${symbol}`);
      const market = parseMarket(mjson.markets[symbol]);
      setStatus(`Ingested ${ingested.candles.length} candles. Running validation in worker...`);
      setProgress("Starting...");
      const worker = new DiscoveryWorker();
      workerRef.current = worker;
      const res = await new Promise<{ opportunities: TradingOpportunity[]; noRobustEdge: boolean; attempted: number; diagnostics: Diagnostics; baselines: Baselines }>((resolve, reject) => {
        worker.onmessage = (ev: MessageEvent) => {
          if (ev.data?.progress) { setProgress(ev.data.progress); return; }
          if (ev.data?.ok) resolve(ev.data.result);
          else reject(new Error(ev.data?.error ?? "worker error"));
        };
        worker.onerror = (err: ErrorEvent) => reject(new Error(err.message));
        worker.postMessage({
          candles: ingested.candles,
          market,
          costs: defaultCosts,
          seed: 42,
          datasetManifest: ingested.manifest,
          interval,
          env,
        });
      });
      worker.terminate();
      workerRef.current = null;
      setOpps(res.opportunities);
      setNoRobustEdge(res.noRobustEdge);
      setAttempted(res.attempted);
      setDiagnostics(res.diagnostics);
      setBaselines(res.baselines);
      setProgress("");
      setStatus(`Done. ${res.opportunities.filter((o: TradingOpportunity) => o.verdict === "CANDIDATE — HISTORICAL ONLY").length} qualified of ${res.attempted}.`);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      setBusy(false);
      setProgress("");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(opps, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nultra-experiment.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const qualified = opps.filter((o) => o.verdict === "CANDIDATE — HISTORICAL ONLY");

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Nultra — Profit Intelligence Engine</h1>
        <p className="text-slate-400 text-sm">Discover the edge. Capture the opportunity. Historical research only — no live trading, no guaranteed profits.</p>
      </header>

      <section className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="text-sm">Environment
            <select className="w-full mt-1 bg-slate-800 rounded p-2" value={env} onChange={(e) => setEnv(e.target.value as "mainnet" | "testnet")}>
              <option value="mainnet">mainnet</option>
              <option value="testnet">testnet</option>
            </select>
          </label>
          <label className="text-sm">Symbol
            <input className="w-full mt-1 bg-slate-800 rounded p-2" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </label>
          <label className="text-sm">Interval
            <select className="w-full mt-1 bg-slate-800 rounded p-2" value={interval} onChange={(e) => setInterval(e.target.value)}>
              {["1m", "5m", "15m", "1h", "4h", "1d"].map((iv) => <option key={iv} value={iv}>{iv}</option>)}
            </select>
          </label>
          <label className="text-sm">Days back
            <input type="number" className="w-full mt-1 bg-slate-800 rounded p-2" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </label>
          <div className="flex items-end">
            <button onClick={discover} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded p-2 font-medium">
              {busy ? "Running..." : "Discover Opportunities"}
            </button>
            {busy && (
              <button onClick={() => { if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; } setBusy(false); setProgress(""); setStatus("Cancelled."); }} className="w-full mt-2 bg-rose-700 hover:bg-rose-600 rounded p-2 font-medium">
                Cancel
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Costs: 10 bps fee + 5 bps half-spread + 5 bps slippage per side (estimated, unverified). Funding EXCLUDED for perpetuals.</p>
        {status && <p className="text-sm mt-3 text-slate-300">{status}</p>}
        {progress && <p className="text-xs mt-1 text-slate-500">{progress}</p>}
      </section>

      {opps.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Discovery Funnel</h2>
            <button onClick={exportJson} className="text-sm bg-slate-800 rounded px-3 py-1">Export JSON</button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-900 rounded p-3 border border-slate-800"><div className="text-2xl font-bold">{attempted}</div><div className="text-xs text-slate-400">candidates generated</div></div>
            <div className="bg-slate-900 rounded p-3 border border-slate-800"><div className="text-2xl font-bold">{opps.filter((o) => o.trainMetrics.tradeCount > 0).length}</div><div className="text-xs text-slate-400">with trades</div></div>
            <div className="bg-slate-900 rounded p-3 border border-slate-800"><div className="text-2xl font-bold">{qualified.length}</div><div className="text-xs text-slate-400">qualified</div></div>
            <div className="bg-slate-900 rounded p-3 border border-slate-800"><div className="text-2xl font-bold">{opps.filter((o) => o.verdict === "REJECTED").length}</div><div className="text-xs text-slate-400">rejected</div></div>
          </div>
          {noRobustEdge && <div className="bg-amber-900/40 border border-amber-700 rounded p-3 text-amber-200 text-sm">NO ROBUST EDGE — no candidate passed all gates.</div>}
          {opps.some((o) => o.verdict === "INSUFFICIENT DATA") && <div className="bg-slate-800 border border-slate-700 rounded p-3 text-slate-300 text-sm">Some candidates: INSUFFICIENT DATA.</div>}
        </section>
      )}

      {diagnostics && (
        <section className="mb-6 bg-slate-900 rounded-xl p-4 border border-slate-800">
          <h2 className="text-lg font-semibold mb-2">Diagnostics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>Insufficient market data: {String(diagnostics.insufficientMarketData)}</div>
            <div>Insufficient trades: {diagnostics.insufficientTrades}</div>
            <div>Failed profitability: {diagnostics.failedProfitability}</div>
            <div>Failed walk-forward: {diagnostics.failedWalkForward}</div>
            <div>Failed cost stress: {diagnostics.failedCostStress}</div>
            <div>Failed neighbor stability: {diagnostics.failedNeighborStability}</div>
            <div>Failed holdout: {diagnostics.failedHoldout}</div>
          </div>
          {baselines && <p className="text-xs text-slate-400 mt-2">Baseline buy-and-hold: {baselines.buyAndHoldNetReturn} · random: {baselines.randomTimingNetReturn}</p>}
        </section>
      )}

      {opps.length > 0 && (
        <section className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Opportunity Explorer</h2>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {opps.map((o) => (
                <button key={o.opportunityId} onClick={() => setSelected(o)}
                  className={`w-full text-left bg-slate-900 rounded p-3 border ${selected?.opportunityId === o.opportunityId ? "border-indigo-500" : "border-slate-800"} hover:border-slate-600`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{o.hypothesisFamily}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${o.verdict === "CANDIDATE — HISTORICAL ONLY" ? "bg-emerald-900 text-emerald-200" : o.verdict === "REJECTED" ? "bg-rose-900 text-rose-200" : "bg-slate-700 text-slate-200"}`}>{o.verdict}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">val expectancy: {o.validationMetrics.expectancy} · maxDD: {o.validationMetrics.maxDrawdown} · trades: {o.validationMetrics.completedTrades}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Opportunity Inspector</h2>
            {selected ? (
              <div className="bg-slate-900 rounded p-4 border border-slate-800 space-y-3 text-sm">
                <div><span className="text-slate-400">ID:</span> {selected.opportunityId}</div>
                <div><span className="text-slate-400">Hypothesis:</span> {selected.hypothesisExplanation}</div>
                <div><span className="text-slate-400">Rules:</span> {selected.strategyRules}</div>
                <div><span className="text-slate-400">Params:</span> {JSON.stringify(selected.parameterSet)}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 rounded p-2"><div className="text-xs text-slate-400">Train net return</div><div>{selected.trainMetrics.netReturn}</div></div>
                  <div className="bg-slate-800 rounded p-2"><div className="text-xs text-slate-400">Validation net return</div><div>{selected.validationMetrics.netReturn}</div></div>
                  <div className="bg-slate-800 rounded p-2"><div className="text-xs text-slate-400">Holdout net return</div><div>{selected.holdoutMetrics?.netReturn}</div></div>
                  <div className="bg-slate-800 rounded p-2"><div className="text-xs text-slate-400">Max drawdown (val)</div><div>{selected.validationMetrics.maxDrawdown}</div></div>
                </div>
                <div><span className="text-slate-400">Costs:</span> {selected.executionAssumptions.feeBpsPerSide}bps fee, {selected.executionAssumptions.halfSpreadBpsPerSide}bps half-spread, {selected.executionAssumptions.slippageBpsPerSide}bps slippage. {selected.executionAssumptions.label}.</div>
                <div><span className="text-slate-400">Trades (val):</span> {selected.validationMetrics.completedTrades} completed. Unrealized: {selected.validationMetrics.unrealizedPnl}.</div>
                {selected.rejectionReasons.length > 0 && <div className="text-rose-300 text-xs">Rejections: {selected.rejectionReasons.join("; ")}</div>}
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-400">Trade ledger (validation not shown; train first 5)</summary>
                  <pre className="whitespace-pre-wrap break-all mt-2">{JSON.stringify(selected.trainMetrics.trades.slice(0, 5), null, 2)}</pre>
                </details>
              </div>
            ) : (
              <div className="text-slate-500 text-sm">Select an opportunity to inspect.</div>
            )}
          </div>
        </section>
      )}

      <footer className="mt-8 text-xs text-slate-600">
        Nultra v3.0 MVP · Historical research candidate, not live alpha · Estimated costs · Funding excluded.
      </footer>
    </div>
  );
}