"use client";

import { motion } from "motion/react";
import { DrawIn } from "./draw-in";

/**
 * The simulated cone: sampled paths, the 5–95 band, and the median.
 *
 * Everything drawn here came out of `montecarlo.run` — the paths are already
 * sampled server-side and the band is a plain quantile across them. Nothing is
 * modelled in the browser.
 *
 * Deliberately not `--up`/`--down`: those are reserved for signed financial
 * deltas, and a projection cone is neither a gain nor a loss. It is one accent,
 * at three weights.
 */
export function FanChart({
  paths,
  median,
  low,
  high,
  startPrice,
}: {
  paths: number[][];
  median: number[];
  low: number[];
  high: number[];
  startPrice: number;
}) {
  if (median.length === 0) return null;

  const width = 100;
  const height = 40;
  const steps = median.length - 1 || 1;

  // The domain has to cover the drawn paths, not just the band — individual
  // paths routinely run outside the 5–95 quantiles, and a domain derived from
  // the band alone lets them escape the card.
  let min = Math.min(...low, startPrice);
  let max = Math.max(...high, startPrice);
  for (const path of paths) {
    for (const v of path) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;

  const x = (i: number) => (i / steps) * width;
  const y = (v: number) => height - ((v - min) / range) * height;
  const line = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

  // Up one side of the band and back down the other.
  const band =
    `${line(high)} ` +
    low
      .map((v, i) => `L${x(low.length - 1 - i).toFixed(2)},${y(low[low.length - 1 - i]).toFixed(2)}`)
      .join(" ") +
    " Z";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        className="h-64 w-full overflow-visible">
      <path d={band} fill="var(--accent)" opacity={0.12} />

      {paths.map((path, i) => (
        <path
          key={i}
          d={line(path)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          opacity={0.18}
        />
      ))}

      <line
        x1={0}
        x2={width}
        y1={y(startPrice)}
        y2={y(startPrice)}
        stroke="var(--text-faint)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeDasharray="3 4"
      />

      <DrawIn width={width} height={height} duration={0.9}>
        <path
          d={line(median)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </DrawIn>
    </svg>
  );
}

/** Where the simulated paths finished, against where they started. */
export function EndingsHistogram({
  edges,
  counts,
  startPrice,
}: {
  edges: number[];
  counts: number[];
  startPrice: number;
}) {
  if (counts.length === 0) return null;

  const width = 100;
  const height = 40;
  const tallest = Math.max(...counts) || 1;
  const first = edges[0];
  const last = edges[edges.length - 1];
  const span = last - first || 1;
  const slot = width / counts.length;

  const markerX = ((startPrice - first) / span) * width;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        className="h-64 w-full overflow-visible">
      {counts.map((count, i) => {
        const barHeight = (count / tallest) * height;
        return (
          <motion.rect
            key={i}
            x={i * slot}
            width={Math.max(slot - 0.2, 0.2)}
            y={height - barHeight}
            height={barHeight}
            fill="var(--accent)"
            opacity={0.55}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            style={{ transformOrigin: `0px ${height}px` }}
            transition={{ duration: 0.5, delay: Math.min(i * 0.006, 0.4) }}
          />
        );
      })}

      {markerX >= 0 && markerX <= width && (
        <line
          x1={markerX}
          x2={markerX}
          y1={0}
          y2={height}
          stroke="var(--text-muted)"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="3 4"
        />
      )}
    </svg>
  );
}
