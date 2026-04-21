"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import type { AircraftState } from "@flight-tracker/shared";
import { useSupabase } from "@/lib/supabase-browser";
import { useFavorites } from "@/lib/favorites-context";
import { lookupAirline } from "@/lib/airlines";
import { lookupAirport } from "@/lib/airports";

type AirportInfo = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};
type RouteInfo = {
  icao24: string | null;
  callsign: string | null;
  dep: string | null;
  arr: string | null;
  depInfo: AirportInfo | null;
  arrInfo: AirportInfo | null;
  airline?: string | null;
  stale: boolean;
  known: boolean;
};

export default function FlightDetailPanel({
  aircraft,
  onClose,
}: {
  aircraft: AircraftState;
  onClose: () => void;
}) {
  const supabase = useSupabase();
  const { favoriteCallsigns, favoriteAirlines, toggleFlight, toggleAirline } = useFavorites();

  // Live state is refreshed from aircraft_states every 10s (worker poll cadence).
  const [liveAircraft, setLiveAircraft] = useState<AircraftState>(aircraft);
  const [firstSeenAt] = useState<number>(() => Date.now());
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);

  const airline = lookupAirline(liveAircraft.callsign);
  const cs = (liveAircraft.callsign ?? "").toUpperCase();
  const prefix = cs.slice(0, 3);
  const isFavCallsign = favoriteCallsigns.has(cs);
  const isFavAirline = prefix ? favoriteAirlines.has(prefix) : false;

  // Prefer the rich airport info from adsbdb; fall back to our static lookup.
  const depInfo = route?.depInfo ?? (route?.dep ? lookupAirport(route.dep) : null);
  const arrInfo = route?.arrInfo ?? (route?.arr ? lookupAirport(route.arr) : null);

  // "Tracked" = seconds since the panel opened (real-time counter, no trail storage).
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const trackedMs = now - firstSeenAt;

  // Reset when a new aircraft is selected.
  useEffect(() => {
    setLiveAircraft(aircraft);
  }, [aircraft.icao24]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Live stats update two ways:
  //   1) Immediate hydrate from aircraft_states on open.
  //   2) Subscribe to realtime UPDATE events for this specific icao24 — stats
  //      refresh the moment the worker writes new data (no polling delay).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("aircraft_states")
        .select("*")
        .eq("icao24", aircraft.icao24)
        .maybeSingle();
      if (!cancelled && data) setLiveAircraft(data as AircraftState);
    })();

    const channel = supabase
      .channel(`aircraft-detail-${aircraft.icao24}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "aircraft_states",
          filter: `icao24=eq.${aircraft.icao24}`,
        },
        (payload) => {
          const row = payload.new as AircraftState;
          if (row && row.icao24 === aircraft.icao24) setLiveAircraft(row);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [aircraft.icao24, supabase]);

  // Fetch origin/destination from our API (proxies adsbdb.com, keyed by callsign).
  useEffect(() => {
    const callsign = (aircraft.callsign ?? "").trim();
    if (!callsign) {
      setRoute(null);
      setRouteLoading(false);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    setRoute(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ callsign, icao24: aircraft.icao24 });
        const res = await fetch(`/api/flight-route?${qs}`);
        if (cancelled) return;
        if (res.ok) setRoute(await res.json());
      } catch {}
      if (!cancelled) setRouteLoading(false);
    })();
    return () => { cancelled = true; };
  }, [aircraft.icao24, aircraft.callsign]);

  return (
    <aside className="absolute top-0 right-0 bottom-0 z-30 w-full max-w-[380px] border-l border-white/10 bg-slate-950/98 backdrop-blur-md overflow-y-auto shadow-2xl shadow-black/60">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
            Callsign
          </div>
          <div className="font-mono text-xl font-semibold tracking-wide text-white truncate">
            {liveAircraft.callsign || "—"}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Route */}
        <RouteBlock route={route} loading={routeLoading} dep={depInfo} arr={arrInfo} />

        {/* Airline */}
        {airline && (
          <div className="rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">
              Operator
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{airline.name}</span>
              <span className="font-mono text-xs text-cyan-400">{airline.code}</span>
              {airline.country && (
                <span className="text-xs text-slate-400">· {airline.country}</span>
              )}
            </div>
          </div>
        )}

        {/* Live stats */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
              Live telemetry
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="inline-block size-1 rounded-full bg-emerald-400 live-dot" />
              <span>streaming</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Altitude" value={fmtAlt(liveAircraft.altitude_m)} highlight />
            <Stat label="Speed" value={fmtSpeed(liveAircraft.velocity_ms)} highlight />
            <Stat label="Heading" value={fmtHeading(liveAircraft.heading_deg)} />
            <Stat label="Vert rate" value={fmtVert(liveAircraft.vertical_rate)} />
            <Stat label="Tracked" value={fmtDuration(trackedMs)} />
            <Stat label="Status" value={liveAircraft.on_ground ? "On ground" : "Airborne"} />
            <Stat label="Country" value={liveAircraft.origin_country || "—"} />
            <Stat label="Squawk" value={liveAircraft.squawk || "—"} mono />
            <Stat label="ICAO24" value={liveAircraft.icao24} mono />
            <Stat label="Last seen" value={fmtLastContact(liveAircraft.last_contact)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="Latitude" value={fmtCoord(liveAircraft.latitude)} mono />
            <Stat label="Longitude" value={fmtCoord(liveAircraft.longitude)} mono />
          </div>
        </div>

        {/* Favorites */}
        <SignedIn>
          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
            {cs && (
              <button
                onClick={() => toggleFlight(cs)}
                className={`rounded-md px-3 py-2 text-sm transition border ${
                  isFavCallsign
                    ? "border-amber-500/60 text-amber-300 bg-amber-500/10"
                    : "border-white/10 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                }`}
              >
                {isFavCallsign ? "★ Favorited" : "☆ Favorite this flight"}
              </button>
            )}
            {prefix && airline && (
              <button
                onClick={() => toggleAirline(prefix)}
                className={`rounded-md px-3 py-2 text-sm transition border ${
                  isFavAirline
                    ? "border-amber-500/60 text-amber-300 bg-amber-500/10"
                    : "border-white/10 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                }`}
              >
                {isFavAirline ? `★ Following ${airline.name}` : `☆ Follow ${airline.name}`}
              </button>
            )}
          </div>
        </SignedIn>
        <SignedOut>
          <div className="pt-3 border-t border-white/10 text-sm text-slate-400">
            <SignInButton mode="modal">
              <button className="text-cyan-400 hover:underline">Sign in</button>
            </SignInButton>{" "}
            to favorite this flight or airline.
          </div>
        </SignedOut>

      </div>
    </aside>
  );
}

