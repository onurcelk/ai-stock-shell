"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut, transitionOut } from "@/lib/motion";
import {
  getOhlcv,
  getStudies,
  getStudyCatalogue,
  getStats,
  getEvidence,
  getEvidenceCatalogue,
  ApiError,
  type OhlcvResponse,
  type StudiesResponse,
  type StudiesCatalogue,
  type StatsResponse,
  type EvidenceCatalogue,
  type EvidenceResponse,
} from "@/lib/api";
import {
  CandlestickChart,
  priceText,
  volumeText,
  type Overlay,
} from "@/components/candlestick-chart";
import { LineSeries, Legend, type Series } from "@/components/series-chart";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "5y"];

/**
 * Enough distinct colours for several sources sharing one axis.
 *
 * They can share it because every source in `indicators.SOURCES` returns
 * [-1, +1] by contract, which is exactly what an RSI and a MACD histogram
 * cannot do — hence one evidence pane, against one study pane per study.
 */
const EVIDENCE_COLORS = [
  "var(--accent)",
  "var(--up)",
  "var(--down)",
  "color-mix(in srgb, var(--accent) 55%, var(--text))",
  "var(--text-muted)",
  "color-mix(in srgb, var(--up) 55%, var(--text))",
];

const OSCILLATOR_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 50%, var(--text))",
  "var(--text-muted)",
];

