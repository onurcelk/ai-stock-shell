import { AmbientBeams } from "@/components/ambient-beams";
import { FeatureGrid } from "@/components/feature-grid";
import { GradientButton } from "@/components/gradient-button";
import { Nav } from "@/components/nav";
import { ShimmerHeading } from "@/components/shimmer-heading";
import { StatCard } from "@/components/stat-card";

const stats = [
  {
    label: "Hit rate (n=6)",
    value: "0.67",
    delta: 0,
    points: [50, 52, 48, 55, 58, 60, 67],
  },
  {
    label: "Brier score",
    value: "0.21",
    delta: -4.2,
    points: [30, 28, 27, 25, 24, 22, 21],
  },
  {
    label: "SPY vs. book",
    value: "+2.3%",
    delta: 2.3,
    points: [10, 12, 11, 14, 15, 17, 18],
  },
];

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
            AI Stock — Obsidian
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
            <GradientButton>Open the desk</GradientButton>
            <a
              href="#"
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-text transition-colors hover:border-border-hover"
            >
              Read the manifesto
            </a>
          </div>
        </section>

        <section className="mt-28">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
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
