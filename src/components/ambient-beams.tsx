"use client";

import { motion } from "motion/react";

/**
 * One ambient background effect per screen, per the manifesto (rule 5).
 * Amplitude is muted deliberately: low opacity, slow drift, blurred —
 * peripheral texture, not a focal point.
 */
export function AmbientBeams() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div
        className="absolute -left-1/4 top-[-10%] h-[60vh] w-[60vh] rounded-full bg-accent/10 blur-[120px]"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 20, 40, 0],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-10%] top-[10%] h-[50vh] w-[50vh] rounded-full bg-accent/5 blur-[140px]"
        animate={{
          x: [0, -30, 10, 0],
          y: [0, 30, -10, 0],
        }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
