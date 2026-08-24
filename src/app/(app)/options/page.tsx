"use client";

/**
 * The options premium screen.
 *
 * Every other page on this desk shows something that has been *measured* —
 * a verdict with a hit rate behind it, a backtest with a benchmark, a ledger
 * row that will be scored against a real subsequent price. This page shows
 * none of that, and the design has to say so before it says anything else.
 *
 * `reports/OPTIONS1_ADMISSIBILITY.md` §3: no free source serves options data
 * point-in-time. Expired contracts are retrievable from nowhere, so no premium
 * strategy here can ever be backtested — not with more work, not with a better
 * model. What can honestly be shown is what is quoted right now.
 *
 * So the caveat is rendered *above* the numbers rather than under them, it is
 * not collapsible, and the yield columns carry "static" in their own headers.
 * A reader who scrolls straight to the biggest number should still have passed
 * the sentence that says it is not a return.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ApiError,
  getOptionExpiries,
  getOptionKinds,
  getOptionScreen,
  type OptionKind,
  type OptionRow,
  type OptionScreen,
} from "@/lib/api";
import { staggerContainer, staggerItem, transitionInOut } from "@/lib/motion";

const percent = (value: number | null, digits = 1) =>
  value === null || Number.isNaN(value)
    ? "—"
    : `${(value * 100).toFixed(digits)}%`;

const money = (value: number | null, digits = 2) =>
  value === null || Number.isNaN(value) ? "—" : value.toFixed(digits);

const count = (value: number | null) =>
  value === null || Number.isNaN(value)
    ? "—"
    : Math.round(value).toLocaleString();

const stamp = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * The one piece of chrome on this page that is not optional.
 *
 * Deliberately not a dismissible banner and not a tooltip. The string comes
 * from the API rather than being written here, so there is exactly one copy of
 * it and a backend that tightens the wording tightens it everywhere.
 */
function Caveat({ text }: { text: string }) {
  return (
    <div
      className="mt-8 rounded-xl border bg-surface p-5"
      style={{ borderColor: "var(--down)" }}
    >
      <p className="text-sm font-medium text-text">Not a backtest</p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{text}</p>
    </div>
  );
}

/** Where the strike sits against spot, drawn rather than described. */
function Cushion({ value }: { value: number }) {
  const width = Math.min(Math.abs(value) * 100 * 4, 100);
  return (
    <span className="flex items-center gap-2">
      <span className="relative hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-raised sm:block">
        <span
          className="absolute top-0 h-full rounded-full"
          style={{
            width: `${width}%`,
            background: value >= 0 ? "var(--up)" : "var(--down)",
          }}
        />
      </span>
      <span
        className="font-mono text-sm tabular-nums"
        style={{ color: value >= 0 ? "var(--up)" : "var(--down)" }}
      >
        {percent(value)}
      </span>
    </span>
  );
}

