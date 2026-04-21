import type { AircraftState } from "@flight-tracker/shared";
import { env } from "./env.js";

// OpenSky returns a raw "state vector" as a positional array.
// Index reference: https://openskynetwork.github.io/opensky-api/rest.html
// [icao24, callsign, origin_country, time_position, last_contact,
//  longitude, latitude, baro_altitude, on_ground, velocity,
//  true_track, vertical_rate, sensors, geo_altitude, squawk,
//  spi, position_source, category?]
type RawStateVector = [
  string,
  string | null,
  string,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
  boolean,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean,
  number,
  number?,
];

type OpenSkyResponse = {
  time: number;
  states: RawStateVector[] | null;
};

const ENDPOINT = "https://opensky-network.org/api/states/all";

export async function fetchOpenSkyStates(): Promise<AircraftState[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD) {
    const basic = Buffer.from(
      `${env.OPENSKY_USERNAME}:${env.OPENSKY_PASSWORD}`
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  const res = await fetch(ENDPOINT, { headers });
  if (!res.ok) {
    throw new Error(`OpenSky HTTP ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as OpenSkyResponse;
  if (!body.states) return [];

  return body.states.map(parseState).filter((s) => s.icao24);
}

function parseState(v: RawStateVector): AircraftState {
  return {
    icao24: v[0],
    callsign: v[1] ? v[1].trim() || null : null,
    origin_country: v[2] ?? null,
    longitude: v[5],
    latitude: v[6],
    altitude_m: v[7] ?? v[13] ?? null,
    on_ground: v[8],
    velocity_ms: v[9],
    heading_deg: v[10],
    vertical_rate: v[11],
    squawk: v[14] ?? null,
    last_contact: new Date((v[4] ?? 0) * 1000).toISOString(),
  };
}
