"use client";

import { AnimatePresence, motion } from "motion/react";
import { transitionInOut, transitionOut } from "@/lib/motion";
import type { JobState } from "@/lib/use-job";

/**
 * What a background job is doing, in the terms the server reports it.
 *
 * `queued` is shown as itself rather than as "loading". The API runs one job
 * at a time on purpose -- the training code's `clear_session()` is
 * process-global, so two concurrent runs would clear each other's session
 * mid-training -- which means waiting behind another job is the normal case,
 * not a stall. A page that said "training…" while nothing was training would
 * make the queue look like a hang.
 *
 * The bar is deliberately absent while queued: there is no progress to show
 * yet, and a bar sitting at zero reads as a job that has started and stuck.
 */
export function JobProgress<T>({
  job,
  onRetry,
}: {
  job: JobState<T> & { busy: boolean };
  /** Offered only for a stale job, where retrying the id cannot work. */
  onRetry?: () => void;
}) {
  const { phase, fraction, message, error, stale, duplicate, jobId } = job;

  if (phase === "idle") return null;

  const percent = Math.round(fraction * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionOut}
      className="mt-6 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-text">
          {phase === "starting" && "Starting…"}
          {phase === "queued" && "Queued"}
          {phase === "running" && "Training"}
          {phase === "completed" && "Done"}
          {phase === "failed" && (stale ? "Job lost" : "Failed")}
        </p>
        {jobId && (
          <p className="font-mono text-xs text-text-faint">
            {jobId}
            {phase === "running" && ` · ${percent}%`}
          </p>
        )}
      </div>

      {phase === "queued" && (
        <p className="mt-2 text-sm text-text-muted">
          Waiting for the worker. The desk runs one training at a time, so a
          projection is not affected by whatever ran before it.
        </p>
      )}

      <AnimatePresence>
        {phase === "running" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionInOut}
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-raised"
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${Math.max(percent, 2)}%` }}
              transition={transitionOut}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {message && phase !== "failed" && (
        <p className="mt-3 font-mono text-xs text-text-muted">{message}</p>
      )}

      {duplicate && job.busy && (
        <p className="mt-3 text-sm text-text-muted">
          An identical run was already in flight, so this joined it rather than
          starting a second one.
        </p>
      )}

      {error && (
        <p className="mt-3 font-mono text-xs text-down">{error}</p>
      )}

      {stale && onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm text-text transition-colors hover:border-border-hover"
        >
          Start it again
        </button>
      )}
    </motion.div>
  );
}
