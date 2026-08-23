# The desk

The frontend for `Stock-Prediction-Models`, in the Obsidian design system.
Since Phase 7 (the cutover, 2026-08-23) this **is** the product: the Streamlit
app it replaced is retained next door as an internal fallback only.

Nine pages — Signal, Chart, Portfolio, Basket, Forecast, Agents, Monte Carlo,
History, Research — plus the landing page. Every one of them reads the FastAPI
service in `Stock-Prediction-Models/api`; none of them computes anything the
engine could compute, which is what keeps this page and that engine from ever
disagreeing about a number.

## Running it

Both halves together, from the repository next door — this is the normal way:

```bash
cd ../../Stock-Prediction-Models
python run_desk.py
```

That starts the API on :8000, this app on :3000, opens a tab, and owns the
session lifecycle (the startup prospective freeze, the missed-day replays, and
the forecast-ledger backup). Starting this app on its own skips all of that.

On its own, when the API is already up:

```bash
npm run dev      # hot reload, slower pages
npm run build && npm run start
```

`run_desk.py` prefers `npm run start` and falls back to `dev` when there is no
production build in `.next`, so building once here makes every later launch
faster.

## The API base

`src/lib/api.ts` reads `NEXT_PUBLIC_API_BASE`, defaulting to
`http://localhost:8000`. `run_desk.py` sets it from its own `--port`, so a
non-default API port works without editing anything here. Next inlines
`NEXT_PUBLIC_*` at build time, so a production build pins whatever was set when
it was built.

## Conventions worth knowing before editing

- **The design system is settled.** `../MANIFESTO.md` — dark only, one accent,
  reserved up/down colours for financial deltas, motion throughout. Extend the
  tokens; do not introduce a second visual language.
- **The nav lives in one place.** `src/lib/routes.ts`. Adding a page is an
  entry there; a nav entry that leads nowhere is worse than a missing one, so
  `PLANNED` is deliberately not rendered.
- **Caveats travel with numbers.** Every honesty note the Streamlit app carried
  was ported deliberately — the 0-of-N verdict, the single-split warning, the
  fixed-units sizing caveat, the replay-versus-production split on Research.
  They are not decoration and should not be trimmed for layout.
- **No page writes by accident.** Freezing a forecast is a `POST` behind an
  explicit control, never a page load. That is Phase 6a's finding, and it is
  the reason `GET /api/signal` returns `freeze: null`.
- **Check three things before calling a change done**: `npx tsc --noEmit`,
  `npx eslint`, `npm run build`, plus no horizontal overflow at 390px.

## What this deliberately does not have

Four capabilities were retired by owner decision at the cutover and must not be
rebuilt here without a new one: single-split forecasting, the model-assisted
Signal verdict and its `include_agents` toggle, direct editing of holdings
(it bypasses the transaction ledger that makes the book auditable), and the
pre-run training-time estimate. See `Stock-Prediction-Models/CLAUDE.md` §9.3.

Bundled datasets are readable everywhere the window selector appears, but 16 of
the 17 are 252 bars or fewer and the Signal horizons need 260–300, so offline
Signal readings mostly decline rather than interpolate. That is a property of
the bundled data, not a bug in the page — see §9.5 there.
