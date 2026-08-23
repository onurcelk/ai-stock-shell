"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import {
  ApiError,
  getAgentCatalogue,
  getStrategyCatalogue,
  runStrategy,
  runUploadedStrategy,
  startAgent,
  type AgentCatalogue,
  type AgentResult,
  type StrategyCatalogue,
  type BarWindow,
  type StrategyEntry,
  type StrategyResult,
} from "@/lib/api";
import { useJob } from "@/lib/use-job";
import { JobProgress } from "@/components/job-progress";
import { LineSeries, Legend, type Series } from "@/components/series-chart";
import { DataTable } from "@/components/data-table";
import { DataWindow } from "@/components/data-window";
import { CandlestickChart } from "@/components/candlestick-chart";

const number = (v: number, digits = 2) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${number(v, digits)}`;

const SIZING_LABELS: Record<string, string> = {
  fixed_units: "Fixed units",
  pct_equity: "% of equity",
  all_in: "All in",
};

const UNITS = [32, 64, 128, 256];

/**
 * What is selected in the one dropdown.
 *
 * The tab this replaces offered three kinds of thing in a single list, and so
 * does this — but only one of them trains. Which kind is selected decides
 * whether the page starts a background job or simply reads a number, so it is
 * carried explicitly rather than inferred from whether a name happens to be in
 * the RL registry.
 */
type Choice =
  | { kind: "rule" | "study"; entry: StrategyEntry }
  | { kind: "rl"; name: string };

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children: React.ReactNode;
}) {
  return (
    <label className="rounded-lg border border-border bg-surface px-4 py-3">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="ml-2 font-mono text-sm text-text">{value}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export default function AgentsPage() {
  const [inputValue, setInputValue] = useState("AAPL");
  const [symbol, setSymbol] = useState("AAPL");
  // Named `dataWindow`, not `window`: this is a client component and the DOM
  // global of that name is one typo away.
  const [dataWindow, setDataWindow] = useState<BarWindow>({});
  const [upload, setUpload] = useState<File | null>(null);

  const [agents, setAgents] = useState<AgentCatalogue | null>(null);
  const [strategies, setStrategies] = useState<StrategyCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [selected, setSelected] = useState("");

  // RL settings.
  const [iterations, setIterations] = useState(50);
  const [windowSize, setWindowSize] = useState(30);
  const [layerSize, setLayerSize] = useState(64);
  const [seed, setSeed] = useState(42);

  // Rule parameters. Seeded from the catalogue's series-scaled defaults, so
  // the arithmetic that picks them lives in one place — the API.
  const [ruleParams, setRuleParams] = useState<Record<string, number | boolean>>({});

  // Shared backtest settings: both kinds are scored on identical terms, which
  // is the only reason comparing them means anything.
  const [sizing, setSizing] = useState("fixed_units");
  const [maxBuy, setMaxBuy] = useState(1);
  const [maxSell, setMaxSell] = useState(1);
  const [sizePct, setSizePct] = useState(100);
  const [initialMoney, setInitialMoney] = useState(10000);
  const [feePct, setFeePct] = useState(0);
  const [slippagePct, setSlippagePct] = useState(0);

  const job = useJob<AgentResult>();
  const [instant, setInstant] = useState<StrategyResult | null>(null);
  const [instantError, setInstantError] = useState<string | null>(null);
  const [instantBusy, setInstantBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([getAgentCatalogue(), getStrategyCatalogue()])
      .then(([rl, instantCatalogue]) => {
        if (ignore) return;
        setAgents(rl);
        setStrategies(instantCatalogue);
        const first = instantCatalogue.rules[0];
        if (first) setSelected(`rule:${first.key}`);
      })
      .catch(() => {
        if (!ignore) setCatalogueError("Could not reach the API for the agent roster.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const choice: Choice | null = useMemo(() => {
    if (!selected) return null;
    const [group, key] = selected.split(":");
    if (group === "rl") return { kind: "rl", name: key };
    const pool = group === "rule" ? strategies?.rules : strategies?.studies;
    const entry = pool?.find((e) => e.key === key);
    return entry ? { kind: entry.kind, entry } : null;
  }, [selected, strategies]);

  const isInstant = choice !== null && choice.kind !== "rl";

  // Selecting a rule loads its own defaults; selecting an RL policy loads its
  // own iteration count. Either way the controls follow the choice rather than
  // keeping a number picked for something else.
  function chooseAgent(value: string) {
    setSelected(value);
    setInstant(null);
    setInstantError(null);
    const [group, key] = value.split(":");
    if (group === "rl") {
      const entry = agents?.agents.find((a) => a.name === key);
      if (entry?.default_iterations != null) setIterations(entry.default_iterations);
      return;
    }
    const pool = group === "rule" ? strategies?.rules : strategies?.studies;
    const entry = pool?.find((e) => e.key === key);
    const defaults: Record<string, number | boolean> = {};
    for (const param of entry?.params ?? []) defaults[param.name] = param.default;
    setRuleParams(defaults);
  }

  const scoreInstant = useCallback(async () => {
    if (!choice || choice.kind === "rl") return;
    setInstantBusy(true);
    setInstantError(null);
    const settings = {
      key: choice.entry.key,
      ...ruleParams,
      initial_money: initialMoney,
      max_buy: maxBuy,
      max_sell: maxSell,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      sizing,
      size_pct: sizePct,
    };
    try {
      // A supplied file wins over the live symbol: someone who has just chosen
      // one means to score it, and silently reading the ticker instead would
      // put a plausible number under the wrong name.
      const body = upload
        ? await runUploadedStrategy(upload, {
            ...settings,
            start: dataWindow.start,
            end: dataWindow.end,
          })
        : await runStrategy(symbol, { ...settings, ...dataWindow });
      setInstant(body);
    } catch (error) {
      setInstant(null);
      setInstantError(
        error instanceof ApiError ? error.message : "Could not reach the API.",
      );
    } finally {
      setInstantBusy(false);
    }
  }, [
    choice, symbol, dataWindow, upload, ruleParams, initialMoney, maxBuy,
    maxSell, feePct, slippagePct, sizing, sizePct,
  ]);

  // An instant strategy costs milliseconds, so it re-scores as the controls
  // move — the tab it replaces did the same, and a button would only make a
  // finished computation feel like a pending one.
  useEffect(() => {
    if (!isInstant) return;
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) void scoreInstant();
    }, 150);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [isInstant, scoreInstant]);

  const train = () => {
    if (!choice || choice.kind !== "rl") return;
    void job.start(() =>
      startAgent({
        symbol,
        agent: choice.name,
        ...dataWindow,
        iterations,
        window_size: windowSize,
        layer_size: layerSize,
        seed,
        initial_money: initialMoney,
        max_buy: maxBuy,
        max_sell: maxSell,
        fee_pct: feePct,
        slippage_pct: slippagePct,
        sizing,
        size_pct: sizePct,
      }),
    );
  };

  // One shape for the results section, whichever kind produced it.
  const shown = isInstant
    ? instant && {
        metrics: instant.metrics,
        equity: instant.equity,
        finalValue: instant.final_value,
        label: instant.label,
        trades: instant.trades,
      }
    : job.result && {
        metrics: job.result.metrics,
        equity: job.result.equity,
        finalValue: job.result.final_value,
        label: job.result.label,
        trades: null,
      };

  const equitySeries: Series[] = shown
    ? [{ name: "Agent equity", values: shown.equity, color: "var(--accent)", width: 2 }]
    : [];
  const rewardSeries: Series[] = job.result
    ? [{ name: "Policy return %", values: job.result.rewards, color: "var(--accent)", width: 2 }]
    : [];

  const rlEntry =
    choice?.kind === "rl" ? agents?.agents.find((a) => a.name === choice.name) : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Trading agents</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Three kinds of thing, one backtester. Fixed rules and the ported
        TradingView studies run instantly; the reinforcement-learning policies
        learn from the price history and train on the server first. All of them
        are scored the same way, against buy &amp; hold over the identical
        window — which is the only reason comparing them means anything.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSymbol(inputValue);
        }}
        className="mt-8 flex gap-2"
      >
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          aria-label="Symbol"
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-base text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
          placeholder="Symbol"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-hover"
        >
          Set
        </button>
      </form>

      <DataWindow
        value={dataWindow}
        onChange={setDataWindow}
        upload={upload}
        onUpload={setUpload}
      />

      {catalogueError && <p className="mt-4 text-sm text-down">{catalogueError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Agent</span>
          {/* Grouped, because the difference between these is not cosmetic:
              one kind answers in milliseconds and one takes minutes on a
              worker thread. */}
          <select
            value={selected}
            onChange={(e) => chooseAgent(e.target.value)}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            <optgroup label="Instant · fixed rules">
              {strategies?.rules.map((entry) => (
                <option key={entry.key} value={`rule:${entry.key}`}>
                  {entry.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Instant · ported studies">
              {strategies?.studies.map((entry) => (
                <option key={entry.key} value={`study:${entry.key}`}>
                  {entry.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Trains first · RL policies">
              {agents?.agents.map((a) => (
                <option key={a.name} value={`rl:${a.name}`}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Position sizing</span>
          <select
            value={sizing}
            onChange={(e) => setSizing(e.target.value)}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            {(strategies?.sizing_modes ?? agents?.sizing_modes ?? []).map((mode) => (
              <option key={mode} value={mode}>
                {SIZING_LABELS[mode] ?? mode}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* What this thing is, and what it costs to ask. */}
      {choice && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              isInstant ? "bg-accent-dim text-text" : "border border-border text-text-muted"
            }`}
          >
            {isInstant ? "Runs instantly" : "Trains on the server first"}
          </span>
          {choice.kind === "study" && (
            <span className="text-xs text-text-faint">
              Ported study · published signal
            </span>
          )}
        </div>
      )}

      {choice && choice.kind !== "rl" && (
        <p className="mt-3 text-sm text-text-faint">
          <span className="text-text-muted">The rule:</span> {choice.entry.rule}
          {choice.kind === "study" && choice.entry.source && (
            <>
              {" "}Ported from{" "}
              <code className="font-mono">agent/{choice.entry.source}</code>. It takes
              no parameters here — the study&rsquo;s published defaults are the whole
              point of trading it, and tuning them on the series you are about to
              score is how a backtest flatters itself.
            </>
          )}
        </p>
      )}

      {rlEntry?.notebook && (
        <p className="mt-3 text-sm text-text-faint">
          Ported from <code className="font-mono">agent/{rlEntry.notebook}.*.ipynb</code>.
          The learning curve scores the greedy policy on a simplified objective —
          one unit per trade, no costs — while the metrics come from the real
          backtester. The two disagreeing is the point.
        </p>
      )}

      {/* Rule parameters, rendered from the catalogue's own spec. */}
      {choice && choice.kind !== "rl" && choice.entry.params.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {choice.entry.params.map((param) =>
            param.kind === "bool" ? (
              <div
                key={param.name}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(ruleParams[param.name])}
                    onChange={(e) =>
                      setRuleParams((p) => ({ ...p, [param.name]: e.target.checked }))
                    }
                    className="accent-[var(--accent)]"
                  />
                  Follow breakouts
                </label>
                <p className="mt-1 text-xs text-text-faint">
                  Off = the notebook&rsquo;s mean-reverting version, which sells
                  strength and buys weakness. On = classic turtle.
                </p>
              </div>
            ) : (
              <Field
                key={param.name}
                label={param.describe}
                value={String(ruleParams[param.name] ?? param.default)}
              >
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  value={Number(ruleParams[param.name] ?? param.default)}
                  onChange={(e) =>
                    setRuleParams((p) => ({ ...p, [param.name]: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--accent)]"
                />
              </Field>
            ),
          )}
        </div>
      )}

      {/* RL training settings. */}
      {choice?.kind === "rl" && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Iterations" value={iterations}>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>

          <Field label="Lookback window" value={windowSize}>
            <input
              type="range"
              min={5}
              max={60}
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>

          <label className="rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-sm text-text-muted">Hidden units</span>
            <span className="ml-2 font-mono text-sm text-text">{layerSize}</span>
            <select
              value={layerSize}
              onChange={(e) => setLayerSize(Number(e.target.value))}
              className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-sm text-text-muted">Seed</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              aria-label="Seed"
              className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-text-faint">Same seed, same agent.</p>
          </div>
        </div>
      )}

      {/* Shared backtest settings. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
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

        {sizing === "fixed_units" ? (
          <>
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <span className="text-sm text-text-muted">Units per buy</span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxBuy}
                onChange={(e) => setMaxBuy(Number(e.target.value))}
                aria-label="Units per buy"
                className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
              />
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <span className="text-sm text-text-muted">Units per sell</span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxSell}
                onChange={(e) => setMaxSell(Number(e.target.value))}
                aria-label="Units per sell"
                className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
              />
            </div>
          </>
        ) : (
          <Field label="% of equity" value={sizePct}>
            <input
              type="range"
              min={1}
              max={100}
              step={5}
              value={sizePct}
              disabled={sizing === "all_in"}
              onChange={(e) => setSizePct(Number(e.target.value))}
              className="w-full accent-[var(--accent)] disabled:opacity-40"
            />
          </Field>
        )}

        <Field label="Fee %" value={feePct}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={feePct}
            onChange={(e) => setFeePct(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>

        <Field label="Slippage %" value={slippagePct}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={slippagePct}
            onChange={(e) => setSlippagePct(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>
      </div>

      {choice?.kind === "rl" && (
        <>
          <button
            onClick={train}
            disabled={job.busy}
            className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {job.busy ? "Training…" : `Train ${choice.name.toLowerCase()}`}
          </button>
          <JobProgress job={job} onRetry={train} />
        </>
      )}

      {isInstant && instantBusy && !instant && (
        <p className="mt-6 text-base text-text-muted">Scoring…</p>
      )}
      {isInstant && instantError && (
        <p className="mt-6 text-base text-down">{instantError}</p>
      )}

      {shown && (
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="show"
          className="mt-10 space-y-6"
        >
          <motion.div
            variants={staggerItem}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            {[
              { label: "Final value", value: number(shown.finalValue, 0) },
              {
                label: "Return",
                value: `${signed(shown.metrics.return_pct)}%`,
                tone: shown.metrics.return_pct >= 0 ? "text-up" : "text-down",
              },
              { label: "Buy & hold", value: `${signed(shown.metrics.buy_hold_pct)}%` },
              { label: "Closed trades", value: String(shown.metrics.trades) },
              { label: "Win rate", value: `${number(shown.metrics.win_rate_pct, 0)}%` },
              {
                label: "Max drawdown",
                value: `${number(shown.metrics.max_drawdown_pct, 1)}%`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <p className="text-sm text-text-muted">{stat.label}</p>
                <p className={`mt-1 font-mono text-lg ${stat.tone ?? "text-text"}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </motion.div>

          {/* The price the signal was read from, with the trades it produced.
              Bars, markers and study lines all come from the one response, so
              a marker cannot land on the wrong candle. */}
          {instant && instant.ohlc.close && (
            <motion.div
              variants={staggerItem}
              transition={transitionInOut}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base text-text">Price and trades</h2>
                <p className="font-mono text-sm text-text-faint">
                  {instant.buys.length} buys · {instant.sells.length} sells
                </p>
              </div>
              <div className="mt-4">
                <CandlestickChart
                  bare
                  bars={instant.dates.map((date, i) => ({
                    date,
                    open: instant.ohlc.open?.[i] ?? instant.ohlc.close[i],
                    high: instant.ohlc.high?.[i] ?? instant.ohlc.close[i],
                    low: instant.ohlc.low?.[i] ?? instant.ohlc.close[i],
                    close: instant.ohlc.close[i],
                    volume: 0,
                  }))}
                  overlays={Object.entries(instant.bands ?? {}).map(
                    ([name, values]) => ({ name, values }),
                  )}
                  buys={instant.buys}
                  sells={instant.sells}
                />
              </div>
              <p className="mt-3 text-sm text-text-faint">
                Green triangles are entries, red are exits.
                {instant.bands
                  ? " The lines are the study's own overlay, drawn from the same reading that produced the signals."
                  : instant.kind === "study"
                    ? " This study is an oscillator — nothing it draws belongs on a price axis, so the candles are shown bare."
                    : ""}
              </p>
            </motion.div>
          )}

          <motion.div
            variants={staggerItem}
            transition={transitionInOut}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base text-text">Portfolio value</h2>
              <p className="font-mono text-sm text-text-faint">{shown.label}</p>
            </div>
            <div className="mt-4">
              <LineSeries series={equitySeries} references={[initialMoney]} />
              <Legend series={equitySeries} />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Guide line is the {number(initialMoney, 0)} it started with. Buy
              &amp; hold over the same window returned{" "}
              {signed(shown.metrics.buy_hold_pct)}%.
            </p>
          </motion.div>

          {shown.trades && (
            <motion.div
              variants={staggerItem}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <h2 className="text-base text-text">Closed trades</h2>
              <div className="mt-4">
                <DataTable
                  table={{
                    columns: Object.keys(shown.trades[0] ?? {}),
                    rows: shown.trades,
                  }}
                  empty="This strategy closed no trades on this window."
                />
              </div>
            </motion.div>
          )}

          {job.result && (
            <motion.div
              variants={staggerItem}
              transition={transitionInOut}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base text-text">Learning curve</h2>
                <p className="font-mono text-sm text-text-faint">
                  {number(job.result.train_seconds, 1)}s ·{" "}
                  {job.result.rewards.length} iterations
                </p>
              </div>
              <div className="mt-4">
                <LineSeries series={rewardSeries} references={[0]} />
                <Legend series={rewardSeries} />
              </div>
              <p className="mt-3 text-sm text-text-faint">
                The agent optimises a simplified objective — one unit per trade, no
                costs — which reached{" "}
                {signed(job.result.rewards[job.result.rewards.length - 1] ?? 0)}%. The
                metrics above are the same policy through the real backtester with
                costs and sizing applied, at {signed(shown.metrics.return_pct)}%. The
                gap is what the objective ignores.
                {!job.result.improved &&
                  " Training did not improve on its first policy — the curve is noise around a flat line."}
              </p>
            </motion.div>
          )}

          {shown.metrics.return_pct < shown.metrics.buy_hold_pct && (
            <motion.p variants={staggerItem} className="text-sm text-text-muted">
              This agent underperformed buy &amp; hold by{" "}
              {number(shown.metrics.buy_hold_pct - shown.metrics.return_pct)} percentage
              points.
              {sizing === "fixed_units"
                ? " Some of that gap is sizing, not skill: buying one unit per signal deploys a fraction of your capital while the benchmark is fully invested. Switch position sizing to All in for a fair comparison."
                : " Sizing is like-for-like here, so this is a real result."}
            </motion.p>
          )}

          <motion.p variants={staggerItem} className="text-sm text-text-faint">
            {job.result
              ? `Saved to History as run ${job.result.run_id}. One run is one draw from a stochastic policy — a single good result is not an edge.`
              : "A fixed rule is deterministic, so this is the number, not a draw. It is also one window: a rule that wins on this series has not been shown to win on another."}
          </motion.p>
        </motion.div>
      )}
    </main>
  );
}
