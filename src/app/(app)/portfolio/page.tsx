"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";
import {
  getPortfolio,
  postTrade,
  discardPosition,
  clearLedger,
  ApiError,
  type PortfolioResponse,
} from "@/lib/api";
import { LineSeries, Legend, type Series } from "@/components/series-chart";
import { TradeForm, type TradePrefill } from "@/components/trade-form";
import { PositionForm } from "@/components/position-form";
import { actionColor, actionLabel } from "@/lib/actions";

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
  const [prefill, setPrefill] = useState<TradePrefill | null>(null);
  // A counter rather than a timestamp: the ticket only needs to know that
  // this is a new instruction, and a clock read is not a pure one.
  const [tickets, setTickets] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

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

  const refresh = () => setRefreshKey((k) => k + 1);

  /**
   * Load the ticket from a row rather than trading straight off the table.
   *
   * A one-click sell of a whole position is the destructive action that is
   * easiest to trigger by accident, so the deliberate default is to fill the
   * ticket in and let it be read before it is sent. `Close` below is the
   * one-click path, and it asks first.
   */
  const sellFrom = (symbol: string, units: number, last: number | null) => {
    const nonce = tickets + 1;
    setTickets(nonce);
    setPrefill({
      symbol,
      quantity: String(units),
      price: last !== null ? String(last) : "",
      nonce,
    });
    document.getElementById("trade")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /**
   * Close a position: sell every unit at the last price we hold for it.
   *
   * Goes through the same `POST /api/portfolio/trade` as a hand-typed sell, so
   * it lands in the ledger as an ordinary trade with a realised figure. There
   * is no "delete this position" — a position that vanished without a trade
   * behind it would leave the book and the ledger disagreeing, and the ledger
   * is the half that is meant to be trustworthy.
   *
   * Priced from the cache, not from a fresh quote: the table already shows the
   * number, and filling at a price the person cannot see would be worse than
   * refusing. An unpriced row therefore cannot be closed from here.
   */
  const closePosition = async (symbol: string, units: number, last: number) => {
    if (!window.confirm(
      `Sell all ${units} units of ${symbol} at ${last.toFixed(2)}? ` +
      "This is recorded in the ledger as a trade.")) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const transaction = await postTrade({
        side: "sell", symbol, quantity: units, price: last,
      });
      setNotice({
        text: `Closed ${symbol} — realised ${transaction.realised >= 0 ? "+" : ""}${transaction.realised.toFixed(2)}`,
        ok: true,
      });
      refresh();
    } catch (err) {
      setNotice({
        text: err instanceof ApiError ? err.message : "The position could not be closed.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Drop a position from the book without selling it.
   *
   * Deliberately not the same as Close. Close sells every unit and books a
   * realised figure -- it claims the position was closed at a price, which is
   * a statement about what happened. This says the row should not be there:
   * entered by mistake, transferred out, never held. It realises nothing, so
   * it can neither flatter nor damage the realised total, and the units and
   * basis it dropped go into the ledger row so it can be put back by hand.
   */
  const discard = async (symbol: string, units: number) => {
    if (!window.confirm(
      `Drop ${symbol} (${units} units) from the book without selling it? ` +
      "Nothing is realised. Use Close instead if you actually sold it.")) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await discardPosition(symbol);
      setNotice({ text: `${symbol} dropped from the book — nothing realised.`, ok: true });
      refresh();
    } catch (err) {
      setNotice({
        text: err instanceof ApiError ? err.message : "The position could not be dropped.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Empty the transaction ledger.
   *
   * Deliberately the only destructive control that is nowhere near the table:
   * it does not touch a position, it discards the history of how the positions
   * got there — realised P&L and fees included — and nothing regenerates it.
   */
  const wipeLedger = async () => {
    if (!window.confirm(
      "Clear the whole transaction ledger? Realised P&L and every recorded " +
      "trade go with it, and the positions stay where they are.")) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await clearLedger();
      setNotice({ text: "The ledger is empty.", ok: true });
      refresh();
    } catch (err) {
      setNotice({
        text: err instanceof ApiError ? err.message : "The ledger could not be cleared.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

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

  const { summary, positions, signal, ledger, curve } = data;

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

      <div className="mb-6 space-y-4">
        <TradeForm onTraded={refresh} prefill={prefill} />
        <PositionForm onSaved={refresh} />
      </div>

      {notice && (
        <p
          className="mb-6 rounded-lg border border-border bg-surface p-3 text-sm"
          style={{ color: notice.ok ? "var(--up)" : "var(--down)" }}
          role="status"
        >
          {notice.text}
        </p>
      )}

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

      {curve && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionInOut}
          className="mt-4 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base text-text">
              Value over the window every holding shares
            </h2>
            <p className="font-mono text-sm text-text-faint">{curve.bars} bars</p>
          </div>
          <div className="mt-4">
            {(() => {
              const series: Series[] = [
                {
                  name: "Book value",
                  values: curve.value,
                  color: "var(--accent)",
                  width: 2,
                },
              ];
              return (
                <>
                  <LineSeries series={series} references={[curve.cost_basis]} />
                  <Legend series={series} />
                </>
              );
            })()}
          </div>
          {/* Both caveats stated, because neither is visible in the line and
              each one changes what it means. */}
          <p className="mt-3 text-sm text-text-faint">
            Guide line is the {fmtUsd(curve.cost_basis)} cost basis.
            {curve.limited_by && (
              <>
                {" "}Limited to {curve.bars} bars by{" "}
                <span className="font-mono">{curve.limited_by}</span>, the most
                recently listed holding — the book is only defined where every
                holding traded.
              </>
            )}{" "}
            The curve applies today&rsquo;s share counts throughout, so it is a
            what-if on the current book, not a record of what you actually held.
          </p>
        </motion.div>
      )}

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
              <th className="px-4 py-3 text-right font-normal">Edit</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => {
              const color = row.call ? actionColor(row.call.action) : "var(--text-faint)";
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
                    {row.call ? actionLabel(row.call.action) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => sellFrom(row.Symbol, row.Units, row.Last)}
                        disabled={busy}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-hover hover:text-text disabled:opacity-40"
                        title="Load this position into the ticket — edit the units before sending"
                      >
                        Sell
                      </button>
                      <button
                        onClick={() => row.Last !== null && closePosition(row.Symbol, row.Units, row.Last)}
                        disabled={busy || row.Last === null}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-down hover:text-down disabled:opacity-40"
                        title={
                          row.Last === null
                            ? "No cached price for this symbol, so there is nothing to fill at"
                            : "Sell every unit at the last price, recorded as a trade"
                        }
                      >
                        Close
                      </button>
                      <button
                        onClick={() => discard(row.Symbol, row.Units)}
                        disabled={busy}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-down hover:text-down disabled:opacity-40"
                        title="Drop this row from the book without selling it — realises nothing"
                      >
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ledger.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-sans text-lg font-semibold text-text">Closed trades</h2>
            <button
              onClick={wipeLedger}
              disabled={busy}
              className="text-xs text-text-faint transition-colors hover:text-down disabled:opacity-40"
            >
              Clear ledger
            </button>
          </div>
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