function Row({ row, kind }: { row: OptionRow; kind: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div variants={staggerItem} className="border-t border-border">
      <button
        onClick={() => setOpen((was) => !was)}
        className="grid w-full grid-cols-[5rem_1fr_6rem] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-raised sm:grid-cols-[5rem_6rem_7rem_1fr_6rem]"
      >
        <span className="font-mono text-sm text-text tabular-nums">
          {money(row.strike)}
        </span>
        <span className="hidden font-mono text-sm text-text-muted tabular-nums sm:block">
          {money(row.premium)}
        </span>
        <span className="hidden sm:block">
          <Cushion value={row.cushion} />
        </span>
        <span className="font-mono text-sm text-text-muted tabular-nums">
          {percent(row.implied_volatility, 0)}
          {row.is_stale && (
            <span
              className="ml-2 text-xs"
              style={{ color: "var(--down)" }}
              title="No live bid. This premium came from a stale last trade."
            >
              stale
            </span>
          )}
        </span>
        <span className="text-right font-mono text-sm text-text tabular-nums">
          {percent(row.static_yield_annualised, 1)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitionInOut}
            className="overflow-hidden bg-surface-raised"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-4">
              <Detail label="Contract" value={row.contract} mono />
              <Detail label="Bid / ask" value={`${money(row.bid)} / ${money(row.ask)}`} />
              <Detail label="Premium (mid)" value={money(row.premium)} />
              <Detail label="Static yield" value={percent(row.static_yield, 2)} />
              <Detail label="Open interest" value={count(row.open_interest)} />
              <Detail label="Volume" value={count(row.volume)} />
              <Detail label="Days to expiry" value={String(row.days_to_expiry)} />
              <Detail label="Moneyness" value={percent(row.moneyness)} />
            </div>
            <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-text-faint">
              {kind === "cash_secured_put"
                ? `Assignment means buying the shares at ${money(row.strike)}. The static yield is the premium over that strike held as cash, and it assumes the put expires worthless.`
                : `Assignment means selling your shares at ${money(row.strike)}. The static yield is the premium over the shares' current value, and it assumes the call expires worthless.`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-faint">{label}</p>
      <p className={`mt-1 text-sm text-text ${mono ? "font-mono text-xs" : "font-mono"}`}>
        {value}
      </p>
    </div>
  );
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("");
  const [kinds, setKinds] = useState<OptionKind[]>([]);
  const [kind, setKind] = useState("cash_secured_put");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("");
  const [minOpenInterest, setMinOpenInterest] = useState(0);
  const [otmOnly, setOtmOnly] = useState(true);
  const [screen, setScreen] = useState<OptionScreen | null>(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOptionKinds()
      .then((body) => {
        setKinds(body.kinds);
        setWarning(body.WARNING);
      })
      .catch(() => setKinds([]));
  }, []);

  /** Expiries are per symbol, so the list is cleared when the symbol changes. */
  const loadExpiries = useCallback(async (wanted: string) => {
    setExpiries([]);
    setExpiry("");
    if (!wanted.trim()) return;
    try {
      const body = await getOptionExpiries(wanted);
      setExpiries(body.expiries);
    } catch {
      // A symbol with no listed options is a fact, not an error worth
      // shouting about — the screen below says so when it is asked to run.
      setExpiries([]);
    }
  }, []);

  const run = useCallback(async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError("");
    try {
      const body = await getOptionScreen(symbol, {
        kind,
        expiry: expiry || undefined,
        minOpenInterest,
        outOfTheMoneyOnly: otmOnly,
      });
      setScreen(body);
      setWarning(body.WARNING);
    } catch (caught) {
      setScreen(null);
      setError(
        caught instanceof ApiError ? caught.message : "Could not read the chain.",
      );
    } finally {
      setLoading(false);
    }
  }, [symbol, kind, expiry, minOpenInterest, otmOnly]);

  const chosen = kinds.find((entry) => entry.key === kind);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-lg font-medium text-text">Options premium</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        What the market is paying right now to take the other side of a
        cash-secured put or a covered call, ranked by the premium it quotes.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-text-faint">
        This page ranks quotes. It does not rank strategies, and unlike every
        other page on this desk it never can — see below.
      </p>

      {warning && <Caveat text={warning} />}

      <div className="mt-8">
        <p className="text-sm text-text-muted">Structure</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {kinds.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setKind(entry.key)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                kind === entry.key
                  ? "border-text bg-surface-raised text-text"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              {entry.name}
            </button>
          ))}
        </div>
        {chosen && (
          <p className="mt-2 max-w-2xl text-sm text-text-faint">
            {chosen.describe}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col">
          <span className="text-sm text-text-muted">Symbol</span>
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            onBlur={(event) => loadExpiries(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") run();
            }}
            placeholder="AAPL"
            className="mt-2 w-32 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text outline-none focus:border-text"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-text-muted">Expiry</span>
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text outline-none focus:border-text"
          >
            <option value="">Nearest listed</option>
            {expiries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-text-muted">Min open interest</span>
          <input
            type="number"
            min={0}
            value={minOpenInterest}
            onChange={(event) =>
              setMinOpenInterest(Math.max(0, Number(event.target.value) || 0))
            }
            className="mt-2 w-32 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text outline-none focus:border-text"
          />
        </label>

        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={otmOnly}
            onChange={(event) => setOtmOnly(event.target.checked)}
            className="h-4 w-4 accent-[var(--up)]"
          />
          <span className="text-sm text-text-muted">Out of the money only</span>
        </label>

        <button
          onClick={run}
          disabled={loading || !symbol.trim()}
          className="rounded-lg border border-border bg-surface-raised px-5 py-2 text-sm text-text transition-colors hover:border-text disabled:opacity-40"
        >
          {loading ? "Reading…" : "Read the chain"}
        </button>
      </div>

      {error && (
        <p
          className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm"
          style={{ color: "var(--down)" }}
        >
          {error}
        </p>
      )}

      {screen && (
        <>
          <div className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="font-mono text-sm text-text">{screen.symbol}</p>
            <p className="text-sm text-text-muted">
              spot{" "}
              <span className="font-mono text-text">{money(screen.spot)}</span>
            </p>
            <p className="text-sm text-text-muted">
              expiry <span className="font-mono text-text">{screen.expiry}</span>{" "}
              <span className="text-text-faint">
                ({screen.days_to_expiry}d)
              </span>
            </p>
            <p className="text-sm text-text-faint">
              quoted {stamp(screen.fetched_at)}
            </p>
            <p className="text-sm text-text-faint">
              {screen.out_of_the_money_only
                ? "out-of-the-money strikes only"
                : "every strike, in the money included"}
            </p>
          </div>

          {screen.rows.length === 0 ? (
            <p className="mt-6 text-sm text-text-faint">
              No strike on this expiry has a priceable premium.
            </p>
          ) : (
            <motion.div
              variants={staggerContainer()}
              initial="hidden"
              animate="show"
              className="mt-6 overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="grid grid-cols-[5rem_1fr_6rem] gap-4 px-4 py-3 text-xs uppercase tracking-wide text-text-faint sm:grid-cols-[5rem_6rem_7rem_1fr_6rem]">
                <span>Strike</span>
                <span className="hidden sm:block">Premium</span>
                <span className="hidden sm:block">Cushion</span>
                <span>IV</span>
                <span className="text-right">Static yield p.a.</span>
              </div>
              {screen.rows.map((row) => (
                <Row key={row.contract} row={row} kind={screen.kind} />
              ))}
            </motion.div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-text-faint">
            &ldquo;Static yield p.a.&rdquo; is the quoted premium over the
            collateral, extrapolated to a year on the assumption the option
            expires worthless. It is arithmetic on today&rsquo;s quotes, not a
            return anyone has earned, and it ignores assignment, early exercise,
            margin and tail risk.
          </p>
          {screen.out_of_the_money_only && (
            <p className="mt-2 text-xs leading-relaxed text-text-faint">
              In-the-money strikes are hidden by default. They quote the largest
              premiums on the board precisely because they are expected to be
              assigned — selling one is a directional position rather than
              premium harvesting. Untick the box to see them; the cushion column
              says which side of the money every row is on either way.
            </p>
          )}
        </>
      )}
    </main>
  );
}
