"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { springSnappy, transitionOut } from "@/lib/motion";

export function GradientButton({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <motion.a
      href={href ?? "#"}
      className="relative inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-bg"
      style={{
        background:
          "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, white))",
      }}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...transitionOut, scale: springSnappy, y: springSnappy }}
    >
      {children}
    </motion.a>
  );
}
