"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionOut } from "@/lib/motion";
import { getWatchlist, type QuoteRow } from "@/lib/api";

/**
 * The quote board: this symbol, then what has been looked at, then the picks.
 *
 * Read from the cache and never downloaded — `core.quotes` exists precisely so
 * a dozen rows do not become a dozen fetches, which is how an app gets
 * rate-limited. The consequence is visible here and is deliberately not hidden:
 * a symbol with no cached bars shows a dash rather than a price. That means
 * "not downloaded yet", not "no such symbol", and selecting it is how it gets
 * downloaded — through the page that can report a failure.
 *
 * So a fresh clone shows a board of dashes, and it fills in as you use the app.
 * A component that hid those rows would make the board look broken instead of
 * empty, and would remove the only way to populate it.
 */
export function Watchlist({
  symbol,
  interval,
  onSelect,
}: {
  symbol: string;
  interval?: string;
  onSelect: (symbol: string) => void;
}) {
  const [rows, setRows] = useState<QuoteRow[]>([]);

  useEffect(() => {
    let ignore = false;
    getWatchlist(symbol, { interval })
      .then((body) => {
        if (!ignore) setRows(body.quotes);
      })
      .catch(() => {
        // A board that cannot load is not worth an error: the page's own
        // reading is unaffected, and this is a navigation aid.
      });
    return () => {
      ignore = true;
    };
  }, [symbol, interval]);

  if (rows.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer(0.03)}
      initial="hidden"
      animate="show"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-text">Watchlist</h2>
        <p className="text-xs text-text-faint">from cache</p>
      </div>

      <div className="mt-3 space-y-0.5">
        {rows.map((row) => {
          const active = row.symbol === symbol.trim().toUpperCase();
          const up = (row.change_pct ?? 0) >= 0;
          return (
            <motion.button
              key={row.symbol}
              variants={staggerItem}
              transition={transitionOut}
              onClick={() => onSelect(row.symbol)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-baseline justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                active ? "bg-accent-dim" : "hover:bg-surface-raised"
              }`}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-mono text-sm text-text">
                  {row.symbol}
                </span>
                {row.currency && (
                  <span className="shrink-0 text-xs text-text-faint">
                    {row.currency}
                  </span>
                )}
              </span>

              {row.cached ? (
                <span className="shrink-0 text-right">
                  <span className="font-mono text-sm text-text">
                    {row.last?.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={`ml-2 font-mono text-xs ${up ? "text-up" : "text-down"}`}
                  >
                    {up ? "+" : ""}
                    {row.change_pct?.toFixed(2)}%
                  </span>
                </span>
              ) : (
                <span
                  className="shrink-0 font-mono text-xs text-text-faint"
                  title="Not downloaded yet — select it to fetch"
                >
                  —
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
