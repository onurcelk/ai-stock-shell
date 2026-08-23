"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";
import { postTrade, getWatchlist, ApiError } from "@/lib/api";

export function TradeForm({ onTraded }: { onTraded: () => void }) {
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
      className="rounded-xl border border-border bg-surface p-5"
    >
      <p className="mb-3 font-sans text-sm font-semibold text-text">Trade</p>
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
