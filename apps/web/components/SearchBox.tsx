"use client";
import { useEffect, useRef, useState } from "react";
import type { AircraftState } from "@flight-tracker/shared";
import { useSupabase } from "@/lib/supabase-browser";
import { lookupAirline } from "@/lib/airlines";

type Hit = Pick<
  AircraftState,
  "icao24" | "callsign" | "longitude" | "latitude" | "altitude_m" | "origin_country" | "on_ground"
>;

export default function SearchBox({
  onPick,
}: {
  onPick: (hit: Hit) => void;
}) {
  const supabase = useSupabase();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("aircraft_states")
        .select("icao24,callsign,longitude,latitude,altitude_m,origin_country,on_ground")
        .ilike("callsign", `${q}%`)
        .not("longitude", "is", null)
        .limit(20);
      if (cancelled) return;
      setHits((data ?? []) as Hit[]);
      setActiveIdx(0);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, supabase]);

  // Cmd/Ctrl-K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(hit: Hit) {
    onPick(hit);
    setOpen(false);
    setQuery("");
    setHits([]);
    inputRef.current?.blur();
  }

  return (
    <div className="relative w-72">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 backdrop-blur pl-3 pr-1 py-1.5 shadow-xl shadow-black/40 ring-1 ring-inset ring-white/5 focus-within:border-cyan-500/50 transition">
        <svg viewBox="0 0 24 24" className="size-4 text-slate-400 shrink-0">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[activeIdx]) {
              pick(hits[activeIdx]);
            }
          }}
          placeholder="Search callsign (UAL100, BAW...)"
          className="flex-1 bg-transparent text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none min-w-0"
          spellCheck={false}
          autoComplete="off"
        />
        <kbd className="hidden md:inline-flex items-center rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-white/5">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-white/10 bg-slate-950/98 backdrop-blur-md shadow-2xl shadow-black/60 ring-1 ring-inset ring-white/5 overflow-hidden z-30">
          {loading && hits.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-400">Searching…</div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-4 py-4 text-xs text-slate-400">
              No callsign starting with <span className="font-mono text-slate-300">{query.trim()}</span> is in the air right now.
            </div>
          )}
          {hits.map((h, i) => {
            const airline = lookupAirline(h.callsign);
            return (
              <button
                key={h.icao24}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                  i === activeIdx ? "bg-white/5" : "hover:bg-white/5"
                }`}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className={`shrink-0 size-2 rounded-full ${h.on_ground ? "bg-slate-500" : "bg-emerald-400"}`} />
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-medium text-white">
                      {h.callsign?.trim() || h.icao24}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {airline?.name ?? "Unknown operator"} · {h.origin_country ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-mono text-cyan-300">
                    {h.altitude_m != null ? `${Math.round(h.altitude_m * 3.28084).toLocaleString()} ft` : "—"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">
                    {h.on_ground ? "ground" : "airborne"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { Hit as SearchHit };
