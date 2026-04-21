# Flight Tracker — Architecture

Live global aircraft tracker. Exercises the full external-data pipeline:

```
OpenSky Network  →  Railway Worker  →  Supabase (Postgres + Realtime)  →  Next.js on Vercel
        (HTTP,           (Node/TS,            (aircraft_states +                (MapLibre GL,
     10s poll)         upserts every 10s)    Realtime publication)        Clerk auth, RLS)
```

## Layout

```
flight-tracker/
├── apps/
│   ├── web/       # Next.js 15 frontend (Vercel)
│   └── worker/    # Node/TS poller (Railway)
├── packages/
│   └── shared/    # Cross-app TypeScript types + region bboxes
├── supabase/
│   └── migrations/ # 4 sql files, applied in order
├── CLAUDE.md
└── README.md
```

npm workspaces. Root scripts: `dev:web`, `dev:worker`, `build`, `typecheck`.

## Data flow

1. **Worker** (`apps/worker/src/index.ts`) runs `setInterval(tick, 10_000)`.
   - `fetchOpenSkyStates()` calls `GET https://opensky-network.org/api/states/all`.
   - `upsertStates()` upserts rows in `aircraft_states` keyed by `icao24` (chunks of 500).
   - Every 3rd tick (~30s), `appendPositions()` inserts sampled rows into `aircraft_positions` for trails.
   - Every 30th tick (~5 min), `cleanupStale()` deletes positions >1h old and states >15 min stale.
2. **Supabase** replicates `aircraft_states` UPDATE/INSERT/DELETE via the `supabase_realtime` publication (enabled in `0004_realtime.sql`).
3. **Frontend** (`apps/web/components/LiveMap.tsx`):
   - On mount: bbox-scoped snapshot query against `aircraft_states`.
   - Subscribes to `postgres_changes` on `aircraft_states`. Events outside the viewport bbox are dropped.
   - MapLibre markers are mutated in-place (no React rerenders per tick — ~20k possible markers).
   - On `moveend`, re-queries the snapshot (min 1.5s throttle).

## Auth

- **Clerk** signs users in. `ClerkProvider` wraps the app in `apps/web/app/layout.tsx`.
- `apps/web/middleware.ts` protects `/favorites`, `/alerts`, and authenticated API routes.
- `apps/web/app/api/clerk-webhook/route.ts` consumes `user.created` / `user.updated` / `user.deleted` and upserts into Supabase `users` using the service role.
- Browser Supabase client (`apps/web/lib/supabase-browser.ts`) uses Clerk as a **third-party auth provider**. Supabase verifies Clerk-issued JWTs via Clerk's JWKS endpoint — no shared JWT secret. The `accessToken` callback hands Supabase a fresh Clerk session token per request; Postgres RLS reads `auth.jwt() ->> 'sub'` to identify the Clerk user.
- RLS policies (`supabase/migrations/0003_rls.sql`) restrict `favorite_flights`, `favorite_airlines`, `saved_views`, `alert_rules`, and `alert_events` to the current user via `current_user_row_id()`.
- Public tables `aircraft_states` and `aircraft_positions` have a `select using (true)` policy — signed-out users can see the live map.

## Key files

| Path | Purpose |
|---|---|
| `apps/worker/src/opensky.ts` | Parse OpenSky state-vector array → typed `AircraftState` |
| `apps/worker/src/writer.ts` | `upsertStates`, `appendPositions`, `cleanupStale` |
| `apps/worker/src/index.ts` | Main poll loop with exponential-backoff on failure |
| `apps/web/components/LiveMap.tsx` | MapLibre + realtime subscription + viewport bbox |
| `apps/web/components/FlightDetailPanel.tsx` | Per-plane panel + altitude trail chart |
| `apps/web/lib/supabase-browser.ts` | Clerk-JWT-aware Supabase client (`useSupabase()` hook) |
| `apps/web/lib/favorites-context.tsx` | Global favorites context (callsigns + airlines) |
| `apps/web/app/api/clerk-webhook/route.ts` | User sync from Clerk → Supabase |
| `apps/web/app/api/alerts/check/route.ts` | Rule evaluator — cron + manual trigger |
| `supabase/migrations/0001_init.sql` | `aircraft_states`, `aircraft_positions`, public-read RLS |
| `supabase/migrations/0002_user_data.sql` | User tables |
| `supabase/migrations/0003_rls.sql` | RLS + `current_user_row_id()` helper |
| `supabase/migrations/0004_realtime.sql` | Enable realtime publication |

## Deployment

- **Web → Vercel**: root directory `apps/web`. Env vars from `.env.local.example`. `vercel.json` configures the `/api/alerts/check` cron.
- **Worker → Railway**: root directory `""` (repo root), dockerfile `apps/worker/Dockerfile`. Env vars from `apps/worker/.env.example`. Restart policy `ON_FAILURE`.
- **Supabase**: project created via the Supabase MCP. Migrations applied in order `0001 → 0002 → 0003 → 0004`. Realtime publication enabled on `aircraft_states`.

## Personalization features

| Feature | Tables | UI |
|---|---|---|
| Favorite flights (callsign) | `favorite_flights` | `/favorites`, detail panel button |
| Favorite airlines (ICAO) | `favorite_airlines` | `/favorites`, detail panel button |
| Saved region views (bbox) | `saved_views` | Map "Save view" button, listed on `/favorites` |
| Alert rules | `alert_rules`, `alert_events` | `/alerts` (create/list/toggle/delete, manual re-check) |

## Local dev quickstart

```bash
# 1. Install
npm install

# 2. Create .env files (see .env.local.example / .env.example)
cp apps/web/.env.local.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env

# 3. Apply migrations to your Supabase project (or run via MCP)
# psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql ...

# 4. Run worker (populates aircraft_states)
npm run dev:worker

# 5. Run web (in another terminal)
npm run dev:web
# open http://localhost:3000/map
```
