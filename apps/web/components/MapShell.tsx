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

  const initialBbox = REGION_BBOXES[filters.region];

  return (
    <main className="fixed inset-0 bg-[--color-bg]">
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm tracking-tight">
            <span className="inline-block size-2 rounded-full bg-[--color-accent] live-dot" />
            <span>FLIGHT_TRACKER</span>
          </Link>
        </div>
        <nav className="flex items-center gap-4 text-sm text-[--color-muted] pointer-events-auto">
          <SignedIn>
            <Link href="/favorites" className="hover:text-[--color-fg]">Favorites</Link>
            <Link href="/alerts" className="hover:text-[--color-fg]">Alerts</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-md border border-[--color-border] bg-[--color-panel]/80 backdrop-blur px-3 py-1.5 text-[--color-fg] hover:border-[--color-accent] hover:text-[--color-accent] transition">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>
      </header>

      <FilterBar filters={filters} onChange={setFilters} />
      <StatsBar visibleCount={visibleCount} lastUpdate={lastUpdate} region={filters.region} />

      <LiveMap
        filters={filters}
        initialBbox={initialBbox}
        onSelect={setSelected}
        selectedIcao24={selected?.icao24 ?? null}
        onVisibleCountChange={setVisibleCount}
        onLastUpdateChange={setLastUpdate}
        registerBboxGetter={(fn) => { bboxGetterRef.current = fn; }}
      />

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
