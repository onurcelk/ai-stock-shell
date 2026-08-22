"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import { getResearch, ApiError, type ResearchResponse } from "@/lib/api";
import { DataTable, type Table } from "@/components/data-table";

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <motion.section variants={staggerItem} transition={transitionInOut}>
      <h2 className="text-base font-medium text-text">{title}</h2>
      {caption && (
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">
          {caption}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

/**
 * The warnings come from `core.research_view` with their emphasis already in
 * them (`**reconstructions**`), because Streamlit rendered them as markdown.
 * The emphasis is on the load-bearing word, so it is rendered rather than
 * stripped — and rather than shown as literal asterisks.
 */
function emphasise(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-text">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** A caveat that has to be read before the numbers under it, not after. */
function Notice({ children, tone = "warn" }: { children: string; tone?: "warn" | "info" }) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm leading-relaxed ${
        tone === "warn"
          ? "border-accent bg-accent-dim text-text"
          : "border-border bg-surface text-text-muted"
      }`}
    >
      {emphasise(children)}
    </div>
  );
}

function Count({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl text-text">{value}</p>
      {note && <p className="mt-1 text-sm text-text-faint">{note}</p>}
    </div>
  );
}

export default function ResearchPage() {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getResearch()
      .then((response) => {
        if (!ignore) setData(response);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err instanceof ApiError ? err.message : "Could not reach the API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-base text-text-muted">Reading the record…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-base text-down">{error}</p>
      </main>
    );
  }

  const { counts, study } = data;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Research &amp; learning</h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-text-muted">
        What the system has actually shown, read back from frozen records. Nothing on
        this page is recomputed from today&apos;s data — if a number is not here, it is
        because it was never measured.
      </p>

      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="show"
        className="mt-8 space-y-10"
      >
        {data.warning && (
          <motion.div variants={staggerItem}>
            <Notice>{data.warning}</Notice>
          </motion.div>
        )}

        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Count label="Forecasts frozen" value={counts.forecasts.toLocaleString()} />
          <Count label="Outcomes scored" value={counts.outcomes.toLocaleString()} />
          <Count
            label="Independent cutoffs"
            value={counts.independent_cutoffs.toLocaleString()}
            note="Draws, not rows."
          />
          <Count
            label="Promotion floor"
            value={counts.min_cutoffs.toLocaleString()}
            note="Needed before the gate looks at skill at all."
          />
        </motion.div>

        <Section
          title="Production — what is live right now"
          caption="Declared identity and source version for every component with production status. Frozen forecasts counts what each has actually put on the record, which is the only thing that can ever be scored."
        >
          <DataTable table={data.production as Table} />
        </Section>

        <Section
          title="Weights, as frozen on the most recent record"
          caption="The live engine re-derives its weights at every evaluation and remembers none of them, so the only weights that can honestly be displayed are the ones a frozen forecast carries."
        >
          <DataTable
            table={data.weights as Table}
            empty="No constituent weights to show — nothing is frozen yet."
          />
        </Section>

        <Section
          title="Forecast quality"
          caption="Directional accuracy, error against the baseline each forecast declared, and the sample behind both. Every row carries n; a row whose sufficient flag is false is shown rather than hidden, because a thin cell is evidence about coverage."
        >
          <DataTable
            table={data.quality as Table}
            empty="Nothing has matured and been scored, so there is no accuracy to report. This is an empty record, not a poor one."
          />
        </Section>

        <Section title="Probability calibration">
          <DataTable
            table={data.calibration as Table}
            empty="No calibration to report yet."
          />
        </Section>

        <Section title="Rolling performance">
          <DataTable table={data.rolling as Table} empty="No rolling window yet." />
        </Section>

        <Section
          title="Model leaderboard"
          caption="Every component that can reach a frozen forecast, whether or not it has one. Models with no scored forecast stay on the board with n = 0: hiding them would answer who is winning, when the true answer is that nothing has run."
        >
          <DataTable table={data.leaderboard as Table} />
        </Section>

        <Section
          title="Promotion requirements"
          caption="What a challenger still owes before the gate will consider it."
        >
          <DataTable table={data.promotion_requirements as Table} />
        </Section>

        <Section
          title="Forecast history"
          caption={`${data.history.rows.length.toLocaleString()} matured prediction(s), newest first.`}
        >
          <DataTable
            table={data.history as Table}
            empty="No matured prediction to list yet."
          />
        </Section>

        <Section title="Pipeline">
          <DataTable table={data.pipeline as Table} />
        </Section>

        {/* The one surface allowed to be large while the prospective record is
            small. The warning has to carry that, because a reader who sees
            thousands of scored calls here and two frozen ones above will
            otherwise draw exactly the wrong conclusion about which record the
            programme runs on. */}
        <motion.div variants={staggerItem} className="border-t border-border pt-10">
          <h2 className="text-base font-medium text-text">
            Historical PIT replay — diagnostic, not evidence
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">
            The incumbent, re-run at historical cutoffs on price history truncated to
            each cutoff, then scored against what actually happened. This is how a model
            change gets evidence in an afternoon instead of a year — and it is{" "}
            <strong className="text-text">not</strong> production evidence.
          </p>

          {study.warning && (
            <div className="mt-4">
              <Notice>{study.warning}</Notice>
            </div>
          )}

          {study.has_outcomes && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Count label="Replayed &amp; scored" value={study.n_scored.toLocaleString()} />
                <Count
                  label="Independent cutoffs"
                  value={study.n_independent_cutoffs.toLocaleString()}
                  note="Non-overlapping by construction."
                />
                <Count label="Symbols" value={study.n_symbols.toLocaleString()} />
                <Count
                  label="Engine versions"
                  value={study.versions.length.toLocaleString()}
                  note={
                    study.versions.length > 1
                      ? "More than one — these rows span an engine change and must never be read as a single number."
                      : undefined
                  }
                />
              </div>

              <div className="mt-8 space-y-8">
                <Section
                  title="The two records side by side"
                  caption="A comparison of coverage and accuracy, never a pooled number. They answer different questions about the same engine, and the row labels say which is which."
                >
                  <DataTable table={study.vs_live as Table} />
                </Section>

                <Section title="Accuracy by engine version and horizon">
                  <DataTable table={study.summary as Table} />
                </Section>

                <Section
                  title="What it actually called"
                  caption="HOLD carries no accuracy on purpose: it is either a neutral score or a direction vetoed below the confidence floor."
                >
                  <DataTable table={study.actions as Table} />
                </Section>

                <Section title="Engine versions">
                  <DataTable table={study.versions_table as Table} />
                </Section>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </main>
  );
}
