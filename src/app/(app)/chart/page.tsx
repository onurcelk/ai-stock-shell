"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut, transitionOut } from "@/lib/motion";
import {
  getOhlcv,
  getStudies,
  getStudyCatalogue,
  getStats,
  ApiError,
  type OhlcvResponse,
  type StudiesResponse,
  type StudiesCatalogue,
  type StatsResponse,
} from "@/lib/api";
import { CandlestickChart, type Overlay } from "@/components/candlestick-chart";
import { LineSeries, Legend, type Series } from "@/components/series-chart";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "5y"];

const OSCILLATOR_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 50%, var(--text))",
  "var(--text-muted)",
];

export default function ChartPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [picked, setPicked] = useState<string[]>([]);

  const [data, setData] = useState<OhlcvResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [catalogue, setCatalogue] = useState<StudiesCatalogue | null>(null);
  const [studies, setStudies] = useState<StudiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The catalogue is static, so it is read once rather than per symbol.
  useEffect(() => {
    let ignore = false;
    getStudyCatalogue()
      .then((response) => {
        if (!ignore) setCatalogue(response);
      })
      .catch(() => {
        /* The chart works without the study picker; failing it is not fatal. */
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    // The textbook exception this rule documents: a loading flag for a
    // fetch-on-dependency-change effect, guarded by the `ignore` cleanup
    // below so a stale request can never overwrite a newer one's state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    Promise.all([getOhlcv(symbol, period), getStats(symbol, period)])
      .then(([bars, describe]) => {
        if (ignore) return;
        setData(bars);
        setStats(describe);
      })
      .catch((err) => {
        if (ignore) return;
        setData(null);
        setStats(null);
        setError(err instanceof ApiError ? err.message : "Could not reach the API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [symbol, period]);

  // Studies are asked for over the same window the chart drew, so the two
  // align bar for bar. The computation itself happens on the whole series
  // server-side and is sliced afterwards -- an indicator fitted to the window
  // on screen would change its reading every time the range changed.
  const barCount = data?.bars.length ?? 0;
  useEffect(() => {
    if (picked.length === 0 || barCount === 0) return;
    let ignore = false;

    getStudies(symbol, picked, { period, bars: barCount })
      .then((response) => {
        if (!ignore) setStudies(response);
      })
      .catch(() => {
        /* A study that will not compute leaves the chart itself intact. */
      });

    return () => {
      ignore = true;
    };
  }, [symbol, period, picked, barCount]);

  const lastBar = data?.bars[data.bars.length - 1];
  const meta = new Map(catalogue?.studies.map((s) => [s.key, s]) ?? []);

  // Derived rather than cleared in an effect: with nothing picked there is
  // nothing to draw, whatever the last response happened to hold.
  const shown = picked.length > 0 ? studies : null;

  const overlays: Overlay[] = [];
  const panes: { key: string; name: string; series: Series[]; levels: number[] }[] = [];

  if (shown) {
    for (const key of picked) {
      const study = meta.get(key);
      const computed = shown.studies[key];
      if (!study || !computed) continue;

      if (study.pane === "overlay") {
        for (const line of study.lines) {
          if (computed[line]) {
            overlays.push({
              name: study.lines.length > 1 ? `${study.name} · ${line}` : study.name,
              values: computed[line],
            });
          }
        }
      } else {
        panes.push({
          key,
          name: study.name,
          levels: study.levels,
          series: study.lines
            .filter((line) => computed[line])
            .map((line, i) => ({
              name: line.replace(/_/g, " "),
              values: computed[line],
              color: OSCILLATOR_COLORS[i % OSCILLATOR_COLORS.length],
            })),
        });
      }
    }
  }

  const toggle = (key: string) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
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
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
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

      {catalogue && (
        <motion.div
          variants={staggerContainer(0.03)}
          initial="hidden"
          animate="show"
          className="mb-6 flex flex-wrap gap-2"
        >
          {catalogue.studies.map((study) => {
            const unsupported = shown?.unsupported[study.key];
            const on = picked.includes(study.key);
            return (
              <motion.button
                key={study.key}
                variants={staggerItem}
                whileHover={{ y: -1 }}
                transition={transitionOut}
                onClick={() => toggle(study.key)}
                title={unsupported ?? study.describe}
                aria-pressed={on}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-accent bg-accent-dim text-text"
                    : "border-border text-text-muted hover:border-border-hover hover:text-text"
                } ${unsupported ? "opacity-40" : ""}`}
              >
                {study.name}
              </motion.button>
            );
          })}
        </motion.div>
      )}

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

          <CandlestickChart bars={data.bars} overlays={overlays} />

          {panes.map((pane) => (
            <motion.div
              key={pane.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitionInOut}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <h2 className="text-base text-text">{pane.name}</h2>
              <div className="mt-3">
                <LineSeries series={pane.series} references={pane.levels} />
              </div>
              <Legend series={pane.series} />
            </motion.div>
          ))}

          {shown && Object.keys(shown.unsupported).length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm text-text-muted">
                Not drawable on this series — a fact about the data, not a failure:
              </p>
              <ul className="mt-2 space-y-1">
                {Object.entries(shown.unsupported).map(([key, reason]) => (
                  <li key={key} className="text-sm text-text-faint">
                    {meta.get(key)?.name ?? key} — {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-base text-text">Key stats</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
                {[
                  ["Range high", stats.stats.high.toFixed(2)],
                  ["Range low", stats.stats.low.toFixed(2)],
                  ["Change over range", `${stats.stats.change_pct >= 0 ? "+" : ""}${stats.stats.change_pct.toFixed(2)}%`],
                  ["Ann. volatility", `${stats.stats.volatility_pct.toFixed(1)}%`],
                  ["Bars per year", stats.stats.bars_per_year.toLocaleString()],
                  ["Bars in range", stats.stats.rows.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="font-mono text-text">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-text-faint">
                {stats.stats.start} → {stats.stats.end}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
