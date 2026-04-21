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

export async function appendPositions(states: AircraftState[]): Promise<number> {
  const rows = states
    .filter(
      (s) =>
        typeof s.latitude === "number" &&
        typeof s.longitude === "number" &&
        !s.on_ground
    )
    .map((s) => ({
      icao24: s.icao24,
      longitude: s.longitude!,
      latitude: s.latitude!,
      altitude_m: s.altitude_m,
      heading_deg: s.heading_deg,
      observed_at: new Date().toISOString(),
    }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("aircraft_positions").insert(batch);
    if (error) throw new Error(`insert aircraft_positions: ${error.message}`);
  }
  return rows.length;
}

export async function cleanupStale(): Promise<{ positions: number; states: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { error: e1, count: posCount } = await supabase
    .from("aircraft_positions")
    .delete({ count: "exact" })
    .lt("observed_at", oneHourAgo);
  if (e1) throw new Error(`cleanup positions: ${e1.message}`);

  const { error: e2, count: stateCount } = await supabase
    .from("aircraft_states")
    .delete({ count: "exact" })
    .lt("updated_at", fifteenMinAgo);
  if (e2) throw new Error(`cleanup states: ${e2.message}`);

  return { positions: posCount ?? 0, states: stateCount ?? 0 };
}
