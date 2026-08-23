"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { getResearch, type ResearchResponse } from "@/lib/api";

/**
 * The three headline figures, read from the ledger rather than typed in.
 *
 * These were hardcoded at the landing page's own admission — "hardcoded until
 * Phase 5 exposes `core.research_view` over the API" — and by the cutover they
 * had drifted: the page said 227 forecasts while the ledger held 229. A stale
 * number is a small error anywhere else on this site and a disqualifying one
 * here, because the page's argument is that a figure without its resolution is
 * not a result. `GET /api/research` is the same single `research_view.load()`
 * the Research page reads, so the front page and that page cannot disagree.
 *
 * Reading this page must not create a record: the endpoint checks for the
 * ledger file before constructing anything, and never constructs a
 * `ForecastLedger` at all. That property has a test of its own
 * (`test_reading_the_page_does_not_create_a_record`); nothing here can
 * weaken it, because nothing here does anything but read the response.
 *
 * A dash means "not read yet" or "the API is not up", never "zero" — the same
 * convention the watchlist uses for an uncached symbol. Inventing a plausible
 * number while the API is down is exactly the failure this component exists to
 * end.
 */
export function LedgerStats() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    getResearch()
      .then((body) => {
        if (!ignore) setData(body);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const counts = data?.counts;
  const pending = failed
    ? "The API is not answering, so this is unread rather than zero."
    : "Reading the ledger…";
  const figure = (value: number | undefined) =>
    value === undefined ? "—" : String(value);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Forecasts frozen"
        value={figure(counts?.forecasts)}
        note={
          counts
            ? "Stamped and sealed. Only a matured one can ever be scored."
            : pending
        }
      />
      <StatCard
        label="Outcomes scored"
        value={figure(counts?.outcomes)}
        note={
          counts
            ? "Resolved against the price that actually arrived."
            : pending
        }
      />
      <StatCard
        label="Independent cutoffs"
        value={
          counts
            ? `${counts.independent_cutoffs} / ${counts.min_cutoffs}`
            : "—"
        }
        note={
          !counts
            ? pending
            : counts.independent_cutoffs < counts.min_cutoffs
              ? "Below the promotion floor. Nothing here can support a decision yet — and it says so."
              : "At or past the promotion floor. Resolution, not a verdict: read the Research page."
        }
      />
    </div>
  );
}
