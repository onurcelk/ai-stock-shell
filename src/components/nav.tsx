"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut, transitionOut } from "@/lib/motion";

const links = ["Research", "Predictions", "Book", "Docs"];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="show"
      className="sticky top-4 z-20 mx-auto w-[min(920px,calc(100%-2rem))]"
    >
      <header className="flex items-center justify-between rounded-full border border-border bg-surface/70 px-5 py-3 backdrop-blur-md">
        <motion.span
          variants={staggerItem}
          className="font-mono text-sm tracking-tight text-text"
        >
          obsidian<span className="text-accent">.</span>
        </motion.span>

        <nav className="hidden items-center gap-6 sm:flex">
          {links.map((link) => (
            <motion.a
              key={link}
              variants={staggerItem}
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text"
            >
              {link}
            </motion.a>
          ))}
        </nav>

        <motion.a
          variants={staggerItem}
          href="#"
          whileHover={{ y: -1 }}
          className="hidden rounded-full border border-border px-3.5 py-1.5 text-sm text-text transition-colors hover:border-border-hover sm:inline-block"
        >
          Sign in
        </motion.a>

        <motion.button
          variants={staggerItem}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border sm:hidden"
        >
          <motion.span
            className="absolute h-px w-3.5 bg-text"
            animate={{ rotate: open ? 45 : 0, y: open ? 0 : -3 }}
            transition={transitionOut}
          />
          <motion.span
            className="absolute h-px w-3.5 bg-text"
            animate={{ rotate: open ? -45 : 0, y: open ? 0 : 3 }}
            transition={transitionOut}
          />
        </motion.button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionInOut}
            className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface/90 backdrop-blur-md sm:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {links.map((link) => (
                <a
                  key={link}
                  href="#"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
                >
                  {link}
                </a>
              ))}
              <a
                href="#"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-surface-raised"
              >
                Sign in
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
