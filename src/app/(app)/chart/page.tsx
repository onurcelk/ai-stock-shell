"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";
import { getOhlcv, ApiError, type OhlcvResponse } from "@/lib/api";
import { CandlestickChart } from "@/components/candlestick-chart";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "5y"];

export default function ChartPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [data, setData] = useState<OhlcvResponse | null>(null);
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

    getOhlcv(symbol, period)
      .then((response) => {
        if (!ignore) setData(response);
      })
      .catch((err) => {
        if (ignore) return;
        setData(null);
        setError(err instanceof ApiError ? err.message : "Could not reach the chart API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [symbol, period]);

  const lastBar = data?.bars[data.bars.length - 1];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionInOut}
        className="mb-6 flex flex-wrap items-center gap-3"
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
          Load
        </button>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                p === period
                  ? "bg-surface-raised text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </motion.div>

      {loading && <p className="text-sm text-text-muted">Loading {symbol}&hellip;</p>}
      {error && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-down">
          {error}
        </p>
      )}

      {data && !loading && !error && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-2xl text-text">{data.symbol}</p>
            {lastBar && (
              <p className="font-mono text-2xl text-text">{lastBar.close.toFixed(2)}</p>
            )}
          </div>
          <CandlestickChart bars={data.bars} />
        </div>
      )}
    </main>
  );
}
