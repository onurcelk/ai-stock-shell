"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import {
  ApiError,
  getBasket,
  getBasketOptions,
  type BarWindow,
  type BasketOptions,
  type BasketResult,
} from "@/lib/api";
import { LineSeries, Legend, type Series } from "@/components/series-chart";
import { DataTable } from "@/components/data-table";
import { DataWindow } from "@/components/data-window";

const number = (v: number, digits = 2) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${number(v, digits)}`;

/**
 * Line colours for the holdings drawn behind the basket.
 *
 * Deliberately not `--up`/`--down`: a holding's line is not a verdict, and
 * colouring it green would claim something about it that the chart is not
 * saying. The basket itself takes the accent so it reads on top.
 */
const MEMBER_COLORS = [
  "color-mix(in srgb, var(--text-muted) 90%, transparent)",
  "color-mix(in srgb, var(--text-muted) 70%, transparent)",
  "color-mix(in srgb, var(--text-muted) 55%, transparent)",
  "color-mix(in srgb, var(--text-muted) 45%, transparent)",
  "color-mix(in srgb, var(--text-muted) 38%, transparent)",
  "color-mix(in srgb, var(--text-muted) 32%, transparent)",
  "color-mix(in srgb, var(--text-muted) 28%, transparent)",
  "color-mix(in srgb, var(--text-muted) 24%, transparent)",
];

/** How a correlation reads as a colour: red together, blue apart. */
function correlationTone(value: number): string {
  const strength = Math.min(Math.abs(value), 1);
  const hue = value >= 0 ? "var(--down)" : "var(--accent)";
  return `color-mix(in srgb, ${hue} ${Math.round(strength * 70)}%, transparent)`;
}

export default function BasketPage() {
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT", "NVDA"]);
  const [draft, setDraft] = useState("");
  const [dataWindow, setDataWindow] = useState<BarWindow>({});
  const [options, setOptions] = useState<BasketOptions | null>(null);
  const [rebalanceEvery, setRebalanceEvery] = useState(0);
  const [initialMoney, setInitialMoney] = useState(10000);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [equalWeights, setEqualWeights] = useState(true);

  const [result, setResult] = useState<BasketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    getBasketOptions()
      .then((body) => {
        if (!ignore) setOptions(body);
      })
      .catch(() => {
        // The page still works on defaults; only the schedule list is lost.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const build = useCallback(async () => {
    if (symbols.length === 0) {
      setResult(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await getBasket(symbols, {
        ...dataWindow,
        rebalance_every: rebalanceEvery,
        initial_money: initialMoney,
        weights: equalWeights ? undefined : symbols.map((s) => weights[s] ?? 0),
      });
      setResult(body);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ApiError ? caught.message : "Could not reach the API.",
      );
    } finally {
      setLoading(false);
    }
  }, [symbols, dataWindow, rebalanceEvery, initialMoney, weights, equalWeights]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) void build();
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [build]);

  const maxHoldings = options?.max_holdings ?? 8;

  function add(symbol: string) {
    const candidate = symbol.trim().toUpperCase();
    if (!candidate || symbols.includes(candidate) || symbols.length >= maxHoldings) {
      return;
    }
    setSymbols([...symbols, candidate]);
    setWeights((w) => ({ ...w, [candidate]: 100 / (symbols.length + 1) }));
    setDraft("");
  }

  function remove(symbol: string) {
    setSymbols(symbols.filter((s) => s !== symbol));
  }

  const series: Series[] = result
    ? [
        ...result.symbols.map((symbol, index) => ({
          name: symbol,
          values: result.rebased[symbol],
          color: MEMBER_COLORS[index % MEMBER_COLORS.length],
          width: 1,
        })),
        {
          name: "Basket",
          values: result.equity,
          color: "var(--accent)",
          width: 2.5,
        },
      ]
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Basket</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Everything else here looks at one symbol at a time, which cannot answer
        the question that decides an allocation: how these behave{" "}
        <em>together</em>. Two holdings that each look strong but move in
        lockstep are one bet, not two — only the correlation shows it.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-text-faint">
        This is a hypothetical basket. It does not read or change the book on the
        Portfolio page.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            onClick={() => remove(symbol)}
            className="group flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-sm text-text transition-colors hover:border-border-hover"
            aria-label={`Remove ${symbol}`}
          >
            {symbol}
            <span className="text-text-faint group-hover:text-down">×</span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Add a symbol"
          placeholder={
            symbols.length >= maxHoldings
              ? `${maxHoldings} is the limit`
              : "Add a symbol, e.g. GOOGL or BTC-USD"
          }
          disabled={symbols.length >= maxHoldings}
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-base text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent disabled:text-text-faint"
        />
        <button
          type="submit"
          disabled={symbols.length >= maxHoldings}
          className="shrink-0 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {options && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.quick_picks
            .filter((s) => !symbols.includes(s))
            .slice(0, 8)
            .map((symbol) => (
              <button
                key={symbol}
                onClick={() => add(symbol)}
                disabled={symbols.length >= maxHoldings}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
              >
                + {symbol}
              </button>
            ))}
        </div>
      )}

      {/* A bundled CSV is one series; a basket needs several. */}
      <DataWindow value={dataWindow} onChange={setDataWindow} allowDataset={false} />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Rebalance</span>
          <select
            value={rebalanceEvery}
            onChange={(e) => setRebalanceEvery(Number(e.target.value))}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            {(options?.rebalance ?? [{ label: "Never (let it drift)", bars: 0 }]).map(
              (option) => (
                <option key={option.label} value={option.bars}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Starting cash</span>
          <input
            type="number"
            min={1}
            step={1000}
            value={initialMoney}
            onChange={(e) => setInitialMoney(Number(e.target.value))}
            aria-label="Starting cash"
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={equalWeights}
              onChange={(e) => {
                setEqualWeights(e.target.checked);
                if (!e.target.checked) {
                  const share = 100 / Math.max(symbols.length, 1);
                  setWeights(Object.fromEntries(symbols.map((s) => [s, share])));
                }
              }}
              className="accent-[var(--accent)]"
            />
            Equal weights
          </label>
          <p className="mt-1 text-xs text-text-faint">
            Uncheck to set each one. Rescaled to 100% automatically.
          </p>
        </div>
      </div>

      {!equalWeights && symbols.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {symbols.map((symbol) => (
            <label
              key={symbol}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="font-mono text-sm text-text">{symbol}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={weights[symbol] ?? 0}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [symbol]: Number(e.target.value) }))
                }
                aria-label={`${symbol} weight`}
                className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
      )}

      {loading && !result && <p className="mt-8 text-base text-text-muted">Building…</p>}
      {error && <p className="mt-8 text-base text-down">{error}</p>}
      {symbols.length === 0 && (
        <p className="mt-8 text-base text-text-muted">
          Choose at least one holding to build a basket.
        </p>
      )}

      {result && (
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="show"
          className="mt-10 space-y-6"
        >
          {Object.keys(result.skipped).length > 0 && (
            <motion.div variants={staggerItem} className="space-y-1">
              {Object.entries(result.skipped).map(([symbol, reason]) => (
                <p key={symbol} className="text-sm text-down">
                  <span className="font-mono">{symbol}</span> skipped — {reason}
                </p>
              ))}
            </motion.div>
          )}

          <motion.div
            variants={staggerItem}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {[
              {
                label: "Value",
                value: number(result.metrics.final_value, 0),
                note: signed(result.metrics.profit, 0),
                tone: result.metrics.profit >= 0 ? "text-up" : "text-down",
              },
              { label: "Return", value: `${signed(result.metrics.roi_pct)}%` },
              { label: "Volatility", value: `${number(result.metrics.volatility_pct, 1)}%` },
              { label: "Sharpe", value: number(result.metrics.sharpe) },
              {
                label: "Max drawdown",
                value: `${number(result.metrics.max_drawdown_pct, 1)}%`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <p className="text-sm text-text-muted">{stat.label}</p>
                <p className="mt-1 font-mono text-lg text-text">{stat.value}</p>
                {stat.note && (
                  <p className={`mt-0.5 font-mono text-sm ${stat.tone ?? "text-text-faint"}`}>
                    {stat.note}
                  </p>
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
              <h2 className="text-base text-text">The basket against its members</h2>
              <p className="font-mono text-sm text-text-faint">
                {result.bars} shared bars
                {result.rebalanced > 0 && ` · rebalanced ${result.rebalanced}×`}
              </p>
            </div>
            <div className="mt-4">
              <LineSeries series={series} references={[result.initial_money]} />
              <Legend series={series} />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Every line starts from the same {number(result.initial_money, 0)}, so
              the basket is readable against what it holds. The window is only where
              every member traded — a basket is not defined on a day one of them
              did not.
            </p>
          </motion.div>

          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-base text-text">Each holding on its own</h2>
            <div className="mt-4">
              <DataTable
                table={{
                  columns: Object.keys(result.per_symbol[0] ?? {}),
                  rows: result.per_symbol,
                }}
                empty="Nothing to compare yet."
              />
            </div>
          </motion.div>

          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-base text-text">Where the money ended up</h2>
            <div className="mt-4 space-y-2">
              {result.symbols.map((symbol) => {
                const target = result.weights[symbol] ?? 0;
                const final = result.final_weights[symbol] ?? 0;
                return (
                  <div key={symbol} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 font-mono text-sm text-text-muted">
                      {symbol}
                    </span>
                    <div className="relative h-5 flex-1 rounded bg-surface-raised">
                      <motion.div
                        className="h-full rounded bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${final}%` }}
                        transition={transitionInOut}
                      />
                      {/* The target, as a tick the bar is read against. */}
                      <span
                        className="absolute top-0 h-full w-px bg-down"
                        style={{ left: `${target}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right font-mono text-sm text-text-faint">
                      {number(final, 1)}% / {number(target, 1)}%
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Bar is where it ended, red tick is the target it was given.
            </p>
            {result.rebalance_every === 0 && result.drift_pct > 15 && result.heaviest && (
              <p className="mt-2 text-sm text-text-muted">
                Without rebalancing, <span className="font-mono">{result.heaviest}</span>{" "}
                has grown to {number(result.final_weights[result.heaviest], 0)}% of the
                book against a {number(result.weights[result.heaviest], 0)}% target. The
                basket is now largely a bet on one holding.
              </p>
            )}
          </motion.div>

          {result.correlation && result.diversification && (
            <motion.div
              variants={staggerItem}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base text-text">Diversification</h2>
                <p className="font-mono text-sm text-text-faint">
                  average {number(result.diversification.average)}
                </p>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                {result.diversification.verdict}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1" />
                      {result.correlation.symbols.map((symbol) => (
                        <th
                          key={symbol}
                          className="px-2 py-1 font-mono font-normal text-text-muted"
                        >
                          {symbol}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.correlation.matrix.map((row, i) => (
                      <tr key={result.correlation!.symbols[i]}>
                        <td className="px-2 py-1 font-mono text-text-muted">
                          {result.correlation!.symbols[i]}
                        </td>
                        {row.map((value, j) => (
                          <td
                            key={j}
                            className="px-2 py-1 text-center font-mono text-text"
                            style={{ background: correlationTone(value) }}
                          >
                            {value.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-text-faint">
                Correlation of returns, not of prices — price correlation mostly
                measures that both went up.
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </main>
  );
}
