"use client";

import { motion } from "motion/react";
import { staggerItem } from "@/lib/motion";
import { actionColor, actionLabel } from "@/lib/actions";
import type { HorizonVerdict } from "@/lib/api";

export function HorizonCard({ horizon }: { horizon: HorizonVerdict }) {
  const color = actionColor(horizon.action);
  const liveReadings = horizon.readings.filter((r) => r.weight > 0);

  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{horizon.horizon.label}</p>
        <p className="text-sm text-text-faint">{horizon.interval}</p>
      </div>
      <p className="mt-2 font-sans text-xl font-semibold" style={{ color }}>
        {actionLabel(horizon.action)}
      </p>
      <p className="mt-1 font-mono text-sm text-text-muted">
        {horizon.score >= 0 ? "+" : ""}
        {horizon.score.toFixed(0)} &middot; {horizon.confidence.toFixed(0)}% confidence
      </p>
      <p className="mt-3 text-sm text-text-faint">
        {liveReadings.length === 0
          ? "No source cleared significance here, so this horizon contributes no confidence at all."
          : `${liveReadings.length} of ${horizon.readings.length} sources counted toward this call.`}
      </p>
    </motion.div>
  );
}
