import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  // airplanes.live community feed — no auth, no strict rate limit.
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  CLEANUP_EVERY: Number(process.env.CLEANUP_EVERY ?? 10),
  STARTUP_DELAY_MS: Number(process.env.STARTUP_DELAY_MS ?? 5_000),
};