/** The chip every picker in the rail is made of. */
function Chip({
  on,
  dim,
  dot,
  title,
  onClick,
  children,
}: {
  on: boolean;
  /** Offered, but this series cannot support it — see the note under the list. */
  dim?: boolean;
  /** The colour this series will be drawn in, when the mapping is exact. */
  dot?: string;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      variants={staggerItem}
      whileHover={{ y: -1 }}
      transition={transitionOut}
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        on
          ? "border-accent bg-accent-dim text-text"
          : "border-border text-text-muted hover:border-border-hover hover:text-text"
      } ${dim ? "opacity-40" : ""}`}
    >
      {dot && on && (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
        />
      )}
      {children}
    </motion.button>
  );
}

/** A pane under the price chart: one heading row, its key, and the series. */
function Pane({
  name,
  note,
  series,
  levels,
  hover,
  onHover,
}: {
  name: string;
  note?: string;
  series: Series[];
  levels: number[];
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionInOut}
      className="rounded-xl border border-border bg-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm text-text">{name}</h2>
        <Legend series={series} readout at={hover} className="mt-0" />
      </div>
      {/* The price chart's gutter, repeated: a pane is read bar-against-bar
          with the candles above it, so the two plots have to start and stop
          at the same x or the shared crosshair is a lie. */}
      <div className="mt-2 pr-14">
        <LineSeries
          series={series}
          references={levels}
          className="h-28"
          hoverIndex={hover}
          onHoverIndex={onHover}
        />
      </div>
      {note && <p className="mt-2 text-xs text-text-faint">{note}</p>}
    </motion.section>
  );
}

export default function ChartPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [inputValue, setInputValue] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedEvidence, setPickedEvidence] = useState<string[]>([]);
  // Which bar the reader is pointing at, held here rather than in the chart:
  // the price plot and every pane under it are readings of the same series,
  // and one crosshair across all of them is what makes them comparable.
  const [hover, setHover] = useState<number | null>(null);
  // The rail is a sidebar on a wide screen and a disclosure on a narrow one.
  // A picker that pushes the chart off the first screen is the thing this
  // layout exists to avoid.
  const [railOpen, setRailOpen] = useState(false);

  const [data, setData] = useState<OhlcvResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [catalogue, setCatalogue] = useState<StudiesCatalogue | null>(null);
  const [studies, setStudies] = useState<StudiesResponse | null>(null);
  const [evidenceMeta, setEvidenceMeta] = useState<EvidenceCatalogue | null>(null);
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const symbolInput = useRef<HTMLInputElement | null>(null);

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
    getEvidenceCatalogue()
      .then((response) => {
        if (!ignore) setEvidenceMeta(response);
      })
      .catch(() => {
        /* Same: the chart is the page, the pickers are additions to it. */
      });
    return () => {
      ignore = true;
    };
  }, []);

  // "/" reaches the one input on the page, from anywhere on it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      symbolInput.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // The same window and the same slicing rule as the studies above, for the
  // same reason: a source fitted to whatever range is on screen would change
  // its own reading every time the range buttons were pressed.
  useEffect(() => {
    if (pickedEvidence.length === 0 || barCount === 0) return;
    let ignore = false;

    getEvidence(symbol, pickedEvidence, { period, bars: barCount })
      .then((response) => {
        if (!ignore) setEvidence(response);
      })
      .catch(() => {
        /* A source that will not compute leaves the chart itself intact. */
      });

    return () => {
      ignore = true;
    };
  }, [symbol, period, pickedEvidence, barCount]);

  const bars = data?.bars ?? [];
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

  // One pane, not one per source: they share an axis honestly because they
  // share a scale. `silent` never becomes a series — a flat line at zero reads
  // as a measured neutral, which is a claim no source made.
  const drawnEvidence = pickedEvidence.length > 0 ? evidence : null;
  const evidenceMetaByKey = new Map(
    evidenceMeta?.sources.map((source) => [source.key, source]) ?? [],
  );
  const evidenceSeries: Series[] = drawnEvidence
    ? pickedEvidence
        .filter((key) => drawnEvidence.sources[key])
        .map((key, i) => ({
          name: evidenceMetaByKey.get(key)?.name ?? key,
          values: drawnEvidence.sources[key],
          color: EVIDENCE_COLORS[i % EVIDENCE_COLORS.length],
        }))
    : [];
  const silentEvidence = Object.entries(drawnEvidence?.silent ?? {});
  const unsupported = Object.entries(shown?.unsupported ?? {});

  // The colour a source will be drawn in, so its chip can carry the same dot.
  // Drawn sources are indexed after the silent ones are dropped, so the chip
  // has to read the position out of the same filtered list the pane did.
  const evidenceColor = (key: string) => {
    const at = evidenceSeries.findIndex((series) => series.name === (evidenceMetaByKey.get(key)?.name ?? key));
    return at === -1 ? undefined : EVIDENCE_COLORS[at % EVIDENCE_COLORS.length];
  };

  const toggleEvidence = (key: string) =>
    setPickedEvidence((was) =>
      was.includes(key) ? was.filter((k) => k !== key) : [...was, key],
    );

  const toggle = (key: string) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const load = () => {
    const next = inputValue.trim().toUpperCase();
    if (next) setSymbol(next);
  };

  // The bar under the cursor, or the last one when the cursor is elsewhere:
  // a readout that empties when the pointer leaves would make the chart's own
  // header flicker as the mouse crossed it.
  const at = hover !== null && bars[hover] ? hover : bars.length - 1;
  const bar = bars[at];
  const previous = bars[at - 1];
  const change = bar && previous ? bar.close - previous.close : null;
  const changePct = change !== null && previous ? (change / previous.close) * 100 : null;
  const tone = change === null ? "text-text-muted" : change >= 0 ? "text-up" : "text-down";

  const picks = picked.length + pickedEvidence.length;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
        <div className="min-w-0 space-y-4">
          {/* One row: what to load, over what window, and — on a narrow
              screen — the way to the pickers. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitionInOut}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2"
          >
            <div className="relative">
              <input
                ref={symbolInput}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") load();
                }}
                placeholder="AAPL"
                aria-label="Symbol"
                className="w-28 rounded-lg border border-border bg-bg py-1.5 pl-3 pr-7 font-mono text-sm text-text outline-none transition-colors focus:border-accent"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-text-faint">
                /
              </span>
            </div>
            <button
              onClick={load}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
            >
              Load
            </button>

            <div className="mx-1 h-5 w-px bg-border" />

            <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  aria-pressed={p === period}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                    p === period
                      ? "bg-surface-raised text-text"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {loading && (
              <span className="font-mono text-xs text-text-faint">loading…</span>
            )}

            <div className="ml-auto lg:hidden">
              <button
                onClick={() => setRailOpen((open) => !open)}
                aria-expanded={railOpen}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-hover hover:text-text"
              >
                Indicators{picks > 0 ? ` · ${picks}` : ""}
              </button>
            </div>
          </motion.div>

          {error && (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-down">
              {error}
            </p>
          )}

          {!data && !error && (
            <div className="h-80 animate-pulse rounded-xl border border-border bg-surface" />
          )}

          {data && bar && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitionInOut}
              className={`rounded-xl border border-border bg-surface px-4 py-3 transition-opacity ${
                loading ? "opacity-50" : ""
              }`}
            >
              {/* The quote and the bar under the cursor, on one line: the
                  chart's own heading is the readout, so nothing floats over
                  the candles and nothing has to be dismissed. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm tracking-tight text-text">
                  {data.symbol}
                </span>
                <span className="font-mono text-xs text-text-faint">
                  {data.interval} · {period}
                </span>
                <span className="font-mono text-2xl tabular-nums text-text">
                  {priceText(bar.close)}
                </span>
                {change !== null && changePct !== null && (
                  <span className={`font-mono text-sm tabular-nums ${tone}`}>
                    {change >= 0 ? "+" : ""}
                    {priceText(change)} ({change >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%)
                  </span>
                )}

                <span className="ml-auto flex flex-wrap items-baseline gap-x-3 font-mono text-xs tabular-nums text-text-faint">
                  <span className="text-text-muted">{bar.date.slice(0, 10)}</span>
                  <span>O {priceText(bar.open)}</span>
                  <span>H {priceText(bar.high)}</span>
                  <span>L {priceText(bar.low)}</span>
                  <span>C {priceText(bar.close)}</span>
                  {bar.volume > 0 && <span>V {volumeText(bar.volume)}</span>}
                </span>
              </div>

              <div className="mt-3">
                <CandlestickChart
                  bare
                  axes
                  volume
                  bars={bars}
                  overlays={overlays}
                  plotClassName="h-[clamp(16rem,44vh,32rem)]"
                  hoverIndex={hover}
                  onHoverIndex={setHover}
                />
              </div>

              {stats && (
                <>
                  {/* Hairlines rather than five bordered cards: the numbers
                      are one reading of one window, and boxing each of them
                      separately is what made this a page you scrolled. */}
                  {/* Six cells, not five: two, three and six all divide it
                      exactly, so no breakpoint leaves a blank tile behind. */}
                  <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      // Closes, not intraday extremes — `data.describe` reads
                      // `close.max()`/`close.min()`. Sitting an inch under a
                      // price axis that *is* intraday, "range high" would read
                      // as a contradiction of the wick above it.
                      ["Highest close", priceText(stats.stats.high)],
                      ["Lowest close", priceText(stats.stats.low)],
                      [
                        "Change",
                        `${stats.stats.change_pct >= 0 ? "+" : ""}${stats.stats.change_pct.toFixed(2)}%`,
                      ],
                      ["Ann. volatility", `${stats.stats.volatility_pct.toFixed(1)}%`],
                      ["Bars", String(stats.stats.rows)],
                      ["Bars / year", stats.stats.bars_per_year.toFixed(0)],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-surface px-3 py-2">
                        <dt className="text-xs uppercase tracking-wide text-text-faint">
                          {label}
                        </dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-text">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-right font-mono text-xs text-text-faint">
                    {stats.stats.start} → {stats.stats.end}
                  </p>
                </>
              )}
            </motion.section>
          )}

          {data &&
            panes.map((pane) => (
              <Pane
                key={pane.key}
                name={pane.name}
                series={pane.series}
                levels={pane.levels}
                hover={hover}
                onHover={setHover}
              />
            ))}

          {data && evidenceSeries.length > 0 && (
            <Pane
              name="Engine evidence"
              note="Above zero argues to buy and below it to sell — the reading itself, not the weight the verdict gave it."
              series={evidenceSeries}
              levels={[-1, 0, 1]}
              hover={hover}
              onHover={setHover}
            />
          )}
        </div>

        {/* The pickers, out of the chart's way. In DOM order after it, so a
            narrow screen lands on the chart and reaches the rail by asking. */}
        <aside
          className={`${railOpen ? "block" : "hidden"} space-y-3 lg:block lg:sticky lg:top-20 lg:self-start`}
        >
          {catalogue && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm text-text">Studies</h2>
                {picked.length > 0 && (
                  <button
                    onClick={() => setPicked([])}
                    className="text-xs text-text-faint transition-colors hover:text-text"
                  >
                    Clear {picked.length}
                  </button>
                )}
              </div>
              <motion.div
                variants={staggerContainer(0.02)}
                initial="hidden"
                animate="show"
                className="mt-2.5 flex flex-wrap gap-1.5"
              >
                {catalogue.studies.map((study) => (
                  <Chip
                    key={study.key}
                    on={picked.includes(study.key)}
                    dim={Boolean(shown?.unsupported[study.key])}
                    title={shown?.unsupported[study.key] ?? study.describe}
                    onClick={() => toggle(study.key)}
                  >
                    {study.name}
                  </Chip>
                ))}
              </motion.div>
              {unsupported.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs text-text-muted">
                    Not drawable on this series — a fact about the data, not a failure:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {unsupported.map(([key, reason]) => (
                      <li key={key} className="text-xs text-text-faint">
                        {meta.get(key)?.name ?? key} — {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {evidenceMeta && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm text-text">Engine evidence</h2>
                {pickedEvidence.length > 0 && (
                  <button
                    onClick={() => setPickedEvidence([])}
                    className="text-xs text-text-faint transition-colors hover:text-text"
                  >
                    Clear {pickedEvidence.length}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-faint">
                {evidenceMeta.scale}
              </p>

              {Object.entries(evidenceMeta.families).map(([family, describe]) => {
                const inFamily = evidenceMeta.sources.filter(
                  (source) => source.family === family,
                );
                if (inFamily.length === 0) return null;
                return (
                  <div key={family} className="mt-3">
                    <p
                      className="text-xs uppercase tracking-wide text-text-faint"
                      title={describe}
                    >
                      {family}
                    </p>
                    <motion.div
                      variants={staggerContainer(0.02)}
                      initial="hidden"
                      animate="show"
                      className="mt-1.5 flex flex-wrap gap-1.5"
                    >
                      {inFamily.map((source) => {
                        const quiet = drawnEvidence?.silent[source.key];
                        return (
                          <Chip
                            key={source.key}
                            on={pickedEvidence.includes(source.key)}
                            dim={Boolean(quiet)}
                            dot={evidenceColor(source.key)}
                            title={quiet ?? source.describe}
                            onClick={() => toggleEvidence(source.key)}
                          >
                            {source.name}
                          </Chip>
                        );
                      })}
                    </motion.div>
                  </div>
                );
              })}

              {silentEvidence.length > 0 && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs text-text-muted">
                    Asked, and had no opinion on this series — the engine&rsquo;s own
                    convention, and a fact about the data rather than a failure. Drawn
                    as a flat line it would read as a measured neutral, which is a claim
                    none of these made:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {silentEvidence.map(([key, reason]) => (
                      <li key={key} className="text-xs text-text-faint">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
