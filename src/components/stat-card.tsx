"use client";

import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";

function sparkPath(points: number[], width = 100, height = 32) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * A single figure.
 *
 * `delta` and `points` are optional on purpose. `--up`/`--down` are reserved
 * for signed financial deltas, so a card showing a count, a ratio, or a score
 * where "lower is better" must not render one — it would paint a reserved
 * colour onto something that is not a price move. Those cards pass `note`
 * instead, which says what the figure is measured against in plain text.
 */
export function StatCard({
  label,
  value,
  delta,
  points,
  note,
}: {
  label: string;
  value: string;
  delta?: number;
  points?: number[];
  note?: string;
}) {
  const signed = delta !== undefined;
  const positive = (delta ?? 0) >= 0;
  const color = positive ? "var(--up)" : "var(--down)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={transitionInOut}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 font-mono text-2xl text-text">{value}</p>
        </div>
        {signed && (
          <span className="font-mono text-sm" style={{ color }}>
            {positive ? "+" : ""}
            {delta!.toFixed(1)}%
          </span>
        )}
      </div>

      {note && <p className="mt-3 text-sm leading-snug text-text-faint">{note}</p>}

      {points && (
        <svg viewBox="0 0 100 32" className="mt-4 h-8 w-full overflow-visible">
          <motion.path
            d={sparkPath(points)}
            fill="none"
            stroke={signed ? color : "var(--accent)"}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
        </svg>
      )}
    </motion.div>
  );
}
