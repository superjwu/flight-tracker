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

const API_ENDPOINT = "https://opensky-network.org/api/states/all";
const TOKEN_ENDPOINT =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

type CachedToken = { accessToken: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

async function getBearerToken(): Promise<string | null> {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) return null;

  // Re-use while valid, refresh 60s before expiry.
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.OPENSKY_CLIENT_ID,
    client_secret: env.OPENSKY_CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`OpenSky token ${res.status} ${res.statusText}`);
  }
  const payload = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

export async function fetchOpenSkyStates(): Promise<AircraftState[]> {
  const headers: Record<string, string> = { Accept: "application/json" };

  const bearer = await getBearerToken();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  } else if (env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD) {
    const basic = Buffer.from(
      `${env.OPENSKY_USERNAME}:${env.OPENSKY_PASSWORD}`
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  const res = await fetch(API_ENDPOINT, { headers });
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
