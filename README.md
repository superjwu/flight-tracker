# Flight Tracker

Live global flight tracking. Every aircraft currently transmitting ADS-B, streamed onto a world map in real time.

- **Data**: [OpenSky Network](https://opensky-network.org) (free, open ADS-B)
- **Worker**: Node/TypeScript polling every 10 seconds, deployed to Railway
- **Database**: Supabase (Postgres + Realtime)
- **Frontend**: Next.js 15 + Tailwind + MapLibre GL, deployed to Vercel
- **Auth**: Clerk (with JWT template for Supabase RLS)

Architecture: [`CLAUDE.md`](./CLAUDE.md)

## Features

- Live world map with moving plane markers (rotated by heading, colored by altitude).
- Viewport-scoped realtime — only aircraft inside your current map bounds stream into the browser.
- Region filters (World / NA / EU / Asia / etc.), airline filter (ICAO code), "favorites only" toggle.
- Flight detail panel with airline lookup, stats, and altitude-over-time trail chart.
- Personalization: favorite callsigns and airlines (glow amber on the map), saved region views, alert rules.
- Alert rules evaluated every 5 minutes (Vercel cron) or on demand: altitude above/below, enters/leaves a saved region.

## Local development

Prereqs: Node 20+, a free Supabase project, a free Clerk app.

```bash
# 1) install
npm install

# 2) configure env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET

# 3) apply supabase migrations (run in dashboard SQL editor, or via supabase CLI/MCP)
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_user_data.sql
#    supabase/migrations/0003_rls.sql
#    supabase/migrations/0004_realtime.sql

# 4) Wire Clerk as a Supabase third-party auth provider:
#    Supabase Dashboard → Authentication → Sign In / Providers → Third-Party Auth
#      → Add provider → Clerk → paste your Clerk Frontend API URL (clerk.<your-domain>.com)
#    No JWT secret needed — Supabase verifies Clerk tokens via Clerk's JWKS.

# 5) run the worker (populates aircraft_states)
npm run dev:worker

# 6) run the web app (in a second terminal)
npm run dev:web
# visit http://localhost:3000/map
```

Within ~30 seconds of the worker starting, you should see ~10–20k planes load onto the map.

## Deploy

### Supabase
Already live if you followed local-dev step 3. Otherwise, create a project at [supabase.com](https://supabase.com) and run the four migration files in order.

Turn on **Realtime** for `aircraft_states` (migration 0004 does this via SQL; verify in dashboard → Database → Replication).

### Railway (worker)
1. Push this repo to GitHub.
2. Railway → New Project → Deploy from GitHub → pick `flight-tracker`.
3. Settings → **Root Directory**: leave as `/` (repo root) — the Dockerfile at `apps/worker/Dockerfile` handles the monorepo build.
4. Variables: set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POLL_INTERVAL_MS=10000`.
5. Deploy. Logs should show `[tick N] Xms | fetched=... wrote=...` every 10 s.

### Vercel (web)
1. New Project → import the GitHub repo.
2. **Root Directory**: `apps/web`.
3. Environment variables: copy everything from `apps/web/.env.local.example` into the Vercel UI.
4. Deploy.
5. **Clerk webhook**: Clerk dashboard → Webhooks → Add endpoint → `https://<your-vercel-domain>/api/clerk-webhook` → subscribe to `user.created`, `user.updated`, `user.deleted`. Copy the Signing secret into the Vercel env as `CLERK_WEBHOOK_SECRET`.
6. **Cron**: `vercel.json` already registers `/api/alerts/check` on a `*/5 * * * *` schedule.

## Tech notes

- **Why viewport filter, not global stream?** At cruise, OpenSky surfaces ~15–20k aircraft simultaneously. Streaming all of them to every browser over Realtime saturates the free tier and chokes the browser's marker count. The frontend instead subscribes to `postgres_changes` and drops events outside the map viewport client-side, and re-queries on pan/zoom.
- **Why upsert-keyed-by-icao24 and not append-only?** The "current state" of every aircraft fits in ~20k rows and stays that size. Realtime UPDATE events naturally drive smooth map animation. Trails live separately in `aircraft_positions` with a 1 h TTL.
- **RLS with Clerk**: the browser attaches a Clerk-signed JWT (template `supabase`). Policies use `auth.jwt() ->> 'sub'` to resolve the current user row. Service-role writes (worker, webhook, alerts cron) bypass RLS — which is correct.

## License

MIT for code. Flight data licensed under OpenSky's terms (non-commercial, attribution required — see footer of the app).