type AnyAirportInfo =
  | AirportInfo
  | { name: string; city: string; iata?: string; icao?: string; country?: string };

function RouteBlock({
  route,
  loading,
  dep,
  arr,
}: {
  route: RouteInfo | null;
  loading: boolean;
  dep: AnyAirportInfo | null;
  arr: AnyAirportInfo | null;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/60 p-4 animate-pulse">
        <div className="h-3 w-20 bg-slate-800 rounded mb-3" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-slate-800 rounded" />
          <div className="h-px flex-1 bg-slate-800" />
          <div className="h-10 w-24 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  const hasRoute = route && (route.dep || route.arr);
  if (!hasRoute) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-1">
          Route
        </div>
        <div className="text-sm text-slate-400">
          Route unknown for this callsign.
        </div>
      </div>
    );
  }

  const depCode = (dep && "iata" in dep && dep.iata) || route!.dep || "—";
  const arrCode = (arr && "iata" in arr && arr.iata) || route!.arr || "—";

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-900/80 p-4 shadow-inner shadow-cyan-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300/90">
          Route
        </div>
        {route?.stale && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/80">
            cached
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-3">
        <RouteEndpoint label="From" iata={String(depCode)} icao={route!.dep ?? "—"} city={dep?.city} country={(dep as AirportInfo)?.country} />
        <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[60px]">
          <div className="h-px w-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/70 to-cyan-500/0 relative">
            <svg viewBox="0 0 24 24" className="absolute -top-2.5 left-1/2 -translate-x-1/2 size-5 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]">
              <path fill="currentColor" d="M2 12 L11 9 L14 2 L16 2 L14 10 L22 12 L14 14 L16 22 L14 22 L11 15 L2 12 Z" />
            </svg>
          </div>
        </div>
        <RouteEndpoint label="To" iata={String(arrCode)} icao={route!.arr ?? "—"} city={arr?.city} country={(arr as AirportInfo)?.country} align="right" />
      </div>

      {(dep?.name || arr?.name) && (
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-3 text-[11px]">
          <div className="text-slate-400 truncate" title={dep?.name}>{dep?.name ?? "—"}</div>
          <div className="text-slate-400 truncate text-right" title={arr?.name}>{arr?.name ?? "—"}</div>
        </div>
      )}
    </div>
  );
}

function RouteEndpoint({
  label,
  iata,
  icao,
  city,
  country,
  align = "left",
}: {
  label: string;
  iata: string;
  icao: string;
  city: string | undefined;
  country?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start"} gap-0.5 min-w-0 flex-1`}>
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="font-mono text-3xl font-bold text-white leading-none tracking-tight">{iata}</div>
      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{icao}</div>
      {city && <div className="text-xs text-slate-200 mt-1 font-medium truncate max-w-[140px]">{city}</div>}
      {country && <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{country}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-900/60 border border-white/5 px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono" : ""} ${highlight ? "text-cyan-300 font-medium" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}


function fmtAlt(m: number | null): string {
  if (m == null) return "—";
  const ft = Math.round(m * 3.28084);
  return `${ft.toLocaleString()} ft`;
}
function fmtSpeed(ms: number | null): string {
  if (ms == null) return "—";
  const kts = Math.round(ms * 1.94384);
  return `${kts} kts`;
}
function fmtHeading(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const dir = dirs[Math.round(deg / 45) % 8];
  return `${Math.round(deg)}° ${dir}`;
}
function fmtVert(v: number | null): string {
  if (v == null) return "—";
  const fpm = Math.round(v * 196.85);
  return `${fpm > 0 ? "+" : ""}${fpm} fpm`;
}
function fmtCoord(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(4);
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtLastContact(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
