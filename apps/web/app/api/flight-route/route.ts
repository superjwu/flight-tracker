import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache for 1h — routes are scheduled, rarely change within a day.
const CACHE_TTL_MS = 60 * 60 * 1000;

type CachedRoute = {
  icao24: string;
  callsign: string | null;
  dep_airport: string | null;
  arr_airport: string | null;
  dep_info: ReturnType<typeof toAirportInfo> | null;
  arr_info: ReturnType<typeof toAirportInfo> | null;
  airline_name: string | null;
  dep_time: string | null;
  arr_time: string | null;
  fetched_at: string;
};

type AdsbdbAirport = {
  iata_code: string;
  icao_code: string;
  name: string;
  municipality: string;
  country_name: string;
  country_iso_name: string;
  latitude: number;
  longitude: number;
};
type AdsbdbResponse = {
  response:
    | "unknown callsign"
    | {
        flightroute: {
          callsign: string;
          callsign_icao: string;
          callsign_iata: string;
          airline?: { name: string; icao: string; iata: string; country: string };
          origin: AdsbdbAirport;
          destination: AdsbdbAirport;
        };
      };
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const icao24 = url.searchParams.get("icao24")?.trim().toLowerCase() ?? null;
  const callsign =
    url.searchParams.get("callsign")?.trim().toUpperCase().replace(/\s+/g, "") ?? null;
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lon = parseFloat(url.searchParams.get("lon") ?? "");
  const pos = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;

  if (!callsign) {
    return NextResponse.json({ error: "callsign required" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Cache check keyed by icao24 when available, else by callsign itself.
  const cacheKey = icao24 && /^[0-9a-f]{6}$/.test(icao24) ? icao24 : `cs:${callsign}`;

  const { data: cached } = await sb
    .from("flight_routes")
    .select("*")
    .eq("icao24", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json(formatCached(cached as CachedRoute, false, pos));
    }
  }

  // Hit adsbdb.com — free, no auth, routes keyed by callsign.
  const upstream = `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`;
  let body: AdsbdbResponse | null = null;
  try {
    const r = await fetch(upstream, { headers: { Accept: "application/json" } });
    if (r.ok) body = (await r.json()) as AdsbdbResponse;
  } catch {
    if (cached) return NextResponse.json(formatCached(cached as CachedRoute, true, pos));
  }

  if (!body || body.response === "unknown callsign" || typeof body.response === "string") {
    // Persist a negative cache so we don't hammer adsbdb for callsigns it doesn't know.
    await sb
      .from("flight_routes")
      .upsert(
        {
          icao24: cacheKey,
          callsign,
          dep_airport: null,
          arr_airport: null,
          dep_time: null,
          arr_time: null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "icao24" }
      );
    return NextResponse.json({
      icao24,
      callsign,
      dep: null,
      arr: null,
      depInfo: null,
      arrInfo: null,
      stale: false,
      known: false,
    });
  }

  const fr = body.response.flightroute;
  const depInfo = toAirportInfo(fr.origin);
  const arrInfo = toAirportInfo(fr.destination);
  const matches = pos ? positionMatchesRoute(pos, depInfo, arrInfo) : null;
  const row = {
    icao24: cacheKey,
    callsign: fr.callsign,
    dep_airport: fr.origin.icao_code,
    arr_airport: fr.destination.icao_code,
    dep_info: depInfo,
    arr_info: arrInfo,
    airline_name: fr.airline?.name ?? null,
    dep_time: null,
    arr_time: null,
    fetched_at: new Date().toISOString(),
  };
  await sb.from("flight_routes").upsert(row, { onConflict: "icao24" });

  return NextResponse.json({
    icao24,
    callsign: fr.callsign,
    dep: fr.origin.icao_code,
    arr: fr.destination.icao_code,
    depInfo,
    arrInfo,
    airline: fr.airline?.name ?? null,
    stale: false,
    known: true,
    matchesCurrentPosition: matches,
  });
}

/** Great-circle distance in km between two lat/lon points. */
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sanity-check whether the plane is on the scheduled route by measuring the
 * path-length detour: if the sum of (dep→plane + plane→arr) is more than
 * 20 % longer than the direct dep→arr great-circle distance, the plane is
 * materially off-path and is probably flying a different leg today.
 */
function positionMatchesRoute(
  pos: { lat: number; lon: number },
  dep: { lat: number; lon: number },
  arr: { lat: number; lon: number }
): boolean {
  const direct = haversineKm(dep, arr);
  if (direct < 100) return true; // too short to judge
  const detour = haversineKm(dep, pos) + haversineKm(pos, arr);
  return detour <= direct * 1.2;
}

function toAirportInfo(a: AdsbdbAirport) {
  return {
    iata: a.iata_code,
    icao: a.icao_code,
    name: a.name,
    city: a.municipality,
    country: a.country_name,
    lat: a.latitude,
    lon: a.longitude,
  };
}

function formatCached(
  r: CachedRoute,
  stale = false,
  pos: { lat: number; lon: number } | null = null
) {
  const matches =
    pos && r.dep_info && r.arr_info
      ? positionMatchesRoute(
          pos,
          { lat: r.dep_info.lat, lon: r.dep_info.lon },
          { lat: r.arr_info.lat, lon: r.arr_info.lon }
        )
      : null;
  return {
    icao24: r.icao24,
    callsign: r.callsign,
    dep: r.dep_airport,
    arr: r.arr_airport,
    depInfo: r.dep_info ?? null,
    arrInfo: r.arr_info ?? null,
    airline: r.airline_name ?? null,
    stale,
    known: !!(r.dep_airport || r.arr_airport),
    matchesCurrentPosition: matches,
  };
}
