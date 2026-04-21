"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useFavorites } from "@/lib/favorites-context";
import { useSupabase } from "@/lib/supabase-browser";
import { lookupAirline } from "@/lib/airlines";

type SavedView = {
  id: string;
  name: string;
  min_lon: number; min_lat: number; max_lon: number; max_lat: number;
};

export default function FavoritesClient() {
  const {
    favoriteCallsigns,
    favoriteAirlines,
    toggleFlight,
    toggleAirline,
  } = useFavorites();
  const supabase = useSupabase();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newFlight, setNewFlight] = useState("");
  const [newAirline, setNewAirline] = useState("");

  async function refreshViews() {
    const { data } = await supabase
      .from("saved_views")
      .select("id,name,min_lon,min_lat,max_lon,max_lat")
      .order("created_at", { ascending: false });
    setSavedViews((data ?? []) as SavedView[]);
  }

  useEffect(() => { refreshViews(); /* eslint-disable-next-line */ }, []);

  async function deleteView(id: string) {
    await supabase.from("saved_views").delete().eq("id", id);
    refreshViews();
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-5 border-b border-[--color-border]">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm">
          <span className="inline-block size-2 rounded-full bg-[--color-accent] live-dot" />
          FLIGHT_TRACKER
        </Link>
        <nav className="flex items-center gap-5 text-sm text-[--color-muted]">
          <Link href="/map" className="hover:text-[--color-fg]">Live Map</Link>
          <Link href="/alerts" className="hover:text-[--color-fg]">Alerts</Link>
          <UserButton afterSignOutUrl="/" />
        </nav>
      </header>

      <section className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-semibold">Favorites</h1>
          <p className="mt-2 text-[--color-muted]">
            Starred callsigns and airlines are highlighted on the map and can be used in alert rules.
          </p>
        </div>

        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
              Favorite flights ({favoriteCallsigns.size})
            </h2>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFlight.trim()) return;
              await toggleFlight(newFlight);
              setNewFlight("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={newFlight}
              onChange={(e) => setNewFlight(e.target.value.toUpperCase())}
              placeholder="Callsign (e.g. UAL100)"
              className="flex-1 bg-[--color-panel] border border-[--color-border] rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[--color-accent]"
            />
            <button
              type="submit"
              className="rounded bg-[--color-accent] text-black px-4 py-2 text-sm font-medium hover:bg-cyan-300"
            >
              Add
            </button>
          </form>
          <ul className="mt-4 divide-y divide-[--color-border] border border-[--color-border] rounded-md bg-[--color-panel]">
            {favoriteCallsigns.size === 0 ? (
              <li className="px-4 py-6 text-sm text-[--color-muted]">No favorites yet.</li>
            ) : (
              [...favoriteCallsigns].sort().map((cs) => (
                <li key={cs} className="flex items-center justify-between px-4 py-3">
                  <span className="font-mono">{cs}</span>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/map?focus=${cs}`}
                      className="text-xs text-[--color-accent] hover:underline"
                    >
                      view on map
                    </Link>
                    <button
                      onClick={() => toggleFlight(cs)}
                      className="text-xs text-[--color-muted] hover:text-[--color-accent-red]"
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            Favorite airlines ({favoriteAirlines.size})
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newAirline.trim()) return;
              await toggleAirline(newAirline);
              setNewAirline("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={newAirline}
              onChange={(e) => setNewAirline(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="ICAO prefix (e.g. UAL)"
              maxLength={3}
              className="flex-1 bg-[--color-panel] border border-[--color-border] rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[--color-accent]"
            />
            <button
              type="submit"
              className="rounded bg-[--color-accent] text-black px-4 py-2 text-sm font-medium hover:bg-cyan-300"
            >
              Add
            </button>
          </form>
          <ul className="mt-4 divide-y divide-[--color-border] border border-[--color-border] rounded-md bg-[--color-panel]">
            {favoriteAirlines.size === 0 ? (
              <li className="px-4 py-6 text-sm text-[--color-muted]">No favorites yet.</li>
            ) : (
              [...favoriteAirlines].sort().map((code) => {
                const info = lookupAirline(code + "0000");
                return (
                  <li key={code} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="font-mono">{code}</div>
                      <div className="text-xs text-[--color-muted]">{info?.name ?? "Unknown"}</div>
                    </div>
                    <button
                      onClick={() => toggleAirline(code)}
                      className="text-xs text-[--color-muted] hover:text-[--color-accent-red]"
                    >
                      remove
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            Saved region views ({savedViews.length})
          </h2>
          <p className="text-xs text-[--color-muted] mt-2">
            Save custom bounding boxes from the map (feature coming next to the map page).
            You can use these as region selectors for alert rules.
          </p>
          <ul className="mt-4 divide-y divide-[--color-border] border border-[--color-border] rounded-md bg-[--color-panel]">
            {savedViews.length === 0 ? (
              <li className="px-4 py-6 text-sm text-[--color-muted]">
                No saved views yet.
              </li>
            ) : (
              savedViews.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div>{v.name}</div>
                    <div className="text-xs text-[--color-muted] font-mono">
                      {v.min_lon.toFixed(1)},{v.min_lat.toFixed(1)} → {v.max_lon.toFixed(1)},{v.max_lat.toFixed(1)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteView(v.id)}
                    className="text-xs text-[--color-muted] hover:text-[--color-accent-red]"
                  >
                    delete
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </section>
    </main>
  );
}
