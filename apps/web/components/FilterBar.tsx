"use client";
import { useState } from "react";
import type { MapFilters } from "./MapShell";
import type { RegionKey } from "@flight-tracker/shared";

const REGIONS: { key: RegionKey; label: string }[] = [
  { key: "world", label: "World" },
  { key: "north_america", label: "N. America" },
  { key: "europe", label: "Europe" },
  { key: "asia", label: "Asia" },
  { key: "south_america", label: "S. America" },
  { key: "africa", label: "Africa" },
  { key: "oceania", label: "Oceania" },
];

export default function FilterBar({
  filters,
  onChange,
}: {
  filters: MapFilters;
  onChange: (f: MapFilters) => void;
}) {
  const [airlineOpen, setAirlineOpen] = useState(false);
  const activeFilters =
    (filters.airlineFilter ? 1 : 0) + (filters.favoritesOnly ? 1 : 0);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/95 px-2 py-2 shadow-2xl shadow-black/50 ring-1 ring-inset ring-white/5">
      {/* Region pill */}
      <div className="flex items-center gap-1 px-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
          Region
        </span>
        <div className="flex rounded-full bg-slate-900/80 p-0.5">
          {REGIONS.slice(0, 4).map((r) => (
            <button
              key={r.key}
              onClick={() => onChange({ ...filters, region: r.key })}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${
                filters.region === r.key
                  ? "bg-cyan-500 text-black shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
          <select
            value={REGIONS.slice(0, 4).some((r) => r.key === filters.region) ? "" : filters.region}
            onChange={(e) => e.target.value && onChange({ ...filters, region: e.target.value as RegionKey })}
            className={`appearance-none px-2 py-1 text-xs font-medium rounded-full transition cursor-pointer bg-transparent focus:outline-none ${
              !REGIONS.slice(0, 4).some((r) => r.key === filters.region)
                ? "bg-cyan-500 text-black"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <option value="" disabled hidden>
              More ▾
            </option>
            {REGIONS.slice(4).map((r) => (
              <option key={r.key} value={r.key} className="bg-slate-900 text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-5 w-px bg-white/10" />

      {/* Airline filter */}
      <div className="relative flex items-center">
        {!airlineOpen && !filters.airlineFilter ? (
          <button
            onClick={() => setAirlineOpen(true)}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-full hover:bg-white/5 transition"
          >
            + Airline
          </button>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-slate-900/80 pl-3 pr-1 py-0.5">
            <input
              autoFocus={airlineOpen}
              type="text"
              placeholder="ICAO"
              value={filters.airlineFilter}
              onChange={(e) =>
                onChange({
                  ...filters,
                  airlineFilter: e.target.value.toUpperCase().slice(0, 3),
                })
              }
              onBlur={() => !filters.airlineFilter && setAirlineOpen(false)}
              className="w-14 bg-transparent text-xs font-mono text-cyan-400 placeholder:text-slate-500 focus:outline-none"
              maxLength={3}
            />
            {filters.airlineFilter && (
              <button
                onClick={() => {
                  onChange({ ...filters, airlineFilter: "" });
                  setAirlineOpen(false);
                }}
                className="size-5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-white/10" />

      {/* Favorites toggle */}
      <button
        onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition ${
          filters.favoritesOnly
            ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
            : "text-slate-300 hover:text-white hover:bg-white/5"
        }`}
      >
        <span className="text-sm leading-none">{filters.favoritesOnly ? "★" : "☆"}</span>
        <span>Favorites</span>
      </button>

      {activeFilters > 0 && (
        <button
          onClick={() =>
            onChange({ region: filters.region, airlineFilter: "", favoritesOnly: false })
          }
          className="ml-1 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-white transition"
          title="Clear filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}
