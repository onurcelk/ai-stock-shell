"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";
import { putPosition, ApiError } from "@/lib/api";

/**
 * Add a holding, or set an existing one to the numbers it should have had.
 *
 * The ticket beside this one is for things that happened: a buy at a price, a
 * sell at a price, cash moving. This one is for what the book *says*, and the
 * two are kept apart because merging them corrupts both. Entering a position
 * you already own as a "buy" invents a fill that never occurred; correcting a
 * mistyped quantity with a buy re-averages the basis and turns one error into
 * two.
 *
 * It is not an unrecorded edit either. Every submission leaves a ledger row of
 * side `adjust`, saying what the position was set to and, if you say so, why.
 * That is the whole reason this exists as an endpoint rather than as a text
 * field over holdings.json: the ledger stays a complete explanation of the
 * book, which is the property that made direct editing worth retiring in the
 * first place.
 */
export function PositionForm({ onSaved }: { onSaved: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const transaction = await putPosition({
        symbol,
        quantity: Number(quantity),
        unit_cost: Number(unitCost),
        note,
      });
      setMessage({
        text: `${transaction.symbol} set to ${transaction.quantity}g at ${transaction.price}`,
        ok: true,
      });
      setSymbol("");
      setQuantity("");
      setUnitCost("");
      setNote("");
      onSaved();
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "The position could not be saved.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const canSave =
    symbol.trim() !== "" && Number(quantity) > 0 && Number(unitCost) > 0 && !busy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionInOut}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-sm font-semibold text-text">Add or correct a position</p>
        <p className="text-xs text-text-faint">
          Recorded as an adjustment, not a trade — no cash moves
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
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder="Unit cost"
          inputMode="decimal"
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-hover"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why (optional)"
          maxLength={200}
          className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none focus:border-border-hover"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          disabled={!canSave}
          onClick={save}
          className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-40"
        >
          Save position
        </button>
        {/* Stated because the difference is invisible once it is done, and it
            is the difference between a correction and a fabricated trade. */}
        <p className="text-xs text-text-faint">
          Replaces the units and cost outright. To record an actual purchase,
          use Buy above instead.
        </p>
      </div>

      {message && (
        <p className="mt-3 text-sm" style={{ color: message.ok ? "var(--up)" : "var(--down)" }}>
          {message.text}
        </p>
      )}
    </motion.div>
  );
}
