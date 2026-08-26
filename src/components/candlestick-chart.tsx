"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Bar } from "@/lib/api";
import { DrawIn } from "./draw-in";

export interface Overlay {
  name: string;
  values: (number | null)[];
}

/**
 * Overlay line colours.
 *
 * Deliberately not the candle colours, and deliberately not `--up`/`--down`:
 * a study line reading as "up" or "down" would claim agreement with the price
 * it is drawn against. `charts.py` makes the same choice for the same reason.
 * The accent leads; the rest are neutral weights of it.
 *
 * Exported so a picker can dot its chips in the colour the line will be drawn
 * in — the legend is not the only place that mapping has to hold.
 */
export const OVERLAY_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 55%, var(--text))",
  "var(--text-muted)",
  "color-mix(in srgb, var(--accent) 40%, var(--text-faint))",
];

/**
 * Trade markers, in CSS pixels.
 *
 * Pixels and not viewBox units, because the viewBox is 100 wide however many
 * bars are in it: at five years of dailies a bar is 0.08 units, and a marker
 * sized off that slot came out two thirds of a pixel wide and a quarter of a
 * pixel tall. The markers were drawn, counted in the heading, and invisible.
 * A marker means the same thing on a 60-bar window as on a 1,256-bar one, so
 * it is the one piece of this chart that does not scale with the data.
 */
const MARKER = { half: 4.5, height: 8, gap: 3 } as const;

/** Price gridlines, as fractions of the drawn range, top to bottom. */
const GRID = [0, 0.25, 0.5, 0.75, 1];

/** Two decimals, no locale — the server and the browser must agree. */
export function priceText(value: number): string {
  return value.toFixed(2);
}

