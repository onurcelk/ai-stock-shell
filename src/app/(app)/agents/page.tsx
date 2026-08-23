"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import {
  getAgentCatalogue,
  startAgent,
  type AgentCatalogue,
  type AgentResult,
} from "@/lib/api";
import { useJob } from "@/lib/use-job";
import { JobProgress } from "@/components/job-progress";
import { LineSeries, Legend, type Series } from "@/components/series-chart";

const number = (v: number, digits = 2) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${number(v, digits)}`;

/**
 * Readable names for the sizing keys the API serves.
 *
 * The keys are the contract and come from `backtest.SIZING_MODES`; this only
 * prettifies them, and falls back to the key itself, so a mode added to the
 * engine still appears here rather than vanishing.
 */
const SIZING_LABELS: Record<string, string> = {
  fixed_units: "Fixed units",
  pct_equity: "% of equity",
  all_in: "All in",
};

const UNITS = [32, 64, 128, 256];

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

  const [catalogue, setCatalogue] = useState<AgentCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [agent, setAgent] = useState("");

  const [iterations, setIterations] = useState(50);
  const [windowSize, setWindowSize] = useState(30);
  const [layerSize, setLayerSize] = useState(64);
  const [seed, setSeed] = useState(42);

  const [sizing, setSizing] = useState("fixed_units");
  const [maxBuy, setMaxBuy] = useState(1);
  const [maxSell, setMaxSell] = useState(1);
  const [sizePct, setSizePct] = useState(100);
  const [initialMoney, setInitialMoney] = useState(10000);
  const [feePct, setFeePct] = useState(0);
  const [slippagePct, setSlippagePct] = useState(0);

  const job = useJob<AgentResult>();

  // The roster is `agents.REGISTRY` itself — all 19, not a subset copied here.
  useEffect(() => {
    let ignore = false;
    getAgentCatalogue()
      .then((body) => {
        if (ignore) return;
        setCatalogue(body);
        const first = body.agents[0];
        if (first) {
          setAgent(first.name);
          if (first.default_iterations !== null) setIterations(first.default_iterations);
        }
      })
      .catch(() => {
        if (!ignore) setCatalogueError("Could not reach the API for the agent roster.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const entry = useMemo(
    () => catalogue?.agents.find((a) => a.name === agent) ?? null,
    [catalogue, agent],
  );

  // Each agent carries its own sensible iteration count; picking a different
  // agent should move the slider with it rather than silently keeping a number
  // chosen for the previous one.
  function chooseAgent(name: string) {
    setAgent(name);
    const chosen = catalogue?.agents.find((a) => a.name === name);
    if (chosen?.default_iterations != null) setIterations(chosen.default_iterations);
  }

  const train = () =>
    job.start(() =>
      startAgent({
        symbol,
        agent,
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

  const result = job.result;
  const metrics = result?.metrics;

  const equitySeries: Series[] = result
    ? [{ name: "Agent equity", values: result.equity, color: "var(--accent)", width: 2 }]
    : [];
  const rewardSeries: Series[] = result
    ? [{ name: "Policy return %", values: result.rewards, color: "var(--accent)", width: 2 }]
    : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Trading agents</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Each agent learns a policy from the price history, then the same
        backtester every other strategy uses executes it. The benchmark is buy
        &amp; hold over the identical window. Training runs on the server as a
        background job — this page starts it and follows it.
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

      {catalogueError && <p className="mt-4 text-sm text-down">{catalogueError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Agent</span>
          <select
            value={agent}
            onChange={(e) => chooseAgent(e.target.value)}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            {catalogue?.agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Position sizing</span>
          <select
            value={sizing}
            onChange={(e) => setSizing(e.target.value)}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            {catalogue?.sizing_modes.map((mode) => (
              <option key={mode} value={mode}>
                {SIZING_LABELS[mode] ?? mode}
              </option>
            ))}
          </select>
        </label>
      </div>

      {entry?.notebook && (
        <p className="mt-3 text-sm text-text-faint">
          Ported from <code className="font-mono">agent/{entry.notebook}.*.ipynb</code>.
          The learning curve scores the greedy policy on a simplified objective —
          one unit per trade, no costs — while the metrics come from the real
          backtester. The two disagreeing is the point.
        </p>
      )}

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

      <button
        onClick={train}
        disabled={job.busy || !agent}
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {job.busy ? "Training…" : `Train ${agent || "agent"}`}
      </button>

      <JobProgress job={job} onRetry={train} />

      {result && metrics && (
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
              { label: "Final value", value: number(result.final_value, 0) },
              {
                label: "Return",
                value: `${signed(metrics.return_pct)}%`,
                tone: metrics.return_pct >= 0 ? "text-up" : "text-down",
              },
              { label: "Buy & hold", value: `${signed(metrics.buy_hold_pct)}%` },
              { label: "Closed trades", value: String(metrics.trades) },
              { label: "Win rate", value: `${number(metrics.win_rate_pct, 0)}%` },
              {
                label: "Max drawdown",
                value: `${number(metrics.max_drawdown_pct, 1)}%`,
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

          <motion.div
            variants={staggerItem}
            transition={transitionInOut}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base text-text">Portfolio value</h2>
              <p className="font-mono text-sm text-text-faint">{result.label}</p>
            </div>
            <div className="mt-4">
              <LineSeries series={equitySeries} references={[initialMoney]} />
              <Legend series={equitySeries} />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Guide line is the {number(initialMoney, 0)} it started with. Buy
              &amp; hold over the same window returned{" "}
              {signed(metrics.buy_hold_pct)}%.
            </p>
          </motion.div>

          <motion.div
            variants={staggerItem}
            transition={transitionInOut}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base text-text">Learning curve</h2>
              <p className="font-mono text-sm text-text-faint">
                {number(result.train_seconds, 1)}s · {result.rewards.length} iterations
              </p>
            </div>
            <div className="mt-4">
              <LineSeries series={rewardSeries} references={[0]} />
              <Legend series={rewardSeries} />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              The agent optimises a simplified objective — one unit per trade, no
              costs — which reached{" "}
              {signed(result.rewards[result.rewards.length - 1] ?? 0)}%. The metrics
              above are the same policy through the real backtester with costs and
              sizing applied, at {signed(metrics.return_pct)}%. The gap is what the
              objective ignores.
              {!result.improved &&
                " Training did not improve on its first policy — the curve is noise around a flat line."}
            </p>
          </motion.div>

          {metrics.return_pct < metrics.buy_hold_pct && (
            <motion.p variants={staggerItem} className="text-sm text-text-muted">
              This agent underperformed buy &amp; hold by{" "}
              {number(metrics.buy_hold_pct - metrics.return_pct)} percentage points.
              {sizing === "fixed_units"
                ? " Some of that gap is sizing, not skill: buying one unit per signal deploys a fraction of your capital while the benchmark is fully invested. Switch position sizing to All in for a fair comparison."
                : " Sizing is like-for-like here, so this is a real result."}
            </motion.p>
          )}

          <motion.p variants={staggerItem} className="text-sm text-text-faint">
            Saved to History as run {result.run_id}. One run is one draw from a
            stochastic policy — a single good result is not an edge.
          </motion.p>
        </motion.div>
      )}
    </main>
  );
}
