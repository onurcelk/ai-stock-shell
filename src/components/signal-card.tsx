"use client";

import { motion } from "motion/react";
import { transitionInOut, springSoft } from "@/lib/motion";
import { actionColor, actionLabel } from "@/lib/actions";
import type { UltimateVerdict } from "@/lib/api";

export function SignalCard({ verdict }: { verdict: UltimateVerdict }) {
  const color = actionColor(verdict.action);
  // -100..+100 score mapped to a 0..100% position on the sell<->buy meter.
  const meterPosition = ((verdict.score + 100) / 200) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionInOut}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-text-muted">{verdict.symbol}</p>
          <motion.h2
            key={verdict.action}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className="mt-1 text-[clamp(2rem,5vw,3.5rem)] font-sans font-semibold"
            style={{ color }}
          >
            {actionLabel(verdict.action)}
          </motion.h2>
        </div>
        <p className="font-mono text-lg text-text-muted">
          {verdict.last_price.toFixed(2)}
        </p>
      </div>

      <div className="mt-6">
        <div className="relative h-1.5 w-full rounded-full bg-border">
          <motion.div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ left: "50%" }}
            animate={{ left: `${meterPosition}%` }}
            transition={springSoft}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-text-faint">
          <span>STRONG SELL</span>
          <span>NEUTRAL</span>
          <span>STRONG BUY</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <p className="text-sm text-text-muted">Score</p>
          <p className="mt-1 font-mono text-lg text-text">
            {verdict.score >= 0 ? "+" : ""}
            {verdict.score.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-sm text-text-muted">Confidence</p>
          <p className="mt-1 font-mono text-lg text-text">
            {verdict.confidence.toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-text-muted">Alignment</p>
          <p className="mt-1 font-mono text-lg text-text">{verdict.alignment}</p>
        </div>
      </div>
    </motion.div>
  );
}