/** Volume reads as a magnitude, so it is written as one. */
export function volumeText(value: number): string {
  const size = Math.abs(value);
  if (size >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (size >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (size >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * Date ticks compress with the window: five years labelled to the day is five
 * strings that differ in their last two characters, and one month labelled to
 * the month is one string repeated five times.
 */
function dateTicks(bars: Bar[], count = 5): { at: number; label: string }[] {
  const last = bars.length - 1;
  const span = (Date.parse(bars[last].date) - Date.parse(bars[0].date)) / 86_400_000;
  const monthly = !Number.isFinite(span) || span > 400;
  const seen = new Set<number>();
  const out: { at: number; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = Math.round((i * last) / (count - 1));
    if (seen.has(at)) continue;
    seen.add(at);
    const date = bars[at].date;
    out.push({ at, label: monthly ? date.slice(0, 7) : date.slice(5, 10) });
  }
  return out;
}

export function CandlestickChart({
  bars,
  overlays = [],
  buys = [],
  sells = [],
  bare = false,
  axes = false,
  volume = false,
  plotClassName = "h-64",
  hoverIndex = null,
  onHoverIndex,
}: {
  bars: Bar[];
  overlays?: Overlay[];
  /**
   * Indices into `bars` where a strategy opened and closed. Drawn as
   * triangles below and above the candle rather than as coloured candles,
   * because the candle's own colour already means something else.
   */
  buys?: number[];
  sells?: number[];
  /** Drop the card chrome, for a chart already inside a panel. */
  bare?: boolean;
  /** Price gridlines, a price gutter, and date ticks along the foot. */
  axes?: boolean;
  /** A volume strip under the candles, on its own scale. */
  volume?: boolean;
  /**
   * The height of the price plot. Its own prop because the plot is a sized
   * box the svg fills absolutely, not an svg carrying a height class: the
   * crosshair and the axis labels are HTML laid over that box.
   */
  plotClassName?: string;
  /**
   * The bar the reader is pointing at, owned by the page so the panes below
   * can line their own crosshairs up with it. Reading an indicator against
   * the candle it was computed from is the whole point of a pane.
   */
  hoverIndex?: number | null;
  /** Supplying this is what makes the chart interactive. */
  onHoverIndex?: (index: number | null) => void;
}) {
  // The svg's rendered size, for the geometry that has to stay pixel-sized.
  // `preserveAspectRatio="none"` stretches the viewBox by a different factor
  // on each axis, so there is no scale factor to hard-code and nothing that
  // `vector-effect` can rescue for a filled shape.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (bars.length === 0) return null;

  const width = 100;
  const height = 40;

  // The scale has to cover the overlays too, or a study drawn outside the
  // candles' range escapes the chart.
  const overlayValues = overlays.flatMap((o) =>
    o.values.filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  const high = Math.max(...bars.map((b) => b.high), ...overlayValues);
  const low = Math.min(...bars.map((b) => b.low), ...overlayValues);
  const range = high - low || 1;
  const slot = width / bars.length;
  const bodyWidth = Math.min(slot * 0.6, 1.2);

  const y = (price: number) => height - ((price - low) / range) * height;

  // Percentages, for the HTML laid over the plot. The crosshair, the gutter
  // labels and the last-price chip are text and chrome, and text inside a
  // viewBox stretched by `preserveAspectRatio="none"` is text pulled out of
  // shape. Only geometry belongs in the svg.
  const leftPct = (index: number) => ((index + 0.5) / bars.length) * 100;
  const topPct = (price: number) => ((high - price) / range) * 100;

  const overlayPath = (values: (number | null)[]) => {
    let out = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      const x = i * slot + slot / 2;
      out += `${pen ? "L" : "M"}${x.toFixed(2)},${y(v).toFixed(2)} `;
      pen = true;
    });
    return out.trim();
  };

  // A marker sits a little clear of the candle it belongs to, so it never
  // hides the bar it is pointing at. Drawn in the pixel space set up below,
  // so `i` still indexes `bars` but the size is its own.
  const marker = (i: number, side: "buy" | "sell") => {
    const bar = bars[i];
    if (!bar || !box) return null;
    const x = ((i * slot + slot / 2) / width) * box.w;
    const edge = (y(side === "buy" ? bar.low : bar.high) / height) * box.h;
    const tip = side === "buy" ? edge + MARKER.gap : edge - MARKER.gap;
    const base = side === "buy" ? tip + MARKER.height : tip - MARKER.height;
    return (
      // Faded in by `.mark-in` rather than by Motion: these mount a render
      // after the chart around them, and Motion skips the entrance animation
      // of an element that arrives into a variant tree its parent has already
      // played. See `globals.css`.
      <polygon
        key={`${side}-${i}`}
        className="mark-in"
        points={`${x},${tip} ${x - MARKER.half},${base} ${x + MARKER.half},${base}`}
        fill={side === "buy" ? "var(--up)" : "var(--down)"}
      />
    );
  };

  const lastBar = bars[bars.length - 1];
  const at = hoverIndex !== null && bars[hoverIndex] ? hoverIndex : null;
  const cursor = at === null ? null : bars[at];
  const peak = Math.max(...bars.map((b) => b.volume), 0);

  // A pointer position is read as a bar index, not as a price: the reader is
  // pointing at a candle, and snapping to it is what makes the readout above
  // the chart true rather than approximately true.
  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onHoverIndex) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * bars.length);
    onHoverIndex(Math.min(Math.max(index, 0), bars.length - 1));
  };

  const body = (
    <>
      <div className="flex gap-2">
        <div
          className="relative min-w-0 flex-1"
          onPointerMove={track}
          onPointerLeave={() => onHoverIndex?.(null)}
        >
          <div className={`relative w-full ${plotClassName}`}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              {axes &&
                GRID.map((fraction) => (
                  <line
                    key={fraction}
                    x1={0}
                    x2={width}
                    y1={fraction * height}
                    y2={fraction * height}
                    stroke="var(--border)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

              {bars.map((bar, i) => {
                const bullish = bar.close >= bar.open;
                const color = bullish ? "var(--up)" : "var(--down)";
                const x = i * slot + slot / 2;
                const bodyTop = y(Math.max(bar.open, bar.close));
                const bodyBottom = y(Math.min(bar.open, bar.close));

                return (
                  <motion.g
                    key={bar.date}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.004, 0.6) }}
                  >
                    <line
                      x1={x}
                      x2={x}
                      y1={y(bar.high)}
                      y2={y(bar.low)}
                      stroke={color}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={x - bodyWidth / 2}
                      y={bodyTop}
                      width={bodyWidth}
                      height={Math.max(bodyBottom - bodyTop, 0.15)}
                      fill={color}
                    />
                  </motion.g>
                );
              })}

              {overlays.map((overlay, index) => (
                <DrawIn key={overlay.name} width={width} height={height}>
                  <path
                    d={overlayPath(overlay.values)}
                    fill="none"
                    stroke={OVERLAY_COLORS[index % OVERLAY_COLORS.length]}
                    strokeWidth={1.75}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </DrawIn>
              ))}

              {/* Markers last, and in their own space: the group undoes the
                  viewBox's stretch, so everything inside it is CSS pixels. */}
              {box && box.w > 0 && box.h > 0 && (
                <g transform={`scale(${width / box.w} ${height / box.h})`}>
                  {buys.map((i) => marker(i, "buy"))}
                  {sells.map((i) => marker(i, "sell"))}
                </g>
              )}
            </svg>

            {/* The last close, carried across the plot so any candle can be
                read against where the series actually ended. */}
            {axes && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-hover"
                style={{ top: `${topPct(lastBar.close)}%` }}
              />
            )}

            {at !== null && cursor && (
              <div
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${leftPct(at)}%`, top: `${topPct(cursor.close)}%` }}
              />
            )}
          </div>

          {volume && (
            <div className="relative mt-1 h-10 w-full">
              <svg
                viewBox={`0 0 ${width} 10`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                {bars.map((bar, i) => {
                  const tall = peak > 0 ? (bar.volume / peak) * 10 : 0;
                  return (
                    <rect
                      key={bar.date}
                      x={i * slot + slot / 2 - bodyWidth / 2}
                      width={bodyWidth}
                      y={10 - tall}
                      height={Math.max(tall, 0.05)}
                      fill={bar.close >= bar.open ? "var(--up)" : "var(--down)"}
                      opacity={at === i ? 0.9 : 0.32}
                    />
                  );
                })}
              </svg>
            </div>
          )}

          {/* One line through the price plot and the volume strip: they are
              one reading of one bar, so they get one crosshair. */}
          {at !== null && cursor && (
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-border-hover"
              style={{ left: `${leftPct(at)}%` }}
            />
          )}
        </div>

        {axes && (
          <div className="relative w-12 shrink-0 font-mono text-xs tabular-nums text-text-faint">
            {GRID.map((fraction) => (
              // A gridline's label gives way to the live one rather than
              // overprinting it: two prices in the same place is worse than
              // four ticks instead of five.
              <span
                key={fraction}
                className="absolute right-0 -translate-y-1/2"
                style={{
                  top: `${fraction * 100}%`,
                  opacity:
                    Math.abs(fraction * 100 - topPct((cursor ?? lastBar).close)) < 5
                      ? 0
                      : undefined,
                }}
              >
                {priceText(high - fraction * range)}
              </span>
            ))}
            {/* The one price the reader is actually asking about, in the one
                place a price axis is read. */}
            <span
              className="absolute right-0 -translate-y-1/2 rounded bg-surface-raised px-1 text-text"
              style={{ top: `${topPct((cursor ?? lastBar).close)}%` }}
            >
              {priceText((cursor ?? lastBar).close)}
            </span>
          </div>
        )}
      </div>

      {axes ? (
        <div className="mt-2 flex gap-2">
          <div className="relative h-4 min-w-0 flex-1 font-mono text-xs text-text-faint">
            {dateTicks(bars).map((tick, i, all) => {
              const first = i === 0;
              const final = i === all.length - 1;
              return (
                <span
                  key={tick.at}
                  className={`absolute top-0 ${
                    first ? "left-0" : final ? "right-0" : "-translate-x-1/2"
                  }`}
                  style={first || final ? undefined : { left: `${leftPct(tick.at)}%` }}
                >
                  {tick.label}
                </span>
              );
            })}
          </div>
          <div className="w-12 shrink-0" />
        </div>
      ) : (
        <div className="mt-2 flex justify-between text-sm text-text-faint">
          <span>{bars[0].date.slice(0, 10)}</span>
          <span>{bars[bars.length - 1].date.slice(0, 10)}</span>
        </div>
      )}

      {overlays.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
          {overlays.map((overlay, index) => {
            const value = overlay.values[at ?? overlay.values.length - 1];
            return (
              <span
                key={overlay.name}
                className="flex items-center gap-2 text-sm text-text-muted"
              >
                <span
                  className="inline-block h-0.5 w-4"
                  style={{ background: OVERLAY_COLORS[index % OVERLAY_COLORS.length] }}
                />
                {overlay.name}
                {typeof value === "number" && Number.isFinite(value) && (
                  <span className="font-mono tabular-nums text-text">
                    {priceText(value)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </>
  );

  // Bare when the chart is already inside a panel that has its own border and
  // heading; boxed when it stands alone, which is how every other page uses it.
  return bare ? (
    body
  ) : (
    <div className="rounded-xl border border-border bg-surface p-5">{body}</div>
  );
}
