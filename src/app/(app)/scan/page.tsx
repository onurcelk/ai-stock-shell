"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ApiError,
  getScanOptions,
  startScan,
  type ScanOptions,
  type ScanResult,
  type ScanRow,
} from "@/lib/api";
import { actionColor, actionEmphasis, isBuy } from "@/lib/actions";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import { JobProgress } from "@/components/job-progress";
import { useJob } from "@/lib/use-job";

const number = (v: number, digits = 2) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${number(v, digits)}`;

/**
 * How many rows the table draws before it stops.
 *
 * A NASDAQ scan is ~3,600 rows and the browser will lay out every one of them
 * if asked. The cap is on the *drawing*, never on the reading: the counts
 * above the table are computed from the whole result, so the denominator stays
 * honest while the DOM stays finite.
 */
const MAX_DRAWN = 250;

/** A scan is one download per symbol, so its cost is worth stating up front. */
function cost(count: number, secondsEach: number, bytesEach: number): string {
  const seconds = count * secondsEach;
  const time =
    seconds < 90
      ? `${Math.max(1, Math.round(seconds))}s`
      : `${Math.round(seconds / 60)} min`;
  const gigabytes = (count * bytesEach) / 1e9;
  const disk =
    gigabytes >= 0.1
      ? `, about ${gigabytes.toFixed(1)} GB of cache`
      : `, ${Math.round((count * bytesEach) / 1e6)} MB of cache`;
  return `~${time}${disk}`;
}

/** A bar reading is a time, not a date: the whole point of an intraday scan. */
function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Where a score sits between the two bands the call was made against.
 *
 * Drawn rather than described because the bands are the rule: ±15 is where a
 * call becomes an action at all and ±40 is where it can become a strong one,
 * and a bare "+38" tells you neither. Plain CSS, not an SVG — one meter per
 * row across sixty rows is a layout problem, not a charting one.
 */
function ScoreMeter({
  score,
  act,
  strong,
  color,
}: {
  score: number;
  act: number;
  strong: number;
  color: string;
}) {
  const position = ((Math.max(-100, Math.min(100, score)) + 100) / 200) * 100;
  const mark = (value: number) => ((value + 100) / 200) * 100;

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
      {[-strong, -act, act, strong].map((band) => (
        <span
          key={band}
          className="absolute top-0 h-full w-px bg-border"
          style={{ left: `${mark(band)}%` }}
        />
      ))}
      <span className="absolute top-0 h-full w-px bg-text-faint" style={{ left: "50%" }} />
      <motion.span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
        style={{ background: color }}
        initial={{ left: "50%", opacity: 0 }}
        animate={{ left: `calc(${position}% - 5px)`, opacity: 1 }}
        transition={transitionInOut}
      />
    </div>
  );
}

function CallBadge({ action }: { action: string }) {
  const color = actionColor(action);
  const emphasis = actionEmphasis(action);

  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-sans text-xs font-semibold"
      style={{
        color,
        // A strong call is the one worth finding in a table of sixty rows, so
        // it gets a filled chip; an abstention gets nothing but its label.
        background:
          emphasis === "strong" ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
        border:
          emphasis === "quiet"
            ? "1px solid var(--border)"
            : `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      {action}
    </span>
  );
}

