import { env } from "./env.js";
import { fetchOpenSkyStates } from "./opensky.js";
import { appendPositions, cleanupStale, upsertStates } from "./writer.js";

let tickCount = 0;
let consecutiveFailures = 0;

async function tick() {
  tickCount += 1;
  const started = Date.now();
  try {
    const states = await fetchOpenSkyStates();
    const wrote = await upsertStates(states);

    let trailAppended = 0;
    if (tickCount % env.POSITION_SAMPLE_EVERY === 0) {
      trailAppended = await appendPositions(states);
    }

    let cleaned: { positions: number; states: number } | null = null;
    if (tickCount % env.CLEANUP_EVERY === 0) {
      cleaned = await cleanupStale();
    }

    const ms = Date.now() - started;
    console.log(
      `[tick ${tickCount}] ${ms}ms | fetched=${states.length} wrote=${wrote}` +
        (trailAppended ? ` trail=${trailAppended}` : "") +
        (cleaned
          ? ` cleaned=${cleaned.positions}p/${cleaned.states}s`
          : "")
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
    // Adaptive backoff on persistent failure.
    const next = consecutiveFailures > 0
      ? Math.min(env.POLL_INTERVAL_MS * Math.pow(2, consecutiveFailures), 120_000)
      : env.POLL_INTERVAL_MS;
    scheduleNext(next);
  }, delay);
}

console.log(
  `flight-tracker worker starting | interval=${env.POLL_INTERVAL_MS}ms ` +
    `sampleEvery=${env.POSITION_SAMPLE_EVERY} cleanupEvery=${env.CLEANUP_EVERY}`
);

scheduleNext(0);

process.on("SIGINT", () => { console.log("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(0); });
