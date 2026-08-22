"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import { getPortfolio, ApiError, type PortfolioResponse } from "@/lib/api";
import { TradeForm } from "@/components/trade-form";

const ACTION_COLOR: Record<string, string> = {
  STRONG_BUY: "var(--up)",
  BUY: "var(--up)",
  HOLD: "var(--text-muted)",
  SELL: "var(--down)",
  STRONG_SELL: "var(--down)",
};

function fmtUsd(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryTile({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <motion.div variants={staggerItem} className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg text-text">{value}</p>
      {delta && <p className="mt-1 font-mono text-sm text-text-faint">{delta}</p>}
    </motion.div>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    getPortfolio()
      .then((response) => {
        if (!ignore) setData(response);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err instanceof ApiError ? err.message : "Could not reach the portfolio API.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm text-text-muted">Pricing positions&hellip;</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-down">
          {error ?? "No data."}
        </p>
      </main>
    );
  }

  const { summary, positions, signal, ledger } = data;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionInOut}
        className="mb-6 font-sans text-2xl font-semibold text-text"
      >
        Portfolio
      </motion.h1>

      <div className="mb-6">
        <TradeForm onTraded={() => setRefreshKey((k) => k + 1)} />
      </div>

      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        <SummaryTile label="Market value" value={fmtUsd(summary.market_value)}
          delta={`${summary.pnl >= 0 ? "+" : ""}${summary.pnl.toFixed(2)}`} />
        <SummaryTile label="Cost basis" value={fmtUsd(summary.cost_basis)} />
        <SummaryTile label="Unrealised" value={`${summary.pnl_pct >= 0 ? "+" : ""}${summary.pnl_pct.toFixed(2)}%`} />
        <SummaryTile label="Realised" value={`${summary.realised >= 0 ? "+" : ""}${fmtUsd(summary.realised)}`} />
        <SummaryTile label="Positions" value={`${summary.positions}`} />
        <SummaryTile label="Largest position" value={`${summary.concentration_pct.toFixed(1)}%`} />
      </motion.div>

      {signal && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionInOut}
          className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-xl border border-border bg-surface p-4"
        >
          <div>
            <p className="text-sm text-text-muted">Book signal</p>
            <p className="mt-1 font-mono text-lg text-text">
              {signal.score >= 0 ? "+" : ""}
              {signal.score.toFixed(0)}
            </p>
            <p className="text-sm text-text-faint">{signal.confidence.toFixed(0)}% confidence</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Reading buy</p>
            <p className="mt-1 font-mono text-lg text-up">{signal.buying.length}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Reading sell</p>
            <p className="mt-1 font-mono text-lg text-down">{signal.selling.length}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Unreadable</p>
            <p className="mt-1 font-mono text-lg text-text">{signal.unreadable.length}</p>
          </div>
        </motion.div>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="px-4 py-3 font-normal">Symbol</th>
              <th className="px-4 py-3 font-normal">Units</th>
              <th className="px-4 py-3 font-normal">Unit cost</th>
              <th className="px-4 py-3 font-normal">Last</th>
              <th className="px-4 py-3 font-normal">Value</th>
              <th className="px-4 py-3 font-normal">P&amp;L</th>
              <th className="px-4 py-3 font-normal">Weight %</th>
              <th className="px-4 py-3 font-normal">Call</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => {
              const color = row.call ? (ACTION_COLOR[row.call.action] ?? "var(--text-muted)") : "var(--text-faint)";
              return (
                <tr key={row.Symbol} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-text">{row.Symbol}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{row.Units}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{row["Unit cost"].toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {row.Last !== null ? row.Last.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-text">
                    {row.Value !== null ? fmtUsd(row.Value) : "—"}
                  </td>
                  <td
                    className="px-4 py-3 font-mono"
                    style={{ color: row["P&L"] !== null ? (row["P&L"]! >= 0 ? "var(--up)" : "var(--down)") : undefined }}
                  >
                    {row["P&L"] !== null
                      ? `${row["P&L"]! >= 0 ? "+" : ""}${row["P&L"]!.toFixed(2)} (${row["P&L %"]!.toFixed(1)}%)`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {row["Weight %"] !== null ? `${row["Weight %"]!.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium" style={{ color }}>
                    {row.call ? row.call.action.replace("_", " ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ledger.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-sans text-lg font-semibold text-text">Closed trades</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Side</th>
                  <th className="px-4 py-3 font-normal">Symbol</th>
                  <th className="px-4 py-3 font-normal">Units</th>
                  <th className="px-4 py-3 font-normal">Price</th>
                  <th className="px-4 py-3 font-normal">Realised</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-text-muted">{row.When}</td>
                    <td className="px-4 py-3 font-mono text-text">{row.Side}</td>
                    <td className="px-4 py-3 font-mono text-text">{row.Symbol}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{row.Units}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{row.Price}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">
                      {row.Realised !== null ? row.Realised : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
