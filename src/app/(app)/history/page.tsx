"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut, transitionOut } from "@/lib/motion";
import {
  getRuns,
  getRun,
  deleteRun,
  clearRuns,
  ApiError,
  type RunsResponse,
  type RunDetail,
} from "@/lib/api";
import { LineSeries, BarSeries, Legend, type Series } from "@/components/series-chart";

const numbers = (payload: Record<string, unknown>, key: string): number[] => {
  const value = payload[key];
  return Array.isArray(value) ? (value.filter((v) => typeof v === "number") as number[]) : [];
};

const pretty = (value: unknown) =>
  typeof value === "number"
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2)
    : String(value);

/** What a run's payload looks like depends on what produced it. */
function RunChart({ run }: { run: RunDetail }) {
  if (run.kind === "forecast") {
    const series: Series[] = [
      { name: "Actual", values: numbers(run.payload, "actual"), color: "var(--text)" },
      {
        name: "Forecast",
        values: numbers(run.payload, "mean_forecast"),
        color: "var(--accent)",
      },
      {
        name: "Naive baseline",
        values: numbers(run.payload, "naive"),
        color: "var(--text-faint)",
        dashed: true,
      },
    ].filter((s) => s.values.length > 0);

    if (series.length === 0) return null;
    return (
      <>
        <LineSeries series={series} />
        <Legend series={series} />
      </>
    );
  }

  if (run.kind === "walkforward") {
    const directionals = numbers(run.payload, "directionals");
    if (directionals.length === 0) return null;
    return (
      <>
        <BarSeries values={directionals} reference={50} />
        <p className="mt-3 text-sm text-text-faint">
          Directional accuracy per fold, against the 50% coin-flip line. A fold above
          the dashes beat a guess; the run as a whole is only as good as the folds
          taken together.
        </p>
      </>
    );
  }

  const equity = numbers(run.payload, "equity");
  if (equity.length === 0) return null;
  const series: Series[] = [{ name: "Equity", values: equity, color: "var(--accent)" }];
  return (
    <>
      <LineSeries series={series} references={[equity[0]]} />
      <p className="mt-3 text-sm text-text-faint">
        Equity through the run, against the stake it started with.
      </p>
    </>
  );
}

export default function HistoryPage() {
  const [kind, setKind] = useState<string>("");
  const [data, setData] = useState<RunsResponse | null>(null);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  // Bumped by anything that changes what is on disk, so the listing has one
  // fetch path rather than one for the filter and another for mutations.
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let ignore = false;
    // The textbook exception this rule documents: a loading flag for a
    // fetch-on-dependency-change effect, guarded by the `ignore` cleanup
    // below so a stale request can never overwrite a newer one's state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getRuns(kind || undefined)
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
  }, [kind, reloads]);

  const open = async (id: string) => {
    try {
      setSelected(await getRun(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read that run.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRun(id);
      if (selected?.id === id) setSelected(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that run.");
    }
  };

  const wipe = async () => {
    try {
      await clearRuns();
      setSelected(null);
      setConfirmingClear(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not clear the runs.");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-medium text-text">History</h1>
        {data && data.total > 0 && (
          <p className="font-mono text-sm text-text-faint">
            {data.total} saved run{data.total === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Every training run is written to disk the moment it finishes, so a result
        survives a refresh and last week&apos;s settings can still be compared with
        today&apos;s.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {[["", "All"], ...Object.entries(data?.kinds ?? {})].map(([value, label]) => (
            <button
              key={value || "all"}
              onClick={() => {
                setKind(value);
                setSelected(null);
              }}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                kind === value
                  ? "bg-accent-dim text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          {confirmingClear ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">Delete every saved run?</span>
              <button
                onClick={wipe}
                className="rounded-lg border border-down px-3 py-1.5 text-sm text-down transition-colors hover:bg-surface-raised"
              >
                Yes, delete all
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-border-hover"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              disabled={!data || data.total === 0}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-border-hover disabled:opacity-40"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading && <p className="mt-10 text-base text-text-muted">Reading saved runs…</p>}
      {error && <p className="mt-10 text-base text-down">{error}</p>}

      {data && !loading && data.total === 0 && (
        <p className="mt-10 text-base text-text-muted">
          Nothing saved yet. Train a forecast or an agent and it will appear here.
        </p>
      )}

      {data && !loading && data.total > 0 && (
        <motion.div
          variants={staggerContainer(0.03)}
          initial="hidden"
          animate="show"
          className="mt-6 overflow-x-auto rounded-xl border border-border"
        >
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-border text-text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">When</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Series</th>
                <th className="px-4 py-3 font-normal">Headline</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => {
                const [headlineKey, headlineValue] = Object.entries(run.metrics)[0] ?? [];
                return (
                  <motion.tr
                    key={run.id}
                    variants={staggerItem}
                    className={`border-b border-border last:border-0 transition-colors hover:bg-surface ${
                      selected?.id === run.id ? "bg-surface" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-text-muted">{run.age}</td>
                    <td className="px-4 py-3 text-text-muted">{run.kind_label}</td>
                    <td className="px-4 py-3 font-mono text-text">{run.label}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">
                      {headlineKey
                        ? `${headlineKey.replace(/_/g, " ")} ${pretty(headlineValue)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => open(run.id)}
                        className="rounded px-2 py-1 text-sm text-accent transition-colors hover:bg-surface-raised"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => remove(run.id)}
                        aria-label={`Delete ${run.label}`}
                        className="rounded px-2 py-1 text-sm text-text-faint transition-colors hover:text-down"
                      >
                        Delete
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {selected && (
          <motion.section
            key={selected.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: transitionOut }}
            transition={transitionInOut}
            className="mt-8 rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-base text-text">
                  {selected.label}{" "}
                  <span className="text-text-muted">· {selected.kind_label}</span>
                </h2>
                <p className="mt-1 font-mono text-sm text-text-faint">
                  {selected.saved_at.replace("T", " ")}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded px-2 py-1 text-sm text-text-muted transition-colors hover:text-text"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <RunChart run={selected} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {(["settings", "metrics"] as const).map((group) => (
                <div key={group}>
                  <h3 className="text-sm capitalize text-text-muted">{group}</h3>
                  <dl className="mt-2 space-y-1">
                    {Object.entries(selected[group]).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 text-sm">
                        <dt className="text-text-muted">{key.replace(/_/g, " ")}</dt>
                        <dd className="font-mono text-text">{pretty(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
