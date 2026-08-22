const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export interface Skill {
  hit_rate: number;
  samples: number;
  effective: number;
  edge: number;
  t_stat: number;
  weight: number;
  note: string;
}

export interface Reading {
  key: string;
  name: string;
  family: string;
  kind: string;
  describe: string;
  score: number;
  skill: Skill;
  detail: string;
  weight: number;
}

export interface HorizonInfo {
  key: string;
  label: string;
  interval: string;
  bars: number;
  period: string;
  bars_at: Record<string, number>;
  min_bars: number;
}

export interface HorizonVerdict {
  horizon: HorizonInfo;
  readings: Reading[];
  score: number;
  confidence: number;
  agreement: number;
  weighted_edge: number;
  typical_move_pct: number;
  bars_used: number;
  interval: string;
  rows: number;
  last_price: number;
  as_of: string | null;
  coverage: number;
  unavailable: string;
  action: string;
  expected_move_pct: number;
  target_price: number;
  available: boolean;
}

export interface UltimateVerdict {
  symbol: string;
  horizons: HorizonVerdict[];
  score: number;
  confidence: number;
  alignment: string;
  generated_at: string;
  errors: Record<string, string>;
  action: string;
  last_price: number;
}

export interface FreezeReport {
  active: boolean;
  ledger_path: string;
  frozen_ids: string[];
  frozen_horizons: string[];
  skipped_horizons: string[];
  error: string | null;
  excluded: string | null;
}

export interface SignalResponse {
  verdict: UltimateVerdict;
  freeze: FreezeReport;
}

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OhlcvResponse {
  symbol: string;
  interval: string;
  bars: Bar[];
  is_fresh: boolean;
}

export interface PositionCall {
  action: string;
  score: number;
  confidence: number;
}

export interface PositionRow {
  Symbol: string;
  Units: number;
  "Unit cost": number;
  "Cost basis": number;
  Last: number | null;
  Value: number | null;
  "P&L": number | null;
  "P&L %": number | null;
  "Weight %": number | null;
  call: PositionCall | null;
}

export interface PortfolioSummary {
  market_value: number;
  cost_basis: number;
  pnl: number;
  pnl_pct: number;
  concentration_pct: number;
  positions: number;
  realised: number;
  fees: number;
}

export interface BookSignal {
  score: number;
  confidence: number;
  buying: string[];
  selling: string[];
  unreadable: string[];
  total: number;
}

export interface LedgerRow {
  When: string;
  Side: string;
  Symbol: string;
  Units: number;
  Price: number;
  Value: number;
  Commission: number;
  Realised: number | null;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PositionRow[];
  unpriced: string[];
  errors: Record<string, string>;
  signal: BookSignal | null;
  verdicts: Record<string, UltimateVerdict>;
  ledger: LedgerRow[];
}

export class ApiError extends Error {}

export async function getSignal(symbol: string): Promise<SignalResponse> {
  const response = await fetch(
    `${API_BASE}/api/signal/${encodeURIComponent(symbol.trim().toUpperCase())}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `request failed (${response.status})`);
  }
  return response.json();
}

export async function getOhlcv(
  symbol: string,
  period = "1y",
  interval = "1d",
): Promise<OhlcvResponse> {
  const params = new URLSearchParams({ period, interval });
  const response = await fetch(
    `${API_BASE}/api/ohlcv/${encodeURIComponent(symbol.trim().toUpperCase())}?${params}`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `request failed (${response.status})`);
  }
  return response.json();
}

function extractErrorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI/pydantic validation errors: a list of {loc, msg, type}.
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String(d.msg) : String(d)))
      .join("; ");
  }
  return `request failed (${status})`;
}

export interface TradeRequest {
  side: "buy" | "sell";
  symbol: string;
  quantity: number;
  price: number;
  fee?: number;
}

export interface Transaction {
  at: string;
  side: string;
  symbol: string;
  quantity: number;
  price: number;
  fee: number;
  realised: number;
  note: string;
}

export async function postTrade(trade: TradeRequest): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/api/portfolio/trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body, response.status));
  }
  return response.json();
}

export async function clearLedger(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/portfolio/ledger/clear`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body, response.status));
  }
}

export async function getPortfolio(): Promise<PortfolioResponse> {
  const response = await fetch(`${API_BASE}/api/portfolio`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `request failed (${response.status})`);
  }
  return response.json();
}
