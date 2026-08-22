"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, transitionInOut } from "@/lib/motion";
import { getSignal, ApiError, type SignalResponse } from "@/lib/api";
import { SignalCard } from "@/components/signal-card";
import { HorizonCard } from "@/components/horizon-card";

export default function SignalPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [data, setData] = useState<SignalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    // The textbook exception this rule documents: a loading flag for a
    // fetch-on-dependency-change effect, guarded by the `ignore` cleanup
    // below so a stale request can never overwrite a newer one's state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getSignal(symbol)
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
  }, [symbol]);

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
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Get signal
        </button>
      </motion.div>

      {loading && <p className="text-sm text-text-muted">Reading {symbol}&hellip;</p>}

      {error && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-down">
          {error}
        </p>
      )}

      {data && !loading && !error && (
        <div className="space-y-6">
          <SignalCard verdict={data.verdict} />

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
