"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ROUTES } from "@/lib/routes";
import {
  springSnappy,
  staggerContainer,
  staggerItem,
  transitionInOut,
  transitionOut,
} from "@/lib/motion";

const MotionLink = motion.create(Link);

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A page owns its own entry and anything nested under it, so /chart stays lit
  // if a detail route is ever added beneath it.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="show"
      className="sticky top-4 z-20 mx-auto w-[min(920px,calc(100%-2rem))]"
    >
      <header className="flex items-center justify-between rounded-full border border-border bg-surface/70 px-5 py-3 backdrop-blur-md">
        <motion.div variants={staggerItem}>
          <Link
            href="/"
            className="font-mono text-sm tracking-tight text-text transition-colors hover:text-accent"
          >
            obsidian<span className="text-accent">.</span>
          </Link>
        </motion.div>

        <nav className="hidden items-center gap-1 sm:flex">
          {ROUTES.map((route) => {
            const active = isActive(route.href);
            return (
              <MotionLink
                key={route.href}
                href={route.href}
                variants={staggerItem}
                whileHover={{ y: -1 }}
                transition={transitionOut}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "text-text" : "text-text-muted hover:text-text"
                }`}
              >
                {/* One shared pill that travels between entries, rather than one
                    fading in and another out — the movement is what tells you
                    where you went. */}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-full bg-accent-dim"
                  />
                )}
                <span className="relative">{route.label}</span>
              </MotionLink>
            );
          })}
        </nav>

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
              {ROUTES.map((route) => {
                const active = isActive(route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent-dim text-text"
                        : "text-text-muted hover:bg-surface-raised hover:text-text"
                    }`}
                  >
                    {route.label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
