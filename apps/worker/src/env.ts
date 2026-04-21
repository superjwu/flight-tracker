import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  // Anonymous OpenSky is heavily rate-limited (~100/day as of 2024). 15s cadence
  // stays inside the limit while keeping data fresh. Drop to 10s only with creds.
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS ?? 15_000),
  CLEANUP_EVERY: Number(process.env.CLEANUP_EVERY ?? 20),
  STARTUP_DELAY_MS: Number(process.env.STARTUP_DELAY_MS ?? 8_000),
  OPENSKY_USERNAME: process.env.OPENSKY_USERNAME ?? "",
  OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD ?? "",
};
