"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import {
  getModelCatalogue,
  startProjection,
  startWalkForward,
  type BarWindow,
  type ProjectResult,
  type WalkForwardResult,
} from "@/lib/api";
import { useJob } from "@/lib/use-job";
import { JobProgress } from "@/components/job-progress";
import { BarSeries, LineSeries, Legend, type Series } from "@/components/series-chart";
import { DataTable } from "@/components/data-table";
import { DataWindow } from "@/components/data-window";

const number = (v: number, digits = 2) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${number(v, digits)}`;

/** Mirrors the Forecast tab's own sliders, bound to the API's own limits. */
const LEARNING_RATES = [0.0001, 0.001, 0.01, 0.05];
const UNITS = [16, 32, 64, 128, 256];

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

export default function ForecastPage() {
  const [inputValue, setInputValue] = useState("AAPL");
  const [symbol, setSymbol] = useState("AAPL");

  const [dataWindow, setDataWindow] = useState<BarWindow>({});
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("LSTM");
  const [folds, setFolds] = useState(5);
  const [horizon, setHorizon] = useState(30);
  const [epochs, setEpochs] = useState(100);

  const [showSettings, setShowSettings] = useState(false);
  const [numLayers, setNumLayers] = useState(1);
  const [sizeLayer, setSizeLayer] = useState(128);
  const [timestamp, setTimestamp] = useState(5);
  const [learningRate, setLearningRate] = useState(0.01);
  const [dropout, setDropout] = useState(0.8);
  const [seed, setSeed] = useState<number | null>(1337);

  const [ahead, setAhead] = useState(5);

  const walk = useJob<WalkForwardResult>();
  const projection = useJob<ProjectResult>();

  // The roster is the engine's, not this file's — a model added there appears
  // here, and one offered here is always one a job will accept.
  useEffect(() => {
    let ignore = false;
    getModelCatalogue()
      .then((catalogue) => {
        if (ignore) return;
        setModels(catalogue.models);
        setModel((current) =>
          catalogue.models.includes(current) ? current : catalogue.models[0] ?? current,
        );
      })
      .catch(() => {
        // A roster that cannot be fetched leaves the select empty rather than
        // offering names this build cannot verify the engine has.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const network = {
    symbol,
    ...dataWindow,
    model,
    epochs,
    num_layers: numLayers,
    size_layer: sizeLayer,
    timestamp,
    dropout,
    learning_rate: learningRate,
    seed,
  };

  const runWalkForward = () =>
    walk.start(() => startWalkForward({ ...network, folds, horizon }));

  const runProjection = () =>
    projection.start(() => startProjection({ ...network, horizon: ahead }));

  const result = walk.result;
  const summary = result?.summary;
  const projected = projection.result;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Forecast</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Walk-forward fits the scaler on each fold&rsquo;s training slice only, so
        there is no look-ahead into the window being scored. That is the whole
        reason to run it: a single split landing on a kind window looks
        convincing and proves nothing.
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

      <DataWindow value={dataWindow} onChange={setDataWindow} />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-muted">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <Field label="Bars to predict" value={horizon}>
          <input
            type="range"
            min={5}
            max={60}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>

        <Field label="Epochs" value={epochs}>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>

        <Field label="Folds" value={folds}>
          <input
            type="range"
            min={2}
            max={20}
            value={folds}
            onChange={(e) => setFolds(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </Field>
      </div>

      <button
        onClick={() => setShowSettings((v) => !v)}
        aria-expanded={showSettings}
        className="mt-4 text-sm text-text-muted transition-colors hover:text-text"
      >
        {showSettings ? "Hide" : "Show"} model settings
      </button>

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={transitionInOut}
          className="mt-3 grid grid-cols-1 gap-4 overflow-hidden sm:grid-cols-3"
        >
          <Field label="Layers" value={numLayers}>
            <input
              type="range"
              min={1}
              max={4}
              value={numLayers}
              onChange={(e) => setNumLayers(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>

          <label className="rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-sm text-text-muted">Units per layer</span>
            <span className="ml-2 font-mono text-sm text-text">{sizeLayer}</span>
            <select
              value={sizeLayer}
              onChange={(e) => setSizeLayer(Number(e.target.value))}
              className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <Field label="Sequence length" value={timestamp}>
            <input
              type="range"
              min={2}
              max={20}
              value={timestamp}
              onChange={(e) => setTimestamp(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>

          <label className="rounded-lg border border-border bg-surface px-4 py-3">
            <span className="text-sm text-text-muted">Learning rate</span>
            <span className="ml-2 font-mono text-sm text-text">{learningRate}</span>
            <select
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
            >
              {LEARNING_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <Field label="Keep probability" value={dropout.toFixed(2)}>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={dropout}
              onChange={(e) => setDropout(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </Field>

          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={seed !== null}
                onChange={(e) => setSeed(e.target.checked ? 1337 : null)}
                className="accent-[var(--accent)]"
              />
              Seeded
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
        </motion.div>
      )}

      <button
        onClick={runWalkForward}
        disabled={walk.busy}
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {walk.busy ? "Running…" : "Run walk-forward"}
      </button>

      <JobProgress job={walk} onRetry={runWalkForward} />

      {result && summary && (
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
              {
                label: "Folds beating naive",
                value: `${result.folds_beating_naive}/${result.folds}`,
                note: `${number(summary.win_rate_pct, 0)}% of folds`,
              },
              {
                label: "Mean accuracy",
                value: `${number(summary.mean_accuracy)}%`,
                note: `±${number(summary.std_accuracy)} across folds`,
              },
              { label: "Mean naive", value: `${number(summary.mean_naive)}%` },
              {
                label: "Mean directional",
                value: `${number(summary.mean_directional, 1)}%`,
                note: `${signed(summary.mean_directional - 50, 1)} pts vs a coin flip`,
              },
              { label: "Mean MAE", value: number(summary.mean_mae) },
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
              <h2 className="text-base text-text">Directional accuracy by fold</h2>
              <p className="font-mono text-sm text-text-faint">
                {result.model} · {result.horizon}-bar horizon
              </p>
            </div>
            <div className="mt-4">
              <BarSeries
                values={result.table.map((row) => Number(row["Directional %"] ?? 0))}
                reference={50}
              />
            </div>
            <p className="mt-3 text-sm text-text-faint">
              Dashed line is a coin flip. A fold below it did worse than guessing
              the direction at random.
            </p>
          </motion.div>

          <motion.div variants={staggerItem} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base text-text">Every fold</h2>
            <div className="mt-4">
              <DataTable
                table={{
                  columns: Object.keys(result.table[0] ?? {}),
                  rows: result.table,
                }}
                empty="This run produced no folds."
              />
            </div>
          </motion.div>

          <motion.p
            variants={staggerItem}
            className={`text-sm ${
              result.folds_beating_naive === 0
                ? "text-down"
                : summary.win_rate_pct < 50
                  ? "text-text-muted"
                  : "text-up"
            }`}
          >
            {result.folds_beating_naive === 0
              ? `${result.model} beat the naive baseline in 0 of ${result.folds} folds. The single-split number is not reproducible across time — which is the whole reason to run this.`
              : summary.win_rate_pct < 50
                ? `Beat the baseline in only ${result.folds_beating_naive} of ${result.folds} folds. A single split landing on a good window would have looked convincing.`
                : `Beat the baseline in ${result.folds_beating_naive} of ${result.folds} folds, mean directional ${number(summary.mean_directional, 1)}%.`}
          </motion.p>

          {/* Everything above predicts windows that already happened, which is
              what makes them scoreable and also why none of them is a forecast.
              This trains on every bar and rolls past the last one, borrowing the
              folds above for its credibility. */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-base text-text">Project past the last bar</h2>
            <p className="mt-2 text-sm text-text-muted">
              Trains on the whole series and predicts forward, so there is nothing
              to score it against. The folds above are its track record — the
              Signal page weights a forecast by that{" "}
              {number(summary.mean_directional, 1)}% directional accuracy, which is
              the only reason to believe any of it.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="min-w-[12rem] flex-1 rounded-lg border border-border bg-surface-raised px-4 py-3">
                <span className="text-sm text-text-muted">Bars ahead</span>
                <span className="ml-2 font-mono text-sm text-text">{ahead}</span>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={ahead}
                  onChange={(e) => setAhead(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--accent)]"
                />
              </label>
              <button
                onClick={runProjection}
                disabled={projection.busy}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-50"
              >
                {projection.busy ? "Projecting…" : "Project forward"}
              </button>
            </div>

            <JobProgress job={projection} onRetry={runProjection} />

            {projected && (
              <div className="mt-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Last close", value: number(projected.last_price) },
                    {
                      label: `In ${projected.horizon} bars`,
                      value: number(projected.final),
                      note: `${projected.move_pct >= 0 ? "+" : ""}${number(projected.move_pct)}%`,
                    },
                    { label: "Model", value: projected.model },
                    {
                      label: "Measured directional",
                      value: `${number(summary.mean_directional, 1)}%`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-surface-raised p-4"
                    >
                      <p className="text-sm text-text-muted">{stat.label}</p>
                      <p className="mt-1 font-mono text-base text-text">{stat.value}</p>
                      {stat.note && (
                        <p
                          className={`mt-0.5 font-mono text-sm ${
                            projected.move_pct >= 0 ? "text-up" : "text-down"
                          }`}
                        >
                          {stat.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  {(() => {
                    // The projection drawn from the last close, so the first
                    // step is a move rather than a jump from nowhere.
                    const path: Series[] = [
                      {
                        name: "Projection",
                        values: [projected.last_price, ...projected.path],
                        color: "var(--accent)",
                        width: 2,
                        dashed: true,
                      },
                    ];
                    return (
                      <>
                        <LineSeries series={path} references={[projected.last_price]} />
                        <Legend series={path} />
                      </>
                    );
                  })()}
                </div>

                <p className="mt-3 text-sm text-text-faint">
                  Guide line is the last close, {number(projected.last_price)}.
                  Measured 2026-08-23: two identical projections can disagree —
                  see the reproducibility note in the research record. Treat a
                  single path as one draw, not as the model&rsquo;s answer.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}
