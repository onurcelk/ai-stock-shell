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
