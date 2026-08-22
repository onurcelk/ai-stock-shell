"use client";

import { motion } from "motion/react";
import type { Bar } from "@/lib/api";

export function CandlestickChart({ bars }: { bars: Bar[] }) {
  if (bars.length === 0) return null;

  const width = 100;
  const height = 40;
  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
  const range = high - low || 1;
  const slot = width / bars.length;
  const bodyWidth = Math.min(slot * 0.6, 1.2);

  const y = (price: number) => height - ((price - low) / range) * height;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
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
      </svg>
      <div className="mt-2 flex justify-between text-sm text-text-faint">
        <span>{bars[0].date.slice(0, 10)}</span>
        <span>{bars[bars.length - 1].date.slice(0, 10)}</span>
      </div>
    </div>
  );
}
