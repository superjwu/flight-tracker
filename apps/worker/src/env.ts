import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  // Anonymous OpenSky: 400 credits/day, /states/all = 4 credits. 96 polls/day
  // budget = every 15 min. Register a free account for 4000/day (every 90s).
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS ?? 900_000),
  CLEANUP_EVERY: Number(process.env.CLEANUP_EVERY ?? 4),
  STARTUP_DELAY_MS: Number(process.env.STARTUP_DELAY_MS ?? 30_000),
  OPENSKY_CLIENT_ID: process.env.OPENSKY_CLIENT_ID ?? "",
  OPENSKY_CLIENT_SECRET: process.env.OPENSKY_CLIENT_SECRET ?? "",
  // Legacy basic-auth fallback, still works for grandfathered accounts.
  OPENSKY_USERNAME: process.env.OPENSKY_USERNAME ?? "",
  OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD ?? "",
};
