"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";
import { freezeSignal, ApiError, type SignalResponse } from "@/lib/api";

/**
 * The one control on this page that writes.
 *
 * Reading a signal and recording one are deliberately separate acts: the
 * forecast ledger is append-only and never regenerable, and its value rests on
 * a person having chosen every cutoff in it. Opening this page does not record
 * anything. Pressing this does.
 *
 * A refused write comes back on a successful response rather than as an error,
 * because the reading is valid either way -- so `excluded` (declined on
 * purpose, e.g. writes switched off for this server) and `error` (the ledger
 * rejected it) are shown as themselves, not collapsed into "something failed".
 */
export function FreezeControl({
  symbol,
  onFrozen,
}: {
  symbol: string;
  onFrozen: (response: SignalResponse) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SignalResponse["freeze"]>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function freeze() {
    setBusy(true);
    setFailure(null);
    setReport(null);
    try {
      const response = await freezeSignal(symbol);
      setReport(response.freeze);
      onFrozen(response);
    } catch (error) {
      setFailure(
        error instanceof ApiError ? error.message : "Could not reach the signal API.",
      );
    } finally {
      setBusy(false);
    }
  }

  const wrote = Boolean(report?.frozen_ids.length);
  const tone = report?.error ? "text-down" : wrote ? "text-up" : "text-text-muted";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">Record this forecast</p>
          <p className="mt-1 text-xs text-text-muted">
            Writes {symbol} to the prospective ledger. Reading this page does not.
          </p>
        </div>
        <button
          onClick={freeze}
          disabled={busy}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-border-hover disabled:opacity-50"
        >
          {busy ? "Freezing…" : "Freeze forecast"}
        </button>
      </div>

      <AnimatePresence>
        {(report || failure) && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionInOut}
            className={`mt-3 font-mono text-xs ${failure ? "text-down" : tone}`}
          >
            {failure ?? report?.summary}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
