"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function ShimmerHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.h1
      className={`bg-clip-text text-transparent bg-[linear-gradient(110deg,var(--text)_35%,var(--accent)_50%,var(--text)_65%)] bg-[length:220%_100%] ${className}`}
      animate={{ backgroundPosition: ["220% 0", "-220% 0"] }}
      transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.h1>
  );
}
