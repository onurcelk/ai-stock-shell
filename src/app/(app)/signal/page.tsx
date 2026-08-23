"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, transitionInOut } from "@/lib/motion";
import { getSignal, getSources, ApiError, type SignalResponse } from "@/lib/api";
import { SignalCard } from "@/components/signal-card";
import { HorizonCard } from "@/components/horizon-card";
import { FreezeControl } from "@/components/freeze-control";

export default function SignalPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [data, setData] = useState<SignalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The offline path: read a bundled CSV instead of fetching. Kept to a
  // single select rather than the full window control, because a bundled
  // file is one fixed series -- interval and period do not apply to it.
  const [dataset, setDataset] = useState("");
  const [datasets, setDatasets] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    // The textbook exception this rule documents: a loading flag for a
    // fetch-on-dependency-change effect, guarded by the `ignore` cleanup
    // below so a stale request can never overwrite a newer one's state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getSignal(symbol, { dataset: dataset || undefined })
      .then((response) => {
        if (!ignore) setData(response);
      })
      .catch((err) => {
        if (ignore) return;
        setData(null);
        setError(err instanceof ApiError ? err.message : "Could not reach the signal API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [symbol, dataset]);

  useEffect(() => {
    let ignore = false;
    getSources()
      .then((body) => {
        if (!ignore) setDatasets(body.datasets);
      })
      .catch(() => {
        // No offline list is survivable; the live path is unaffected.
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionInOut}
        className="mb-8 flex gap-3"
      >
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") setSymbol(inputValue);
          }}
          placeholder="Symbol (e.g. AAPL)"
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 font-mono text-text outline-none transition-colors focus:border-border-hover"
        />
        <button
          onClick={() => setSymbol(inputValue)}
          disabled={Boolean(dataset)}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Get signal
        </button>
      </motion.div>

      {datasets.length > 0 && (
        <label className="mb-8 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          Or read a bundled dataset — works with no network
          <select
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
            className="rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            <option value="">Live ticker</option>
            {datasets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading && <p className="text-sm text-text-muted">Reading {symbol}&hellip;</p>}

      {error && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-down">
          {error}
        </p>
      )}

      {data && !loading && !error && (
        <div className="space-y-6">
          <SignalCard verdict={data.verdict} />

          {/* Freezing a bundled file would record a "prospective" forecast
              about bars from 2017, which the ledger's own guard refuses. So
              the control is absent offline rather than present and failing. */}
          {dataset ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-text-muted">
              Reading <span className="font-mono">{dataset}</span>. A bundled file
              ends years ago, so this reading cannot be recorded as a prospective
              forecast — switch back to a live ticker to freeze one.
            </p>
          ) : (
            <FreezeControl symbol={symbol} onFrozen={setData} />
          )}

          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {data.verdict.horizons.map((horizon) => (
              <HorizonCard key={horizon.horizon.key} horizon={horizon} />
            ))}
          </motion.div>
        </div>
      )}
    </main>
  );
}
