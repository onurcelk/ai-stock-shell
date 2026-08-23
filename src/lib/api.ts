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
  /**
   * `null` on a read. `GET /api/signal/{symbol}` never writes to the forecast
   * ledger -- a page load, a prefetch, a StrictMode double-invoke and an
   * end-to-end replay all issue GETs, and none of them is a person choosing to
   * record a prospective forecast. Freezing is `freezeSignal()` below.
   */
  freeze: (FreezeReport & { summary: string }) | null;
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

export class ApiError extends Error {
  /**
   * The HTTP status, when the failure came back as a response rather than as a
   * dead connection. `followJob` needs it to tell a stale job (410, the server
   * restarted and the in-memory registry went with it) from a job that is
   * merely missing -- the first is permanent and worth saying so, and retrying
   * either one would never succeed.
   */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Every call goes through here, so one error shape is parsed in one place. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body, response.status), response.status);
  }
  return response.json();
}

const ticker = (symbol: string) =>
  encodeURIComponent(symbol.trim().toUpperCase());

export function getSignal(symbol: string): Promise<SignalResponse> {
  return request(`/api/signal/${ticker(symbol)}`);
}

/**
 * Record the current reading as a prospective forecast.
 *
 * The engine runs once inside the freeze, so the verdict that comes back is
 * the verdict that was written -- show that one, not the one already on
 * screen. A refused write arrives as `freeze.error` or `freeze.excluded` on a
 * successful response, never as a thrown error: the reading is valid whether
 * or not the ledger accepted it.
 */
export function freezeSignal(symbol: string): Promise<SignalResponse> {
  return request(`/api/signal/${ticker(symbol)}/freeze`, { method: "POST" });
}

