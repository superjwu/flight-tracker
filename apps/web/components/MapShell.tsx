"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useRef, useState } from "react";
import type { AircraftState, Bbox, RegionKey } from "@flight-tracker/shared";
import { REGION_BBOXES } from "@flight-tracker/shared";
import FilterBar from "./FilterBar";
import FlightDetailPanel from "./FlightDetailPanel";
import SaveViewButton from "./SaveViewButton";
import SearchBox, { type SearchHit } from "./SearchBox";
import StatsBar from "./StatsBar";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false });

export type MapFilters = {
  region: RegionKey;
  airlineFilter: string;
  favoritesOnly: boolean;
};

export default function MapShell() {
  const [filters, setFilters] = useState<MapFilters>({
    region: "world",
    airlineFilter: "",
    favoritesOnly: false,
  });
  const [selected, setSelected] = useState<AircraftState | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const bboxGetterRef = useRef<(() => Bbox | null) | null>(null);
  const flyToRef = useRef<((lon: number, lat: number, zoom?: number) => void) | null>(null);

  function handleSearchPick(hit: SearchHit) {
    if (hit.longitude == null || hit.latitude == null) return;
    // Fly the map to this plane, then open its detail panel.
    flyToRef.current?.(hit.longitude, hit.latitude, 8);
    setSelected({
      icao24: hit.icao24,
      callsign: hit.callsign,
      origin_country: hit.origin_country,
      longitude: hit.longitude,
      latitude: hit.latitude,
      altitude_m: hit.altitude_m,
      velocity_ms: null,
      heading_deg: null,
      vertical_rate: null,
      on_ground: hit.on_ground,
      squawk: null,
      last_contact: new Date().toISOString(),
    });
  }

  const initialBbox = REGION_BBOXES[filters.region];

  return (
    <main className="fixed inset-0 bg-slate-950">
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 font-mono text-xs tracking-[0.15em] shadow-xl shadow-black/40 ring-1 ring-inset ring-white/5 transition hover:border-cyan-500/40"
          >
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-cyan-400 opacity-75 animate-ping" />
              <span className="relative size-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-white">FLIGHT_TRACKER</span>
          </Link>
          <SearchBox onPick={handleSearchPick} />
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/90 px-2 py-1.5 text-sm shadow-xl shadow-black/40 ring-1 ring-inset ring-white/5 pointer-events-auto">
          <SignedIn>
            <Link href="/favorites" className="rounded-full px-3 py-1 text-slate-300 hover:text-white hover:bg-white/5 transition">
              Favorites
            </Link>
            <Link href="/alerts" className="rounded-full px-3 py-1 text-slate-300 hover:text-white hover:bg-white/5 transition">
              Alerts
            </Link>
            <div className="ml-1 pl-1 border-l border-white/10">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full bg-cyan-500 text-black px-4 py-1.5 text-sm font-medium hover:bg-cyan-400 transition">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>
      </header>

      <FilterBar filters={filters} onChange={setFilters} />
      <StatsBar visibleCount={visibleCount} lastUpdate={lastUpdate} region={filters.region} />

      <div className="absolute inset-0 z-0">
        <LiveMap
          filters={filters}
          initialBbox={initialBbox}
          onSelect={setSelected}
          selectedIcao24={selected?.icao24 ?? null}
          onVisibleCountChange={setVisibleCount}
          onLastUpdateChange={setLastUpdate}
          registerBboxGetter={(fn) => { bboxGetterRef.current = fn; }}
          registerFlyTo={(fn) => { flyToRef.current = fn; }}
        />
      </div>

      <SaveViewButton getBbox={() => bboxGetterRef.current?.() ?? null} />

      {selected && (
        <FlightDetailPanel
          aircraft={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
