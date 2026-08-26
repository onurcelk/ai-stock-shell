/**
 * How a call is coloured and ranked, in one place.
 *
 * Three files had a private copy of this map, and all three were keyed on
 * `STRONG_BUY` while the engine sends `"STRONG BUY"` — `ultimate.py` defines
 * them with a space, and the API passes the string through untouched. So every
 * lookup for the two strongest calls missed and fell back to muted grey: the
 * one reading the desk most wants you to notice was the one rendered as though
 * nothing had been said. Keyed on the wire format here, with the underscored
 * spelling kept as an alias so a caller that normalises first still resolves.
 *
 * Green and red are `--up`/`--down`, the tokens reserved for signed financial
 * direction. HOLD is deliberately not a third colour: an abstention is the
 * engine declining to make a claim, and giving it a hue of its own would make
 * "no call" look like a call.
 */

export const STRONG_BUY = "STRONG BUY";
export const BUY = "BUY";
export const HOLD = "HOLD";
export const SELL = "SELL";
export const STRONG_SELL = "STRONG SELL";

const COLOR: Record<string, string> = {
  [STRONG_BUY]: "var(--up)",
  [BUY]: "var(--up)",
  [HOLD]: "var(--text-muted)",
  [SELL]: "var(--down)",
  [STRONG_SELL]: "var(--down)",
  STRONG_BUY: "var(--up)",
  STRONG_SELL: "var(--down)",
};

/** Strongest first. Used to sort a table and to weight a badge. */
const RANK: Record<string, number> = {
  [STRONG_BUY]: 4,
  [BUY]: 3,
  [HOLD]: 2,
  [SELL]: 1,
  [STRONG_SELL]: 0,
};

export function actionColor(action: string | null | undefined): string {
  if (!action) return "var(--text-faint)";
  return COLOR[action] ?? COLOR[action.replace("_", " ")] ?? "var(--text-muted)";
}

export function actionRank(action: string): number {
  return RANK[action] ?? RANK[action.replace("_", " ")] ?? 2;
}

/** The wire format is already display-ready; the alias spelling is not. */
export function actionLabel(action: string): string {
  return action.replace("_", " ");
}

export function isBuy(action: string): boolean {
  const normalised = action.replace("_", " ");
  return normalised === BUY || normalised === STRONG_BUY;
}

/**
 * How much weight a call earns on screen. A strong call is the one worth
 * seeing across a table of sixty rows; an abstention is worth reading but not
 * worth shouting.
 */
export function actionEmphasis(action: string): "strong" | "act" | "quiet" {
  const normalised = action.replace("_", " ");
  if (normalised === STRONG_BUY || normalised === STRONG_SELL) return "strong";
  if (normalised === BUY || normalised === SELL) return "act";
  return "quiet";
}
