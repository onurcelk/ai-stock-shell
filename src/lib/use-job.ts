"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, followJob, type Job, type StartedJob } from "./api";

/**
 * Running one background job from a page.
 *
 * Training an LSTM or a reinforcement-learning policy takes minutes, so the
 * API starts the work and hands back an id. This hook is the other half: it
 * starts a job, follows it to a terminal state, and exposes the four states
 * the server actually reports rather than collapsing them into a boolean.
 * `queued` is a real state here -- the server runs one job at a time, because
 * the training code's `clear_session()` is process-global -- and a page that
 * showed "loading" for it would be lying about why nothing is happening.
 *
 * Two failures get their own handling because they are not retryable the way
 * an ordinary error is:
 *
 * **Stale (410).** The registry is in memory, so a server restart takes every
 * job with it. Polling the same id again will never succeed; the page offers
 * to start over instead of showing a spinner or a misleading 404.
 *
 * **Duplicate.** An identical request already in flight comes back as the
 * *same* job, flagged. Nothing went wrong -- a double-clicked button did not
 * start a second five-minute training -- so it is surfaced as a note, not an
 * error.
 *
 * Every state write is guarded by a generation counter: starting a new job or
 * unmounting abandons the previous poll, so a training that finishes after the
 * symbol changed cannot overwrite the newer run's result.
 */

export type JobPhase =
  | "idle"
  | "starting"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface JobState<T> {
  phase: JobPhase;
  /** 0 to 1, straight from the callbacks the training code already emitted. */
  fraction: number;
  message: string;
  result: T | null;
  error: string | null;
  /** True when the server restarted under a job this page was following. */
  stale: boolean;
  /** True when this request joined a job already in flight. */
  duplicate: boolean;
  jobId: string | null;
}

const IDLE: JobState<never> = {
  phase: "idle",
  fraction: 0,
  message: "",
  result: null,
  error: null,
  stale: false,
  duplicate: false,
  jobId: null,
};

export function useJob<T>() {
  const [state, setState] = useState<JobState<T>>(IDLE as JobState<T>);

  // Incremented on every start and on unmount. A poll whose generation is no
  // longer current writes nothing.
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    abort.current?.abort();
    setState(IDLE as JobState<T>);
  }, []);

  /**
   * `start` takes the POST rather than a request body, so this hook stays
   * ignorant of which endpoint it is driving -- the Forecast page hands it
   * `startWalkForward`, the Agents page `startAgent`.
   */
  const start = useCallback(async (begin: () => Promise<StartedJob>) => {
    generation.current += 1;
    const mine = generation.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    const current = () => generation.current === mine;

    setState({ ...(IDLE as JobState<T>), phase: "starting" });

    let started: StartedJob;
    try {
      started = await begin();
    } catch (error) {
      if (current()) {
        setState({
          ...(IDLE as JobState<T>),
          phase: "failed",
          error:
            error instanceof ApiError
              ? error.message
              : "Could not reach the API to start the job.",
        });
      }
      return;
    }
    if (!current()) return;

    setState({
      ...(IDLE as JobState<T>),
      phase: started.state === "running" ? "running" : "queued",
      duplicate: started.duplicate,
      jobId: started.id,
      message: started.progress.message,
      fraction: started.progress.fraction,
    });

    try {
      const result = await followJob<T>(
        started.id,
        (job: Job<T>) => {
          if (!current()) return;
          setState((previous) => ({
            ...previous,
            phase: job.state === "queued" ? "queued" : "running",
            fraction: job.progress.fraction,
            message: job.progress.message,
          }));
        },
        { signal: controller.signal },
      );
      if (!current()) return;
      setState((previous) => ({
        ...previous,
        phase: "completed",
        fraction: 1,
        result,
        error: null,
      }));
    } catch (error) {
      if (!current()) return;
      const stale = error instanceof ApiError && error.status === 410;
      setState((previous) => ({
        ...previous,
        phase: "failed",
        stale,
        error:
          error instanceof ApiError
            ? error.message
            : "Lost contact with the job while it was running.",
      }));
    }
  }, []);

  const busy =
    state.phase === "starting" ||
    state.phase === "queued" ||
    state.phase === "running";

  return { ...state, busy, start, reset };
}
