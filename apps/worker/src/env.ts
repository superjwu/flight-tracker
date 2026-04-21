import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS ?? 10_000),
  POSITION_SAMPLE_EVERY: Number(process.env.POSITION_SAMPLE_EVERY ?? 3),
  CLEANUP_EVERY: Number(process.env.CLEANUP_EVERY ?? 30),
  OPENSKY_USERNAME: process.env.OPENSKY_USERNAME ?? "",
  OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD ?? "",
};
