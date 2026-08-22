"use client";

import { motion } from "motion/react";

export interface Series {
  name: string;
  values: (number | null)[];
  /** A token, not a hex. Roles are assigned by meaning — see the pages. */
  color: string;
  width?: number;
  dashed?: boolean;
}

function domain(series: Series[], extra: number[] = []) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const values = [...all, ...extra];
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

/** One or more series on a shared scale. */
export function LineSeries({
  series,
  references = [],
  height = 40,
}: {
  series: Series[];
  /**
   * Horizontal guides the series is read against — an oscillator's published
   * thresholds, a coin-flip line, a starting stake. These are the whole reason
   * an oscillator reading means anything, so they are drawn, not implied.
   */
  references?: number[];
  height?: number;
}) {
  const longest = Math.max(...series.map((s) => s.values.length), 0);
  if (longest === 0) return null;

  const width = 100;
  const { min, max } = domain(series, references);
  const range = max - min || 1;
  const steps = longest - 1 || 1;

  const x = (i: number) => (i / steps) * width;
  const y = (v: number) => height - ((v - min) / range) * height;

  // A null breaks the line rather than interpolating across a gap that was
  // never measured.
  const path = (values: (number | null)[]) => {
    let out = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      out += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
      pen = true;
    });
    return out.trim();
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
      {references.map((level) => (
        <line
          key={level}
          x1={0}
          x2={width}
          y1={y(level)}
          y2={y(level)}
          stroke="var(--text-faint)"
          strokeWidth={0.15}
          // Zero is an axis; the others are thresholds and read as guides.
          strokeDasharray={level === 0 ? undefined : "1 1"}
        />
      ))}
      {series.map((s, index) => (
        <motion.path
          key={s.name}
          d={path(s.values)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 0.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? "1.5 1" : undefined}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: index * 0.08, ease: [0.65, 0, 0.35, 1] }}
        />
      ))}
    </svg>
  );
}

/** Discrete readings — one bar per fold, per trial. */
export function BarSeries({
  values,
  reference,
  color = "var(--accent)",
  height = 40,
}: {
  values: number[];
  reference?: number;
  color?: string;
  height?: number;
}) {
  if (values.length === 0) return null;

  const width = 100;
  const min = Math.min(0, ...values);
  const max = Math.max(...values, reference ?? 0);
  const range = max - min || 1;
  const slot = width / values.length;

  const y = (v: number) => height - ((v - min) / range) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
      {values.map((v, i) => (
        <motion.rect
          key={i}
          x={i * slot + slot * 0.15}
          width={slot * 0.7}
          y={y(v)}
          height={Math.max(y(min) - y(v), 0.3)}
          fill={color}
          opacity={0.7}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          style={{ transformOrigin: `0px ${height}px` }}
          transition={{ duration: 0.45, delay: i * 0.05 }}
        />
      ))}
      {reference !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(reference)}
          y2={y(reference)}
          stroke="var(--text-faint)"
          strokeWidth={0.2}
          strokeDasharray="1 1"
        />
      )}
    </svg>
  );
}

/** A small key, so a multi-series chart is readable without hovering. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-2 text-sm text-text-muted">
          <span
            className="inline-block h-px w-4"
            style={{ background: s.color, height: s.dashed ? 1 : 2 }}
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}
