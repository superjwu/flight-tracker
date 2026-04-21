import type { AircraftState } from "@flight-tracker/shared";

/**
 * Source: airplanes.live community ADS-B feed.
 *
 * Free, no auth, no IP-block for hosting providers (unlike OpenSky which
 * blocks Railway-class egress). Keeps the same exported API name so the
 * worker + UI don't need to change.
 *
 * airplanes.live accepts a lat/lon center and a radius in nautical miles,
 * capped around ~2500 NM. Each request returns up to ~1000 aircraft. To
 * approximate OpenSky's /states/all we issue 3 overlapping region queries
 * and merge by icao24.
 */

const BASE = "https://api.airplanes.live/v2/point";

// Three centers whose 2500 NM disks together cover every inhabited landmass.
const REGIONS: Array<{ name: string; lat: number; lon: number; distNm: number }> = [
  { name: "americas",  lat:  40, lon:  -95, distNm: 2500 },
  { name: "eurafrica", lat:  30, lon:   20, distNm: 2500 },
  { name: "asia-oce",  lat:  10, lon:  120, distNm: 2500 },
];

type RawAircraft = {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;              // knots
  track?: number;           // degrees
  baro_rate?: number;       // ft/min
  lat?: number;
  lon?: number;
  squawk?: string;
  seen?: number;            // seconds ago
};

type ApResponse = { ac?: RawAircraft[] };

const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;
const FPM_TO_MPS = 0.00508;

export async function fetchOpenSkyStates(): Promise<AircraftState[]> {
  const perRegion = await Promise.allSettled(REGIONS.map(fetchRegion));

  const merged = new Map<string, AircraftState>();
  for (const r of perRegion) {
    if (r.status !== "fulfilled") continue;
    for (const a of r.value) merged.set(a.icao24, a);
  }

  // If all three requests failed, bubble up so the worker's retry/backoff kicks in.
  if (merged.size === 0 && perRegion.every((r) => r.status === "rejected")) {
    const first = perRegion[0] as PromiseRejectedResult;
    throw first.reason ?? new Error("all region fetches failed");
  }

  return Array.from(merged.values());
}

async function fetchRegion(region: { lat: number; lon: number; distNm: number }): Promise<AircraftState[]> {
  const url = `${BASE}/${region.lat}/${region.lon}/${region.distNm}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`airplanes.live HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as ApResponse;
  return (body.ac ?? [])
    .filter((a) => a.hex && typeof a.lat === "number" && typeof a.lon === "number")
    .map(parse);
}

function parse(a: RawAircraft): AircraftState {
  const onGround = a.alt_baro === "ground";
  const altFt = typeof a.alt_baro === "number" ? a.alt_baro : a.alt_geom ?? null;

  return {
    icao24: a.hex,
    callsign: a.flight ? a.flight.trim() || null : null,
    origin_country: null, // airplanes.live doesn't include country-of-registration
    longitude: a.lon ?? null,
    latitude: a.lat ?? null,
    altitude_m: altFt != null ? altFt * FT_TO_M : null,
    velocity_ms: a.gs != null ? a.gs * KT_TO_MS : null,
    heading_deg: a.track ?? null,
    vertical_rate: a.baro_rate != null ? a.baro_rate * FPM_TO_MPS : null,
    on_ground: onGround,
    squawk: a.squawk ?? null,
    last_contact: new Date(Date.now() - (a.seen ?? 0) * 1000).toISOString(),
  };
}