function Row({
  row,
  bands,
}: {
  row: ScanRow;
  bands: ScanOptions["bands"];
}) {
  const [open, setOpen] = useState(false);
  const color = actionColor(row.action);

  if (!row.available) {
    return (
      <div className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-t border-border px-4 py-3">
        <p className="font-mono text-sm text-text-muted">{row.symbol}</p>
        <p className="text-sm text-text-faint">{row.unavailable || "no reading"}</p>
      </div>
    );
  }

  return (
    <motion.div variants={staggerItem} className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="grid w-full grid-cols-[5.5rem_7rem_1fr] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-raised sm:grid-cols-[5.5rem_7rem_1fr_5rem_5rem_6rem]"
      >
        <span className="font-mono text-sm text-text">{row.symbol}</span>
        <CallBadge action={row.action} />

        <span className="hidden sm:block">
          <ScoreMeter
            score={row.score}
            act={bands.act}
            strong={bands.strong}
            color={color}
          />
        </span>

        <span className="font-mono text-sm tabular-nums" style={{ color }}>
          {signed(row.score, 0)}
        </span>
        <span className="hidden font-mono text-sm text-text-muted tabular-nums sm:block">
          {number(row.confidence, 0)}%
        </span>
        <span className="hidden font-mono text-sm text-text-muted tabular-nums sm:block">
          {row.expected_move_pct === undefined ? "—" : `${signed(row.expected_move_pct)}%`}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitionInOut}
            className="overflow-hidden bg-surface-raised"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-4">
              <Detail label="Last" value={row.last_price === null ? "—" : number(row.last_price)} />
              <Detail
                label="Target"
                value={row.target_price === undefined ? "—" : number(row.target_price)}
              />
              <Detail
                label="Agreement"
                value={row.agreement === undefined ? "—" : `${number(row.agreement * 100, 0)}%`}
              />
              <Detail
                label="Sources counted"
                value={row.sources ? `${row.sources.counted} of ${row.sources.total}` : "—"}
              />
              <Detail label="Last bar" value={stamp(row.as_of)} />
              <Detail
                label="Typical move"
                value={
                  row.typical_move_pct === undefined ? "—" : `${number(row.typical_move_pct)}%`
                }
              />
              <Detail
                label="Measured edge"
                value={row.weighted_edge === undefined ? "—" : signed(row.weighted_edge)}
              />
              <Detail label="Bars read" value={row.rows ? String(row.rows) : "—"} />
            </div>

            {row.leaders && row.leaders.length > 0 && (
              <div className="border-t border-border px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-text-faint">
                  Heaviest contributions
                </p>
                <ul className="mt-2 space-y-1.5">
                  {row.leaders.map((leader) => (
                    <li key={leader.name} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="text-text">{leader.name}</span>
                      <span
                        className="font-mono text-xs tabular-nums"
                        style={{ color: leader.score >= 0 ? "var(--up)" : "var(--down)" }}
                      >
                        {signed(leader.score, 2)}
                      </span>
                      <span className="text-xs text-text-faint">{leader.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-1 font-mono text-sm text-text">{value}</p>
    </div>
  );
}

export default function ScanPage() {
  const [options, setOptions] = useState<ScanOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState("4h");
  // The S&P 500 by default: it is the one market list that needs no download,
  // and a screen that opens on your own watchlist answers a question you could
  // already answer.
  const [universe, setUniverse] = useState("sp500");
  const [custom, setCustom] = useState("");
  const [force, setForce] = useState(false);
  const [buysOnly, setBuysOnly] = useState(true);

  const job = useJob<ScanResult>();
  const { start } = job;

  useEffect(() => {
    getScanOptions()
      .then((body) => {
        setOptions(body);
        setHorizon(body.default_horizon);
      })
      .catch((error) =>
        setOptionsError(
          error instanceof ApiError ? error.message : "Could not reach the API.",
        ),
      );
  }, []);

  const typed = useMemo(
    () =>
      custom
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    [custom],
  );

  const chosenUniverse = options?.universes.find((u) => u.key === universe) ?? null;
  const chosenHorizon = options?.horizons.find((h) => h.key === horizon) ?? null;

  // What will actually be read, stated before the button is pressed. A scan is
  // one download per symbol, so "503 symbols" and "3,600 symbols" are two very
  // different afternoons and the difference belongs on the button.
  //
  // `null` is its own answer, not zero: a market listing that has not been
  // downloaded yet has no length until the scan goes and fetches it, and
  // guessing one here would put a made-up number on the button.
  const count: number | null =
    typed.length > 0 ? typed.length : (chosenUniverse?.count ?? null);
  const unknownSize = count === null;
  const runnable = unknownSize || count > 0;

  const run = useCallback(() => {
    start(() =>
      startScan({
        horizon,
        force,
        ...(typed.length > 0 ? { symbols: typed } : { universe }),
      }),
    );
  }, [start, horizon, force, typed, universe]);

  const result = job.result;
  const shown = useMemo(() => {
    if (!result) return [];
    const readable = result.rows.filter((r) => r.available);
    return buysOnly ? readable.filter((r) => isBuy(r.action)) : readable;
  }, [result, buysOnly]);

  const unreadable = result?.rows.filter((r) => !r.available) ?? [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Market scan</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        The Signal page answers <em>what does this symbol say</em>. This one
        answers the question before it — <em>which symbol</em> — by running the
        same engine across a list at one horizon and ranking what comes back.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-text-faint">
        The market lists come from published symbol directories — the S&amp;P 500,
        every operating company on NASDAQ and on the NYSE, the FTSE 100 — with
        funds, test issues, warrants and units dropped. Every symbol asked for
        comes back, HOLDs included: eight buys out of twelve and eight out of
        five hundred are different facts, and only one of them is a screen worth
        trusting.
      </p>

      {optionsError && (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm text-down">
          {optionsError}
        </p>
      )}

      {options && (
        <>
          <div className="mt-8">
            <p className="text-sm text-text-muted">Horizon</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.horizons.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setHorizon(option.key)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    horizon === option.key
                      ? "border-accent bg-accent-dim text-text"
                      : "border-border text-text-muted hover:border-border-hover"
                  }`}
                >
                  {option.label}
                  <span className="ml-2 font-mono text-xs text-text-faint">
                    {option.interval}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm text-text-muted">Universe</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.universes.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setUniverse(option.key)}
                  disabled={option.count === 0}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
                    universe === option.key && typed.length === 0
                      ? "border-accent bg-accent-dim text-text"
                      : "border-border text-text-muted hover:border-border-hover"
                  }`}
                >
                  {option.label}
                  <span className="ml-2 font-mono text-xs text-text-faint">
                    {option.count === null
                      ? "—"
                      : option.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
            {chosenUniverse && (
              <>
                <p className="mt-2 max-w-2xl text-sm text-text-faint">
                  {chosenUniverse.describe}
                </p>
                {chosenUniverse.market && (
                  <p className="mt-1 max-w-2xl text-sm text-text-faint">
                    {chosenUniverse.count === null
                      ? "The list has not been downloaded yet — the scan fetches it first."
                      : `List from ${stamp(chosenUniverse.fetched_at)}${
                          chosenUniverse.stale ? " (worth refreshing)" : ""
                        }.`}
                    {Object.entries(chosenUniverse.excluded).some(([, n]) => n > 0) && (
                      <>
                        {" "}
                        Dropped:{" "}
                        {Object.entries(chosenUniverse.excluded)
                          .filter(([, n]) => n > 0)
                          .map(([what, n]) => `${n.toLocaleString()} ${what}`)
                          .join(", ")}
                        .
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-6">
            <label className="text-sm text-text-muted" htmlFor="scan-symbols">
              Or type a list
            </label>
            <input
              id="scan-symbols"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="AAPL NVDA BTC-USD — overrides the universe above"
              className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-base text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={run}
              disabled={job.busy || !runnable}
              className="rounded-lg border border-accent bg-accent-dim px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-50"
            >
              {job.busy
                ? "Scanning…"
                : unknownSize
                  ? `Scan ${chosenUniverse?.label ?? "this list"}`
                  : `Scan ${count.toLocaleString()} symbol${count === 1 ? "" : "s"}`}
            </button>

            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              Re-download rather than use the cache
            </label>
          </div>

          <p className="mt-2 max-w-2xl text-sm text-text-faint">
            {unknownSize
              ? "One download per symbol on a cold cache, and this list runs to thousands — expect it to take a while and to leave a lot behind in the cache."
              : `${cost(count, options.seconds_per_symbol, options.cache_bytes_per_symbol)} on a cold cache; a second scan of the same list is far quicker.`}{" "}
            Forcing a re-download of every symbol at once is the reliable way to
            get rate-limited part-way through.
          </p>

          {chosenHorizon?.caveats && chosenHorizon.caveats.length > 0 && (
            <motion.div
              key={chosenHorizon.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitionInOut}
              className="mt-6 rounded-xl border border-border bg-surface p-5"
              style={{ borderColor: horizon === "4h" ? "var(--down)" : undefined }}
            >
              <p className="text-sm font-medium text-text">
                What has been measured about {chosenHorizon.label}
              </p>
              <ul className="mt-3 space-y-2">
                {chosenHorizon.caveats.map((caveat) => (
                  <li key={caveat} className="text-sm leading-relaxed text-text-muted">
                    {caveat}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </>
      )}

      <JobProgress
        job={job}
        onRetry={run}
        verb="Scanning"
        queueNote="Waiting for the worker. The desk runs one job at a time, so a scan queues behind any training already running."
      />

      {result && (
        <motion.section
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className="mt-10"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-base text-text">
              {result.horizon.label} · {result.source}
            </h2>
            <p className="font-mono text-sm text-text-faint">
              {result.readable} of {result.scanned} readable · {stamp(result.generated_at)}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {result.counts &&
              Object.entries(result.counts)
                .filter(([, n]) => n > 0)
                .map(([action, n]) => (
                  <span
                    key={action}
                    className="rounded-full border border-border px-3 py-1 font-mono text-xs"
                    style={{ color: actionColor(action) }}
                  >
                    {n} {action.toLowerCase()}
                  </span>
                ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setBuysOnly(true)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                buysOnly
                  ? "border-accent bg-accent-dim text-text"
                  : "border-border text-text-muted hover:border-border-hover"
              }`}
            >
              Buy &amp; strong buy
            </button>
            <button
              onClick={() => setBuysOnly(false)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                buysOnly
                  ? "border-border text-text-muted hover:border-border-hover"
                  : "border-accent bg-accent-dim text-text"
              }`}
            >
              Every readable row
            </button>
          </div>

          {options && shown.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
              {shown.length > MAX_DRAWN && (
                <p className="border-b border-border px-4 py-2.5 text-sm text-text-faint">
                  Drawing the top {MAX_DRAWN} of {shown.length.toLocaleString()}.
                  The counts above are over the whole scan.
                </p>
              )}
              <div className="hidden grid-cols-[5.5rem_7rem_1fr_5rem_5rem_6rem] gap-4 px-4 py-2.5 text-xs uppercase tracking-wide text-text-faint sm:grid">
                <span>Symbol</span>
                <span>Call</span>
                <span>Score against the bands</span>
                <span>Score</span>
                <span>Conf.</span>
                <span>Move</span>
              </div>
              {shown.slice(0, MAX_DRAWN).map((row) => (
                <Row key={row.symbol} row={row} bands={options.bands} />
              ))}
            </div>
          )}

          {shown.length === 0 && (
            <div className="mt-4 rounded-xl border border-border bg-surface p-5">
              <p className="text-sm text-text">
                {buysOnly
                  ? "Nothing on this list cleared the buy bands."
                  : "Nothing on this list could be read."}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {buysOnly
                  ? `A call needs a score past ±${options?.bands.act ?? 15} and confidence past ` +
                    `${options?.bands.min_confidence ?? 12}% before it is an action at all. An empty ` +
                    "screen is the engine abstaining, which is the output PIT-1 vindicated: it " +
                    "abstained on 74.3% of symbol-dates, and on the calls it did make its edge " +
                    "over a trivial rule was zero."
                  : "Every symbol failed to produce a reading. The reasons are listed below."}
              </p>
            </div>
          )}

          {result.caveats.length > 0 && (
            <div
              className="mt-6 rounded-xl border bg-surface p-5"
              style={{ borderColor: result.horizon.key === "4h" ? "var(--down)" : "var(--border)" }}
            >
              <p className="text-sm font-medium text-text">
                Read these {result.horizon.label} calls against this
              </p>
              <ul className="mt-3 space-y-2">
                {result.caveats.map((caveat) => (
                  <li key={caveat} className="text-sm leading-relaxed text-text-muted">
                    {caveat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unreadable.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
              <p className="px-4 py-2.5 text-xs uppercase tracking-wide text-text-faint">
                {unreadable.length.toLocaleString()} could not be read
              </p>
              {/*
                An exchange scan produces hundreds of these — a young listing
                has no 300 hourly bars to measure an edge on, which is a fact
                about the symbol rather than a failure. Reasons are grouped so
                that fact is legible; the first few are named so it is checkable.
              */}
              <div className="border-t border-border px-4 py-3">
                {Object.entries(
                  unreadable.reduce<Record<string, string[]>>((acc, row) => {
                    const reason = row.unavailable || "no reading";
                    (acc[reason] ??= []).push(row.symbol);
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, 6)
                  .map(([reason, symbols]) => (
                    <div key={reason} className="mb-3 last:mb-0">
                      <p className="text-sm text-text-muted">
                        {symbols.length.toLocaleString()} · {reason}
                      </p>
                      <p className="mt-1 font-mono text-xs text-text-faint">
                        {symbols.slice(0, 12).join(" ")}
                        {symbols.length > 12 ? " …" : ""}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </motion.section>
      )}
    </main>
  );
}
