import { env } from "./env.js";
import { fetchOpenSkyStates } from "./opensky.js";
import { cleanupStale, upsertStates } from "./writer.js";

let tickCount = 0;
let consecutiveFailures = 0;

async function tick() {
  tickCount += 1;
  const started = Date.now();
  try {
    const states = await fetchOpenSkyStates();
    const wrote = await upsertStates(states);

    let cleaned: { states: number } | null = null;
    if (tickCount % env.CLEANUP_EVERY === 0) {
      cleaned = await cleanupStale();
    }

    const ms = Date.now() - started;
    console.log(
      `[tick ${tickCount}] ${ms}ms | fetched=${states.length} wrote=${wrote}` +
        (cleaned ? ` cleaned=${cleaned.states}s` : "")
    );
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures += 1;
    console.error(
      `[tick ${tickCount}] FAILED (${consecutiveFailures}x):`,
      (err as Error).message
    );
    if (consecutiveFailures >= 10) {
      console.error("too many consecutive failures, exiting");
      process.exit(1);
    }
  }
}

function scheduleNext(delay: number) {
  setTimeout(async () => {
    await tick();
    const next = consecutiveFailures > 0
      ? Math.min(env.POLL_INTERVAL_MS * Math.pow(2, consecutiveFailures), 120_000)
      : env.POLL_INTERVAL_MS;
    scheduleNext(next);
  }, delay);
}

console.log(
  `flight-tracker worker starting | interval=${env.POLL_INTERVAL_MS}ms ` +
    `cleanupEvery=${env.CLEANUP_EVERY} startupDelay=${env.STARTUP_DELAY_MS}ms`
);

// Startup delay avoids hammering OpenSky when the process restarts repeatedly
// (e.g. tsx watch in dev). Without this, rapid file saves can rack up 429s.
scheduleNext(env.STARTUP_DELAY_MS);

process.on("SIGINT", () => { console.log("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(0); });
