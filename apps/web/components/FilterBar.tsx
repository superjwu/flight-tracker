"use client";
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
  return (
    <div className="absolute top-16 left-4 z-10 flex flex-col gap-2 max-w-sm">
      <div className="rounded-md border border-[--color-border] bg-[--color-panel]/90 backdrop-blur p-3 shadow-lg">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-[--color-muted]">
          Region
        </label>
        <select
          value={filters.region}
          onChange={(e) =>
            onChange({ ...filters, region: e.target.value as RegionKey })
          }
          className="mt-1 w-full bg-[--color-panel-2] border border-[--color-border] rounded px-2 py-1.5 text-sm text-[--color-fg] focus:outline-none focus:border-[--color-accent]"
        >
          {REGIONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-[--color-border] bg-[--color-panel]/90 backdrop-blur p-3 shadow-lg">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-[--color-muted]">
          Airline (ICAO code)
        </label>
        <input
          type="text"
          placeholder="e.g. UAL, BAW, DLH"
          value={filters.airlineFilter}
          onChange={(e) =>
            onChange({ ...filters, airlineFilter: e.target.value.toUpperCase().slice(0, 3) })
          }
          className="mt-1 w-full bg-[--color-panel-2] border border-[--color-border] rounded px-2 py-1.5 text-sm font-mono text-[--color-fg] focus:outline-none focus:border-[--color-accent]"
          maxLength={3}
        />
      </div>

      <label className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-panel]/90 backdrop-blur px-3 py-2 shadow-lg cursor-pointer text-sm select-none">
        <input
          type="checkbox"
          checked={filters.favoritesOnly}
          onChange={(e) => onChange({ ...filters, favoritesOnly: e.target.checked })}
          className="accent-[--color-accent]"
        />
        <span>Show only favorites</span>
      </label>
    </div>
  );
}
