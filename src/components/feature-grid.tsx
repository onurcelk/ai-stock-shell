"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionOut } from "@/lib/motion";

const features = [
  {
    title: "Predict",
    body: "Stamp a call, state a confidence, get graded against real prices once the horizon elapses.",
  },
  {
    title: "Screen",
    body: "Scan the watchlist against live snapshots — price, volume, and factor exposure in one pass.",
  },
  {
    title: "Book",
    body: "Paper positions with enforced risk limits — sizing and orders never touch a real market.",
  },
  {
    title: "Score",
    body: "Hit rate, Brier, and a leaderboard per agent — confidence intervals included, not narrated away.",
  },
];

export function FeatureGrid() {
  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {features.map((feature) => (
        <motion.div
          key={feature.title}
          variants={staggerItem}
          whileHover={{ y: -2, borderColor: "var(--border-hover)" }}
          transition={transitionOut}
          className="rounded-xl border border-border bg-surface p-6"
        >
          <h3 className="text-lg font-medium text-text">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {feature.body}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
