"use client";

import { useEffect, useState } from "react";
import { getSources, type BarWindow, type SourceCatalogue } from "@/lib/api";

/**
 * Which bars a page is looking at: interval, period, an optional date window,
 * and an optional bundled dataset instead of a live symbol.
 *
 * One control rather than four copies, because the four are not independent.
 * Yahoo will not serve five years of hourly bars, so the period list is read
 * per interval from `GET /api/sources` and the selection is corrected when the
 * interval changes — a page that offered every period at every interval would
 * produce a failure the person using it could not diagnose.
 *
 * Picking a dataset disables interval and period on purpose. A bundled CSV is
 * one fixed series; leaving controls live that no longer affect anything would
 * suggest the file could be re-sampled, and it cannot.
 */
export function DataWindow({
  value,
  onChange,
  allowDataset = true,
  upload,
  onUpload,
}: {
  value: BarWindow;
  onChange: (next: BarWindow) => void;
  /** Off where a dataset makes no sense — a basket needs several series. */
  allowDataset?: boolean;
  /** The CSV currently in use, when the page supports bringing one. */
  upload?: File | null;
  onUpload?: (file: File | null) => void;
}) {
  const [sources, setSources] = useState<SourceCatalogue | null>(null);

  useEffect(() => {
    let ignore = false;
    getSources()
      .then((body) => {
        if (!ignore) setSources(body);
      })
      .catch(() => {
        // Leaving the selectors empty is better than offering intervals this
        // build cannot confirm the engine serves.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const interval = value.interval ?? sources?.default_interval ?? "1d";
  const periods =
    sources?.intervals.find((i) => i.code === interval)?.periods ?? [];
  const period = value.period ?? sources?.default_period ?? "5y";
  const onDataset = Boolean(value.dataset);

  function chooseInterval(code: string) {
    const allowed = sources?.intervals.find((i) => i.code === code)?.periods ?? [];
    // Carry the period across only when the new interval actually serves it.
    const kept = allowed.includes(period) ? period : allowed[allowed.length - 1];
    onChange({ ...value, interval: code, period: kept });
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">Interval</span>
        <select
          value={interval}
          disabled={onDataset}
          onChange={(e) => chooseInterval(e.target.value)}
          className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent disabled:text-text-faint"
        >
          {sources?.intervals.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">History</span>
        <select
          value={period}
          disabled={onDataset}
          onChange={(e) => onChange({ ...value, period: e.target.value })}
          className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent disabled:text-text-faint"
        >
          {periods.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">From</span>
        <input
          type="date"
          value={value.start ?? ""}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
        />
      </label>

      <label className="rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-sm text-text-muted">To</span>
        <input
          type="date"
          value={value.end ?? ""}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
        />
      </label>

      {allowDataset && (
        <label className="col-span-2 rounded-lg border border-border bg-surface px-4 py-3 sm:col-span-4">
          <span className="text-sm text-text-muted">
            Or a bundled dataset — works with no network
          </span>
          <select
            value={value.dataset ?? ""}
            onChange={(e) =>
              onChange({ ...value, dataset: e.target.value || undefined })
            }
            className="mt-2 w-full rounded border border-border bg-bg px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent"
          >
            <option value="">Live ticker</option>
            {sources?.datasets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {onDataset && (
            <p className="mt-1 text-xs text-text-faint">
              A bundled CSV is one fixed series, so interval and history do not
              apply. Most of them end in 2017–2019.
            </p>
          )}
        </label>
      )}

      {onUpload && (
        <label className="col-span-2 rounded-lg border border-border bg-surface px-4 py-3 sm:col-span-4">
          <span className="text-sm text-text-muted">Or your own CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-text-muted file:mr-3 file:rounded file:border file:border-border file:bg-surface-raised file:px-3 file:py-1 file:text-sm file:text-text hover:file:border-border-hover"
          />
          <p className="mt-1 text-xs text-text-faint">
            {upload
              ? `Scoring ${upload.name}. It is read, scored and dropped — nothing is stored.`
              : "Any price table with a date and a close. Extra OHLC columns unlock the studies that need them."}
          </p>
        </label>
      )}
    </div>
  );
}
