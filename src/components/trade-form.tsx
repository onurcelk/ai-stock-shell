"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";
import { postTrade, getWatchlist, ApiError } from "@/lib/api";

/**
 * A ticket filled in from somewhere else — the positions table's Sell button.
 *
 * `nonce` is what makes it fire: the same position clicked twice is the same
 * three values, and a ticket keyed on the values alone would ignore the second
 * click. Bumping a counter says "again", which is what was meant.
 */
export interface TradePrefill {
  symbol: string;
  quantity: string;
  price: string;
  nonce: number;
}

export function TradeForm({
  onTraded,
  prefill,
}: {
  onTraded: () => void;
  prefill?: TradePrefill | null;
}) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  // Whether the price field still holds a prefill rather than something typed.
  // Once it has been edited it is never overwritten: re-prefilling under
  // someone mid-entry is worse than not prefilling at all.
  const [prefilled, setPrefilled] = useState(true);

  /**
   * Prefill the price from the last close already in the cache.
   *
   * Read through the watchlist endpoint, which never downloads — a ticket that
   * fired a fetch on every keystroke would be exactly the mistake
   * `core.quotes` exists to avoid. A symbol with nothing cached simply leaves
   * the field empty rather than guessing.
   */
  useEffect(() => {
    const wanted = symbol.trim().toUpperCase();
    if (!wanted || !prefilled) return;
    let ignore = false;
    const timer = setTimeout(() => {
      getWatchlist(wanted, { limit: 1 })
        .then((body) => {
          const quote = body.quotes.find((row) => row.symbol === wanted);
          if (!ignore && quote?.last != null) setPrice(String(quote.last));
        })
        .catch(() => {
          // No cached quote is a normal state, not an error.
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [symbol, prefilled]);

  // The last ticket accepted from outside. Adjusting state during render is
  // React's own answer to "a prop changed and some state derived from it must
  // move" -- an effect for this would render once with the old values and
  // again with the new ones, and would fight the auto-prefill below.
  const [applied, setApplied] = useState(0);
  if (prefill && prefill.nonce !== applied) {
    setApplied(prefill.nonce);
    setSymbol(prefill.symbol);
    setQuantity(prefill.quantity);
    setPrice(prefill.price);
    // Filling from a row counts as having typed it: the auto-prefill below
    // must not overwrite the price the row was actually priced at.
    setPrefilled(false);
    setMessage(null);
  }

  const submit = async (side: "buy" | "sell") => {
    setBusy(true);
    setMessage(null);
    try {
      const transaction = await postTrade({
        side,
        symbol,
        quantity: Number(quantity),
        price: Number(price),
        fee: Number(fee) || 0,
      });
      setMessage({
        text: `${transaction.side.toUpperCase()} ${transaction.quantity}g ${transaction.symbol} @ ${transaction.price}`,
        ok: true,
      });
      onTraded();
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "The trade could not be placed.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = symbol.trim() !== "" && Number(quantity) > 0 && Number(price) > 0 && !busy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionInOut}
      id="trade"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-sm font-semibold text-text">Trade</p>
        {/* Said once, here, rather than beside each button: every change to
            the book goes through this ticket, because the ledger is what makes
            the book auditable and a directly edited position has no trade
            behind it. */}
        <p className="text-xs text-text-faint">
          Every position change is a trade — the ledger is the record
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-hover"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Units"
          inputMode="decimal"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-hover"
        />
        <input
          value={price}
          onFocus={() => setPrefilled(false)}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price"
          inputMode="decimal"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-hover"
        />
        <input
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="Commission"
          inputMode="decimal"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-hover"
        />
      </div>
      <div className="mt-3 flex gap-3">
        <button
          disabled={!canSubmit}
          onClick={() => submit("buy")}
          className="rounded-lg bg-up px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Buy
        </button>
        <button
          disabled={!canSubmit}
          onClick={() => submit("sell")}
          className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-40"
        >
          Sell
        </button>
      </div>
      {message && (
        <p className="mt-3 text-sm" style={{ color: message.ok ? "var(--up)" : "var(--down)" }}>
          {message.text}
        </p>
      )}
    </motion.div>
  );
}
