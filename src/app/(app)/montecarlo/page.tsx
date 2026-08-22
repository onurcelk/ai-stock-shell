"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import { getMonteCarlo, ApiError, type MonteCarloResponse } from "@/lib/api";
import { FanChart, EndingsHistogram } from "@/components/fan-chart";

const money = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MonteCarloPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [days, setDays] = useState(30);
  const [simulations, setSimulations] = useState(200);
  const [seed, setSeed] = useState<number | null>(42);

  const [data, setData] = useState<MonteCarloResponse | null>(null);
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

    getMonteCarlo(symbol, { days, simulations, seed })
      .then((response) => {
        if (!ignore) setData(response);
      })
      .catch((err) => {
        if (ignore) return;
        setData(null);
        setError(err instanceof ApiError ? err.message : "Could not reach the API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [symbol, days, simulations, seed]);

  const summary = data?.summary;
  const movePct = summary && data ? (summary.median / data.last_price - 1) * 100 : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Monte Carlo</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Projects the series forward as a random walk on its own historic drift and
        volatility. It describes a range of outcomes, not a prediction — and the
        range is only as good as the assumption that the past distribution holds.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSymbol(inputValue);
        }}
        className="mt-8 flex gap-2"
      >
        {/* `min-w-0` is what lets the input actually shrink: a flex item
            defaults to min-width:auto and refuses to go below its content,
            which pushed the button past the viewport at 390px. */}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          aria-label="Symbol"
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-base text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
          placeholder="Symbol"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Simulate
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Days ahead</span>
          <span className="ml-2 font-mono text-sm text-text">{days}</span>
          <input
            type="range"
            min={5}
            max={252}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>

        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Paths</span>
          <span className="ml-2 font-mono text-sm text-text">{simulations}</span>
          <input
            type="range"
            min={20}
            max={2000}
            step={20}
            value={simulations}
            onChange={(e) => setSimulations(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={seed !== null}
              onChange={(e) => setSeed(e.target.checked ? 42 : null)}
              className="accent-[var(--accent)]"
            />
            Reproducible
          </label>
          <input
            type="number"
            min={0}
            max={9999}
            value={seed ?? ""}
            disabled={seed === null}
            onChange={(e) => setSeed(Number(e.target.value))}
            aria-label="Seed"
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent disabled:text-text-faint"
          />
        </div>
      </div>

      {loading && <p className="mt-10 text-base text-text-muted">Simulating…</p>}
      {error && <p className="mt-10 text-base text-down">{error}</p>}

      {data && summary && !loading && (
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="show"
          className="mt-10 space-y-6"
        >
          <motion.div
            variants={staggerItem}
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          >
            {[
              { label: "Start price", value: money(data.last_price) },
              {
                label: "Median outcome",
                value: money(summary.median),
                note: `${movePct >= 0 ? "+" : ""}${movePct.toFixed(1)}%`,
              },
              { label: "5th percentile", value: money(summary.p5) },
              { label: "95th percentile", value: money(summary.p95) },
              { label: "Ended higher", value: `${summary.prob_up.toFixed(0)}%` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <p className="text-sm text-text-muted">{stat.label}</p>
                <p className="mt-1 font-mono text-lg text-text">{stat.value}</p>
                {stat.note && (
                  <p className="mt-0.5 font-mono text-sm text-text-faint">{stat.note}</p>
                )}
              </div>
            ))}
          </motion.div>

          <motion.div
            variants={staggerItem}
            transition={transitionInOut}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base text-text">Simulated paths</h2>
              <p className="font-mono text-sm text-text-faint">
                {data.paths_drawn} of {data.simulations} drawn · 5–95 band
              </p>
            </div>
            <div className="mt-4">
              <FanChart
                paths={data.paths}
                median={data.median_path}
                low={data.p5_path}
                high={data.p95_path}
                startPrice={data.last_price}
              />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Only a sample of paths is drawn — the band and the median are computed
              across all {data.simulations.toLocaleString()}.
            </p>
          </motion.div>

          <motion.div
            variants={staggerItem}
            transition={transitionInOut}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base text-text">Where they finished</h2>
              <p className="font-mono text-sm text-text-faint">
                after {data.days} bars
              </p>
            </div>
            <div className="mt-4">
              <EndingsHistogram
                edges={data.histogram.edges}
                counts={data.histogram.counts}
                startPrice={data.last_price}
              />
            </div>
            <div className="mt-3 flex justify-between font-mono text-sm text-text-faint">
              <span>{money(data.histogram.edges[0])}</span>
              <span>
                dashed line: start at {money(data.last_price)}
              </span>
              <span>{money(data.histogram.edges[data.histogram.edges.length - 1])}</span>
            </div>
          </motion.div>

          <motion.p variants={staggerItem} className="text-sm text-text-faint">
            Daily volatility {(data.daily_volatility * 100).toFixed(2)}% · drift{" "}
            {(data.drift * 100).toFixed(3)}% per bar
            {data.seed !== null && ` · seed ${data.seed}`}
          </motion.p>
        </motion.div>
      )}
    </main>
  );
}
