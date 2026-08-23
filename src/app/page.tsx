import Link from "next/link";
import { AmbientBeams } from "@/components/ambient-beams";
import { FeatureGrid } from "@/components/feature-grid";
import { GradientButton } from "@/components/gradient-button";
import { LedgerStats } from "@/components/ledger-stats";
import { Nav } from "@/components/nav";
import { ShimmerHeading } from "@/components/shimmer-heading";
import { DESK_HOME } from "@/lib/routes";

/**
 * The three headline figures live in `LedgerStats` and are read from
 * `GET /api/research`, not typed in here.
 *
 * Two corrections got them there. They began as invented numbers — a 0.67 hit
 * rate at n=6 and a 0.21 Brier — printed directly under a hero that promises
 * no hit rate without its confidence interval; at n=6 that interval is roughly
 * [0.30, 0.90], which is a coin, and ~0.25 is what saying "50%" to everything
 * scores. They were then replaced with the real counts, hardcoded, "until
 * Phase 5 exposes `core.research_view` over the API". Phase 5 did, and by the
 * cutover the hardcoded pair had drifted two forecasts behind the ledger.
 *
 * A page arguing for measurement discipline cannot open by breaking it, and a
 * number a person has to remember to update is a number that will be wrong.
 */

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <AmbientBeams />

      <div className="relative px-6 pt-6">
        <Nav />
      </div>

      <main className="relative mx-auto max-w-4xl px-6 pb-32">
        <section className="pt-28 text-center sm:pt-40">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
            AI Stock
          </p>
          <ShimmerHeading className="mx-auto mt-5 max-w-3xl text-4xl font-medium tracking-tight sm:text-6xl">
            A research desk that grades its own calls.
          </ShimmerHeading>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-muted">
            Paper predictions, stamped and resolved against real prices.
            No hit rate without its confidence interval. No consensus
            mistaken for a signal.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <GradientButton href={DESK_HOME}>Open the desk</GradientButton>
            <Link
              href="/portfolio"
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-text transition-colors hover:border-border-hover"
            >
              See the book
            </Link>
          </div>
        </section>

        <section className="mt-28">
          <LedgerStats />
        </section>

        <section className="mt-20">
          <h2 className="text-lg font-medium text-text">What it does</h2>
          <div className="mt-6">
            <FeatureGrid />
          </div>
        </section>
      </main>

      <footer className="relative border-t border-border py-8 text-center">
        <p className="font-mono text-xs text-text-faint">
          Obsidian design system — dark only, fully animated, minimal.
        </p>
      </footer>
    </div>
  );
}