export function getOhlcv(
  symbol: string,
  period = "1y",
  interval = "1d",
): Promise<OhlcvResponse> {
  const params = new URLSearchParams({ period, interval });
  return request(`/api/ohlcv/${ticker(symbol)}?${params}`);
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

export function postTrade(trade: TradeRequest): Promise<Transaction> {
  return request("/api/portfolio/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
}

export async function clearLedger(): Promise<void> {
  await request("/api/portfolio/ledger/clear", { method: "POST" });
}

export function getPortfolio(): Promise<PortfolioResponse> {
  return request("/api/portfolio");
}

// ------------------------------------------------------------- Monte Carlo

export interface MonteCarloSummary {
  mean: number;
  median: number;
  p5: number;
  p95: number;
  prob_up: number;
}

export interface MonteCarloResponse {
  symbol: string;
  interval: string;
  days: number;
  simulations: number;
  seed: number | null;
  paths_drawn: number;
  last_price: number;
  daily_volatility: number;
  drift: number;
  summary: MonteCarloSummary;
  /** Sampled for drawing — never the whole matrix. */
  paths: number[][];
  median_path: number[];
  p5_path: number[];
  p95_path: number[];
  histogram: { edges: number[]; counts: number[] };
  is_fresh: boolean;
}

export function getMonteCarlo(
  symbol: string,
  options: { days: number; simulations: number; seed: number | null },
): Promise<MonteCarloResponse> {
  const params = new URLSearchParams({
    days: String(options.days),
    simulations: String(options.simulations),
  });
  if (options.seed !== null) params.set("seed", String(options.seed));
  return request(`/api/montecarlo/${ticker(symbol)}?${params}`);
}

// ----------------------------------------------------------------- History

export interface RunSummary {
  id: string;
  kind: string;
  kind_label: string;
  label: string;
  saved_at: string;
  age: string;
  settings: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

export interface RunsResponse {
  runs: RunSummary[];
  table: Record<string, unknown>[];
  columns: string[];
  kinds: Record<string, string>;
  total: number;
}

export interface RunDetail extends RunSummary {
  payload: Record<string, unknown>;
}

export function getRuns(kind?: string): Promise<RunsResponse> {
  return request(`/api/runs${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`);
}

export function getRun(id: string): Promise<RunDetail> {
  return request(`/api/runs/${encodeURIComponent(id)}`);
}

export async function deleteRun(id: string): Promise<void> {
  await request(`/api/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function clearRuns(): Promise<number> {
  const body = await request<{ removed: number }>("/api/runs/clear?confirm=true", {
    method: "POST",
  });
  return body.removed;
}

// ----------------------------------------------------------------- Studies

export interface StudyMeta {
  key: string;
  name: string;
  /** "overlay" draws on the price axis; "oscillator" gets its own pane. */
  pane: string;
  describe: string;
  requires: string[];
  lines: string[];
  levels: number[];
  source: string;
}

export interface StudiesCatalogue {
  studies: StudyMeta[];
  panes: { overlay: string; oscillator: string };
  rules: Record<string, string>;
}

export interface StudiesResponse {
  symbol: string;
  interval: string;
  dates: string[];
  available: StudyMeta[];
  studies: Record<string, Record<string, (number | null)[]>>;
  /** Keys the series lacks the columns to draw, each with the reason. */
  unsupported: Record<string, string>;
  bars: number;
  is_fresh: boolean;
}

export function getStudyCatalogue(): Promise<StudiesCatalogue> {
  return request("/api/studies");
}

export function getStudies(
  symbol: string,
  keys: string[],
  options: { period?: string; interval?: string; bars?: number } = {},
): Promise<StudiesResponse> {
  const params = new URLSearchParams({ keys: keys.join(",") });
  if (options.period) params.set("period", options.period);
  if (options.interval) params.set("interval", options.interval);
  if (options.bars) params.set("bars", String(options.bars));
  return request(`/api/studies/${ticker(symbol)}?${params}`);
}

export interface StatsResponse {
  symbol: string;
  interval: string;
  stats: {
    rows: number;
    start: string;
    end: string;
    first: number;
    last: number;
    change_pct: number;
    high: number;
    low: number;
    bars_per_year: number;
    volatility_pct: number;
  };
  is_fresh: boolean;
}

export function getStats(
  symbol: string,
  period = "1y",
  interval = "1d",
): Promise<StatsResponse> {
  const params = new URLSearchParams({ period, interval });
  return request(`/api/stats/${ticker(symbol)}?${params}`);
}

// ---------------------------------------------------------------- Research

/** Columns travel with the rows — these frames genuinely differ in shape. */
export interface Frame {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ResearchResponse {
  exists: boolean;
  ledger_name: string;
  counts: {
    forecasts: number;
    outcomes: number;
    independent_cutoffs: number;
    min_cutoffs: number;
  };
  /** The sentence that must sit above every number on this page. */
  warning: string | null;
  thin: boolean;
  has_forecasts: boolean;
  has_outcomes: boolean;
  production: Frame;
  weights: Frame;
  quality: Frame;
  calibration: Frame;
  rolling: Frame;
  leaderboard: Frame;
  history: Frame;
  promotion_requirements: Frame;
  pipeline: Frame;
  study: {
    exists: boolean;
    name: string;
    /** Not a sample-size caveat — what disqualifies a replay is retrospection. */
    warning: string | null;
    has_outcomes: boolean;
    n_scored: number;
    n_independent_cutoffs: number;
    n_symbols: number;
    versions: string[];
    summary: Frame;
    actions: Frame;
    versions_table: Frame;
    vs_live: Frame;
  };
}

export function getResearch(): Promise<ResearchResponse> {
  return request("/api/research");
}

// ------------------------------------------------------------------- Jobs

export type JobState = "queued" | "running" | "completed" | "failed";

export interface JobProgress {
  /** 0 to 1. */
  fraction: number;
  message: string;
}

export interface Job<T = unknown> {
  id: string;
  kind: "walkforward" | "project" | "agent";
  state: JobState;
  params: Record<string, unknown>;
  progress: JobProgress;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  /** Absent until the job completes, and absent from the listing entirely. */
  result?: T | null;
}

/** What a POST returns: the job, without a result, plus whether it is new. */
export interface StartedJob extends Job {
  /**
   * True when an identical request was already in flight and this call joined
   * it rather than starting a second one.
   */
  duplicate: boolean;
}

export interface WalkForwardRequest {
  symbol: string;
  period?: string;
  interval?: string;
  model?: string;
  folds?: number;
  horizon?: number;
  epochs?: number;
  num_layers?: number;
  size_layer?: number;
  timestamp?: number;
  dropout?: number;
  learning_rate?: number;
  seed?: number | null;
  min_train?: number;
}

export interface WalkForwardResult {
  symbol: string;
  label: string;
  run_id: string;
  folds: number;
  horizon: number;
  model: string;
  summary: Record<string, number>;
  folds_beating_naive: number;
  table: Record<string, unknown>[];
  settings: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

export interface ProjectRequest extends Omit<WalkForwardRequest, "folds" | "min_train"> {
  horizon?: number;
}

export interface ProjectResult {
  symbol: string;
  label: string;
  model: string;
  horizon: number;
  last_price: number;
  last_date: string;
  path: number[];
  final: number;
  move_pct: number;
  direction: number;
}

export interface AgentRequest {
  symbol: string;
  agent: string;
  period?: string;
  interval?: string;
  iterations?: number;
  window_size?: number;
  layer_size?: number;
  seed?: number;
  initial_money?: number;
  max_buy?: number;
  max_sell?: number;
  fee_pct?: number;
  slippage_pct?: number;
  sizing?: string;
  size_pct?: number;
}

export interface AgentResult {
  symbol: string;
  label: string;
  run_id: string;
  agent: string;
  settings: Record<string, unknown>;
  metrics: Record<string, number>;
  rewards: number[];
  train_seconds: number;
  improved: boolean;
  dates: string[];
  equity: number[];
  buys: number[];
  sells: number[];
  final_value: number;
}

export interface AgentCatalogue {
  agents: { name: string; default_iterations: number | null; notebook: number | null }[];
  sizing_modes: string[];
}

export function startWalkForward(request: WalkForwardRequest): Promise<StartedJob> {
  return post("/api/jobs/walkforward", request);
}

export function startProjection(request: ProjectRequest): Promise<StartedJob> {
  return post("/api/jobs/project", request);
}

export function startAgent(request: AgentRequest): Promise<StartedJob> {
  return post("/api/jobs/agent", request);
}

export function getAgentCatalogue(): Promise<AgentCatalogue> {
  return request("/api/agents");
}

export interface ModelCatalogue {
  models: string[];
  default_seed: number;
}

/**
 * The network architectures the engine actually has, rather than three names
 * copied into this file -- the same reason the agent roster is fetched.
 */
export function getModelCatalogue(): Promise<ModelCatalogue> {
  return request("/api/models");
}

/**
 * Poll one job.
 *
 * A 410 means the server restarted: the registry is in memory, so the job is
 * gone rather than merely unfinished. Stop polling and offer to start again --
 * retrying the same id will never succeed.
 */
export function getJob<T = unknown>(id: string): Promise<Job<T>> {
  return request(`/api/jobs/${encodeURIComponent(id)}`);
}

export function getJobs(): Promise<{ jobs: Job[]; boot: string }> {
  return request("/api/jobs");
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Poll `getJob` until it reaches a terminal state, reporting progress on the
 * way. Rejects with the job's own error message if it failed, so a caller can
 * treat a failed training the same as a failed request.
 */
export async function followJob<T>(
  id: string,
  onProgress?: (job: Job<T>) => void,
  { intervalMs = 1000, signal }: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  for (;;) {
    if (signal?.aborted) throw new ApiError("cancelled");
    const job = await getJob<T>(id);
    onProgress?.(job);
    if (job.state === "completed") return job.result as T;
    if (job.state === "failed") throw new ApiError(job.error ?? "the job failed");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
