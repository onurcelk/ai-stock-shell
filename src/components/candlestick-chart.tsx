"use client";

import { motion } from "motion/react";
import type { Bar } from "@/lib/api";

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
 */
const OVERLAY_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 55%, var(--text))",
  "var(--text-muted)",
  "color-mix(in srgb, var(--accent) 40%, var(--text-faint))",
];

export function CandlestickChart({
  bars,
  overlays = [],
  buys = [],
  sells = [],
  bare = false,
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
}) {
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
  // hides the bar it is pointing at.
  const marker = (i: number, side: "buy" | "sell") => {
    const bar = bars[i];
    if (!bar) return null;
    const x = i * slot + slot / 2;
    const size = Math.min(slot * 0.5, 0.9);
    const tip = side === "buy" ? y(bar.low) + 0.6 : y(bar.high) - 0.6;
    const base = side === "buy" ? tip + size : tip - size;
    return (
      <motion.polygon
        key={`${side}-${i}`}
        points={`${x},${tip} ${x - size},${base} ${x + size},${base}`}
        fill={side === "buy" ? "var(--up)" : "var(--down)"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.95 }}
        transition={{ duration: 0.3 }}
      />
    );
  };

  const body = (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
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
                strokeWidth={0.15}
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
          <motion.path
            key={overlay.name}
            d={overlayPath(overlay.values)}
            fill="none"
            stroke={OVERLAY_COLORS[index % OVERLAY_COLORS.length]}
            strokeWidth={0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
          />
        ))}
        {buys.map((i) => marker(i, "buy"))}
        {sells.map((i) => marker(i, "sell"))}
      </svg>

      <div className="mt-2 flex justify-between text-sm text-text-faint">
        <span>{bars[0].date.slice(0, 10)}</span>
        <span>{bars[bars.length - 1].date.slice(0, 10)}</span>
      </div>

      {overlays.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
          {overlays.map((overlay, index) => (
            <span
              key={overlay.name}
              className="flex items-center gap-2 text-sm text-text-muted"
            >
              <span
                className="inline-block h-0.5 w-4"
                style={{ background: OVERLAY_COLORS[index % OVERLAY_COLORS.length] }}
              />
              {overlay.name}
            </span>
          ))}
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
