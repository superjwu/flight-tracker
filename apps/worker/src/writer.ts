import type { AircraftState } from "@flight-tracker/shared";
import { supabase } from "./supabase.js";

const CHUNK = 500;

export async function upsertStates(states: AircraftState[]): Promise<number> {
  // Worker only writes planes we have a position for. States without lat/lon are skipped.
  const valid = states.filter(
    (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
  );
  const rows = valid.map((s) => ({ ...s, updated_at: new Date().toISOString() }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("aircraft_states")
      .upsert(batch, { onConflict: "icao24" });
    if (error) throw new Error(`upsert aircraft_states: ${error.message}`);
  }
  return rows.length;
}

export async function cleanupStale(): Promise<{ states: number }> {
  // Drop aircraft that haven't transmitted in 15 minutes — they've landed,
  // left coverage, or stopped broadcasting. Keeps aircraft_states bounded.
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from("aircraft_states")
    .delete({ count: "exact" })
    .lt("updated_at", fifteenMinAgo);
  if (error) throw new Error(`cleanup states: ${error.message}`);
  return { states: count ?? 0 };
}
