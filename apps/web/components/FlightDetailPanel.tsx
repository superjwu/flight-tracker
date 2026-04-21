"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import type { AircraftPosition, AircraftState } from "@flight-tracker/shared";
import { useSupabase } from "@/lib/supabase-browser";
import { useFavorites } from "@/lib/favorites-context";
import { lookupAirline } from "@/lib/airlines";

export default function FlightDetailPanel({
  aircraft,
  onClose,
}: {
  aircraft: AircraftState;
  onClose: () => void;
}) {
  const supabase = useSupabase();
  const { favoriteCallsigns, favoriteAirlines, toggleFlight, toggleAirline } = useFavorites();
  const [trail, setTrail] = useState<AircraftPosition[]>([]);
  const airline = lookupAirline(aircraft.callsign);
  const cs = (aircraft.callsign ?? "").toUpperCase();
  const prefix = cs.slice(0, 3);
  const isFavCallsign = favoriteCallsigns.has(cs);
  const isFavAirline = prefix ? favoriteAirlines.has(prefix) : false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("aircraft_positions")
        .select("icao24,longitude,latitude,altitude_m,observed_at")
        .eq("icao24", aircraft.icao24)
        .order("observed_at", { ascending: false })
        .limit(120);
      if (cancelled) return;
      setTrail((data ?? []).reverse() as AircraftPosition[]);
    })();
    return () => { cancelled = true; };
  }, [aircraft.icao24, supabase]);

  return (
    <aside className="absolute top-0 right-0 bottom-0 z-30 w-full max-w-sm border-l border-[--color-border] bg-[--color-panel]/95 backdrop-blur overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border]">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            Callsign
          </div>
          <div className="font-mono text-xl text-[--color-fg]">
            {aircraft.callsign || "—"}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 text-[--color-muted] hover:text-[--color-fg] hover:bg-[--color-panel-2]"
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-5">
        {airline && (
          <div>
            <div className="text-xs text-[--color-muted]">Airline</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[--color-fg]">{airline.name}</span>
              <span className="font-mono text-xs text-[--color-muted]">({airline.code})</span>
              {airline.country && (
                <span className="text-xs text-[--color-muted]">· {airline.country}</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Country" value={aircraft.origin_country || "—"} />
          <Stat label="ICAO24" value={aircraft.icao24} mono />
          <Stat label="Altitude" value={fmtAlt(aircraft.altitude_m)} />
          <Stat label="Speed" value={fmtSpeed(aircraft.velocity_ms)} />
          <Stat label="Heading" value={fmtHeading(aircraft.heading_deg)} />
          <Stat label="Vert rate" value={fmtVert(aircraft.vertical_rate)} />
          <Stat label="Squawk" value={aircraft.squawk || "—"} mono />
          <Stat label="Ground" value={aircraft.on_ground ? "Yes" : "No"} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Latitude" value={fmtCoord(aircraft.latitude)} mono />
          <Stat label="Longitude" value={fmtCoord(aircraft.longitude)} mono />
        </div>

        <SignedIn>
          <div className="flex flex-col gap-2 pt-3 border-t border-[--color-border]">
            {cs && (
              <button
                onClick={() => toggleFlight(cs)}
                className={`rounded-md px-3 py-2 text-sm transition border ${
                  isFavCallsign
                    ? "border-[--color-accent-amber] text-[--color-accent-amber] bg-amber-500/10"
                    : "border-[--color-border] hover:border-[--color-accent] hover:text-[--color-accent]"
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
                    ? "border-[--color-accent-amber] text-[--color-accent-amber] bg-amber-500/10"
                    : "border-[--color-border] hover:border-[--color-accent] hover:text-[--color-accent]"
                }`}
              >
                {isFavAirline ? `★ Following ${airline.name}` : `☆ Follow ${airline.name}`}
              </button>
            )}
          </div>
        </SignedIn>
        <SignedOut>
          <div className="pt-3 border-t border-[--color-border] text-sm text-[--color-muted]">
            <SignInButton mode="modal">
              <button className="text-[--color-accent] hover:underline">Sign in</button>
            </SignInButton>{" "}
            to favorite this flight or airline.
          </div>
        </SignedOut>

        <div className="pt-3 border-t border-[--color-border]">
          <div className="text-xs text-[--color-muted] mb-2">
            Recent trail · last {trail.length} positions
          </div>
          <TrailChart trail={trail} />
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[--color-muted]">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono" : ""} text-[--color-fg] text-sm`}>{value}</div>
    </div>
  );
}

function TrailChart({ trail }: { trail: AircraftPosition[] }) {
  if (trail.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-[--color-muted] border border-dashed border-[--color-border] rounded">
        no trail data yet
      </div>
    );
  }
  const alts = trail.map((p) => p.altitude_m ?? 0);
  const maxAlt = Math.max(...alts, 1);
  const w = 300, h = 80;
  const pts = alts
    .map((a, i) => {
      const x = (i / (alts.length - 1)) * w;
      const y = h - (a / maxAlt) * h;
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="rounded border border-[--color-border] bg-[--color-bg] p-2">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="80" preserveAspectRatio="none">
        <polyline
          points={pts}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-[--color-muted]">
        <span>{fmtAlt(0)}</span>
        <span>altitude over last {trail.length} samples</span>
        <span>{fmtAlt(maxAlt)}</span>
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
