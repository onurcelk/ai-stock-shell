"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { staggerContainer, staggerItem, transitionOut } from "@/lib/motion";
import {
  addToWatchlist,
  clearWatchlist,
  getWatchlist,
  removeFromWatchlist,
  resetWatchlist,
  ApiError,
  type WatchlistResponse,
} from "@/lib/api";

/**
 * The quote board: this symbol, then the list you keep.
 *
 * Read from the cache and never downloaded — `core.quotes` exists precisely so
 * a dozen rows do not become a dozen fetches, which is how an app gets
 * rate-limited. The consequence is visible here and is deliberately not hidden:
 * a symbol with no cached bars shows a dash rather than a price. That means
 * "not downloaded yet", not "no such symbol", and selecting it is how it gets
 * downloaded — through the page that can report a failure.
 *
 * The board has two modes and the caption says which is in force, because the
 * difference is the difference between "we guessed" and "you said":
 *
 *   * **default** — nobody has edited it, so it is the derived board (this
 *     symbol, the cache, the quick picks) and a fresh clone still shows
 *     something.
 *   * **saved** — somebody has. It is then exactly the list, *including when
 *     the list is empty*. Clearing has to survive the next read or the button
 *     reads as broken, which is why "Clear" and "Reset to default" are two
 *     controls rather than one.
 *
 * Every mutation returns the whole re-priced board, so this component replaces
 * its state instead of reconciling — there is one source of truth for what is
 * on the board, and it is the server's.
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
  const [board, setBoard] = useState<WatchlistResponse | null>(null);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getWatchlist(symbol, { interval })
      .then((body) => {
        if (!ignore) setBoard(body);
      })
      .catch(() => {
        // A board that cannot load is not worth an error: the page's own
        // reading is unaffected, and this is a navigation aid.
      });
    return () => {
      ignore = true;
    };
  }, [symbol, interval]);

  /** One path for all four writes, so none of them can forget the busy flag. */
  const mutate = async (run: () => Promise<WatchlistResponse>) => {
    setBusy(true);
    setError(null);
    try {
      setBoard(await run());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The board could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const add = (name: string) => {
    if (!name.trim() || busy) return;
    void mutate(() => addToWatchlist(name, symbol, { interval }));
    setEntry("");
  };

  const rows = board?.quotes ?? [];
  const active = symbol.trim().toUpperCase();
  const activeSaved = rows.some((row) => row.symbol === active && row.saved);
  const custom = board?.mode === "custom";

  // Rendered even with no rows: an emptied board still needs the box the add
  // field lives in, or clearing it would take away the only way to refill it.
  if (!board) return null;

  return (
    <motion.div
      variants={staggerContainer(0.03)}
      initial="hidden"
      animate="show"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-text">Watchlist</h2>
        <p className="text-xs text-text-faint">
          {custom ? "saved" : "default"} · from cache
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={entry}
          onChange={(event) => setEntry(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") add(entry);
          }}
          placeholder="Add symbol"
          aria-label="Add a symbol to the watchlist"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 font-mono text-sm text-text outline-none transition-colors focus:border-border-hover"
        />
        <button
          onClick={() => add(entry)}
          disabled={!entry.trim() || busy}
          aria-label="Add to watchlist"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition-colors hover:border-border-hover disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* The row already on screen is the one most likely to be wanted, and
          typing its name again to keep it would be silly. */}
      {active && !activeSaved && (
        <button
          onClick={() => add(active)}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-text-muted transition-colors hover:border-border-hover hover:text-text disabled:opacity-40"
        >
          Keep <span className="font-mono text-text">{active}</span> on the board
        </button>
      )}

      <div className="mt-3 space-y-0.5">
        <AnimatePresence initial={false}>
          {rows.map((row) => {
            const isActive = row.symbol === active;
            const up = (row.change_pct ?? 0) >= 0;
            return (
              <motion.div
                key={row.symbol}
                variants={staggerItem}
                exit={{ opacity: 0, height: 0 }}
                transition={transitionOut}
                className={`group flex items-center rounded-lg transition-colors ${
                  isActive ? "bg-accent-dim" : "hover:bg-surface-raised"
                }`}
              >
                <button
                  onClick={() => onSelect(row.symbol)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-baseline justify-between px-2.5 py-1.5 text-left"
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
                </button>

                {/* Removing a derived row is allowed, and is what turns the
                    board custom — otherwise the only way to drop a quick pick
                    would be to delete a cache file. */}
                <button
                  onClick={() =>
                    void mutate(() => removeFromWatchlist(row.symbol, symbol, { interval }))
                  }
                  disabled={busy}
                  aria-label={`Remove ${row.symbol} from the watchlist`}
                  title={`Remove ${row.symbol}`}
                  className="mr-1.5 shrink-0 rounded px-1.5 py-1 text-sm text-text-faint opacity-0 transition-opacity hover:text-down focus:opacity-100 group-hover:opacity-100 disabled:opacity-20"
                >
                  ×
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {rows.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-text-faint">
            The board is empty. Add a symbol, or put the default back.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs">
        <button
          onClick={() => void mutate(() => clearWatchlist(symbol, { interval }))}
          disabled={busy || rows.length === 0}
          className="text-text-faint transition-colors hover:text-down disabled:opacity-40"
        >
          Clear
        </button>
        {custom && (
          <button
            onClick={() => void mutate(() => resetWatchlist(symbol, { interval }))}
            disabled={busy}
            className="text-text-faint transition-colors hover:text-text disabled:opacity-40"
          >
            Reset to default
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-down">{error}</p>}
    </motion.div>
  );
}
