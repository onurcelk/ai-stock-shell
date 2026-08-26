"use client";

import { motion } from "motion/react";
import { DrawIn } from "./draw-in";

export interface Series {
  name: string;
  values: (number | null)[];
  /** A token, not a hex. Roles are assigned by meaning — see the pages. */
  color: string;
  /** Stroke weight in CSS pixels — not viewBox units. See STROKE below. */
  width?: number;
  dashed?: boolean;
}

/**
 * Strokes are declared in CSS pixels and drawn with `non-scaling-stroke`, so a
 * line reads the same weight whatever the container does to the viewBox. The
 * viewBox is 100 units wide against a ~700px box, so a plain `strokeWidth` here
 * would be multiplied by ~7 — which is how these lines got fat.
 *
 * That is also what lets every chart carry `preserveAspectRatio="none"` and
 * fill its card. The default (`xMidYMid meet`) scales 100x40 uniformly, so a
 * 700x224 card was drawn 560px wide and centred — a seventh of the card left
 * empty on each side, and the line thickened to fill the height it did use.
 * Stretching the geometry is right for a chart drawn to fit its box; it would
 * only be wrong if the stroke stretched with it, and it no longer does.
 */
const STROKE = { series: 1.75, guide: 1 } as const;
const DASH = { series: "6 4", guide: "3 4" } as const;

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
  className = "h-56",
  hoverIndex = null,
  onHoverIndex,
}: {
  series: Series[];
  /**
   * Horizontal guides the series is read against — an oscillator's published
   * thresholds, a coin-flip line, a starting stake. These are the whole reason
   * an oscillator reading means anything, so they are drawn, not implied.
   */
  references?: number[];
  height?: number;
  /** The drawn height. A pane stacked under a price chart wants less of it. */
  className?: string;
  /**
   * The sample the reader is pointing at, held by the page rather than by the
   * pane: several panes over one series are several readings of the same bar,
   * and a crosshair that only moved in the pane under the cursor would be
   * inviting the eye to compare two different bars.
   */
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
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

  const track = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onHoverIndex) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const index = Math.round(((event.clientX - rect.left) / rect.width) * steps);
    onHoverIndex(Math.min(Math.max(index, 0), longest - 1));
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        className={`${className} w-full overflow-visible`}
        onPointerMove={track}
        onPointerLeave={() => onHoverIndex?.(null)}>
      {references.map((level) => (
        <line
          key={level}
          x1={0}
          x2={width}
          y1={y(level)}
          y2={y(level)}
          stroke="var(--text-faint)"
          strokeWidth={STROKE.guide}
          vectorEffect="non-scaling-stroke"
          // Zero is an axis; the others are thresholds and read as guides.
          strokeDasharray={level === 0 ? undefined : DASH.guide}
        />
      ))}
      {series.map((s, index) => (
        // Revealed by clipping, not by `pathLength` — see `DrawIn`, which
        // carries the reason. A dashed series keeps its own dashes.
        <DrawIn
          key={s.name}
          width={width}
          height={height}
          delay={index * 0.08}
        >
          <path
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? STROKE.series}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? DASH.series : undefined}
          />
        </DrawIn>
      ))}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < longest && (
        <line
          x1={x(hoverIndex)}
          x2={x(hoverIndex)}
          y1={0}
          y2={height}
          stroke="var(--border-hover)"
          strokeWidth={STROKE.guide}
          vectorEffect="non-scaling-stroke"
        />
      )}
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
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        className="h-56 w-full overflow-visible">
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
          strokeWidth={STROKE.guide}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={DASH.guide}
        />
      )}
    </svg>
  );
}

/** The last number a series actually reported, for a legend readout. */
function reading(values: (number | null)[], at: number | null): number | null {
  if (at !== null) return values[at] ?? null;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

/** A small key, so a multi-series chart is readable without hovering. */
export function Legend({
  series,
  readout = false,
  at = null,
  className = "mt-3",
}: {
  series: Series[];
  /** Where the key sits. A pane that carries it in its heading wants no gap. */
  className?: string;
  /**
   * Carry each series' value in the key. A legend that names four lines and
   * leaves the reader to guess their level is half a legend — but only the
   * pages that hand it an index have a bar for "value" to mean, so it is off
   * by default.
   */
  readout?: boolean;
  /** The sample to read, or the last reported one when null. */
  at?: number | null;
}) {
  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-1 ${className}`}>
      {series.map((s) => {
        const value = readout ? reading(s.values, at) : null;
        return (
          <span key={s.name} className="flex items-center gap-2 text-sm text-text-muted">
            <span
              className="inline-block h-px w-4"
              style={{ background: s.color, height: s.dashed ? 1 : 2 }}
            />
            {s.name}
            {value !== null && (
              <span className="font-mono tabular-nums text-text">{value.toFixed(2)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
