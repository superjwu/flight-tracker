"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import type { AircraftState, Bbox } from "@flight-tracker/shared";
import { useSupabase } from "@/lib/supabase-browser";
import { MAP_STYLE_URL } from "@/lib/map-style";
import { useFavorites } from "@/lib/favorites-context";
import type { MapFilters } from "./MapShell";

type Props = {
  filters: MapFilters;
  initialBbox: Bbox;
  selectedIcao24: string | null;
  onSelect: (a: AircraftState) => void;
  onVisibleCountChange: (n: number) => void;
  onLastUpdateChange: (ts: number) => void;
  registerBboxGetter?: (fn: () => Bbox | null) => void;
};

const MIN_RELOAD_INTERVAL_MS = 1500;

export default function LiveMap({
  filters,
  initialBbox,
  selectedIcao24,
  onSelect,
  onVisibleCountChange,
  onLastUpdateChange,
  registerBboxGetter,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const statesRef = useRef<Map<string, AircraftState>>(new Map());
  const supabase = useSupabase();
  const { favoriteCallsigns, favoriteAirlines } = useFavorites();
  const [ready, setReady] = useState(false);
  const reloadBucketRef = useRef(0);

  // Keep a stable reference to latest filters and favorites so marker logic reads current values.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const favCallRef = useRef(favoriteCallsigns);
  favCallRef.current = favoriteCallsigns;
  const favAirRef = useRef(favoriteAirlines);
  favAirRef.current = favoriteAirlines;
  const selectedRef = useRef(selectedIcao24);
  selectedRef.current = selectedIcao24;

  const initialCenter = useMemo<[number, number]>(() => {
    const cx = (initialBbox.minLon + initialBbox.maxLon) / 2;
    const cy = (initialBbox.minLat + initialBbox.maxLat) / 2;
    return [cx, cy];
  }, [initialBbox]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: initialCenter,
      zoom: 2.6,
      attributionControl: { compact: true },
      maxZoom: 14,
      minZoom: 1.5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    map.on("load", () => setReady(true));

    if (registerBboxGetter) {
      registerBboxGetter(() => {
        const b = map.getBounds();
        return {
          minLon: b.getWest(),
          minLat: b.getSouth(),
          maxLon: b.getEast(),
          maxLat: b.getNorth(),
        };
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      statesRef.current.clear();
    };
    // only init once
  }, [initialCenter]);

  // Pan to region when filter changes (but don't re-create the map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [
        [initialBbox.minLon, initialBbox.minLat],
        [initialBbox.maxLon, initialBbox.maxLat],
      ],
      { padding: 40, duration: 600, maxZoom: 6 }
    );
  }, [initialBbox]);

  // Fetch + realtime subscription scoped to current viewport bbox.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const getViewportBbox = (): Bbox => {
      const b = map.getBounds();
      return {
        minLon: b.getWest(),
        minLat: b.getSouth(),
        maxLon: b.getEast(),
        maxLat: b.getNorth(),
      };
    };

    const loadSnapshot = async () => {
      const bbox = getViewportBbox();
      const { data, error } = await supabase
        .from("aircraft_states")
        .select("*")
        .gte("longitude", bbox.minLon)
        .lte("longitude", bbox.maxLon)
        .gte("latitude", bbox.minLat)
        .lte("latitude", bbox.maxLat)
        .limit(5000);
      if (error || cancelled) return;
      const next = new Map<string, AircraftState>();
      for (const row of data as AircraftState[]) next.set(row.icao24, row);
      statesRef.current = next;
      renderAll();
      onLastUpdateChange(Date.now());
    };

    const subscribe = () => {
      if (channel) supabase.removeChannel(channel);
      channel = supabase
        .channel(`aircraft-states-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "aircraft_states" },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const icao = (payload.old as AircraftState)?.icao24;
              if (icao) {
                statesRef.current.delete(icao);
                removeMarker(icao);
              }
              return;
            }
            const row = payload.new as AircraftState;
            if (!row || row.latitude == null || row.longitude == null) return;
            const bbox = getViewportBbox();
            const inView =
              row.longitude >= bbox.minLon &&
              row.longitude <= bbox.maxLon &&
              row.latitude >= bbox.minLat &&
              row.latitude <= bbox.maxLat;
            if (!inView) {
              statesRef.current.delete(row.icao24);
              removeMarker(row.icao24);
              return;
            }
            statesRef.current.set(row.icao24, row);
            upsertMarker(row);
            onLastUpdateChange(Date.now());
          }
        )
        .subscribe();
    };

    const onMoveEnd = () => {
      const now = Date.now();
      if (now - reloadBucketRef.current < MIN_RELOAD_INTERVAL_MS) return;
      reloadBucketRef.current = now;
      loadSnapshot();
    };

    loadSnapshot();
    subscribe();
    map.on("moveend", onMoveEnd);

    return () => {
      cancelled = true;
      map.off("moveend", onMoveEnd);
      if (channel) supabase.removeChannel(channel);
    };
  }, [ready, supabase, onLastUpdateChange]);

  // Re-render markers when filters or favorites change.
  useEffect(() => {
    if (!ready) return;
    renderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, favoriteCallsigns, favoriteAirlines, selectedIcao24, ready]);

  function matchesFilters(a: AircraftState): boolean {
    const f = filtersRef.current;
    if (f.favoritesOnly) {
      const cs = (a.callsign ?? "").toUpperCase();
      const prefix = cs.slice(0, 3);
      const hitCallsign = cs && favCallRef.current.has(cs);
      const hitAirline = prefix && favAirRef.current.has(prefix);
      if (!hitCallsign && !hitAirline) return false;
    }
    if (f.airlineFilter) {
      const prefix = (a.callsign ?? "").slice(0, 3).toUpperCase();
      if (prefix !== f.airlineFilter.toUpperCase()) return false;
    }
    return true;
  }

  function removeMarker(icao: string) {
    const m = markersRef.current.get(icao);
    if (m) {
      m.remove();
      markersRef.current.delete(icao);
    }
  }

  function upsertMarker(a: AircraftState) {
    const map = mapRef.current;
    if (!map) return;
    if (a.longitude == null || a.latitude == null) return;

    if (!matchesFilters(a)) {
      removeMarker(a.icao24);
      return;
    }

    const existing = markersRef.current.get(a.icao24);
    if (existing) {
      existing.setLngLat([a.longitude, a.latitude]);
      const el = existing.getElement();
      applyMarkerState(el, a);
      return;
    }

    const el = buildMarkerEl(a);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect(a);
    });
    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([a.longitude, a.latitude])
      .addTo(map);
    markersRef.current.set(a.icao24, marker);
  }

  function renderAll() {
    const map = mapRef.current;
    if (!map) return;
    // Update/remove existing
    for (const [icao, state] of statesRef.current) {
      upsertMarker(state);
    }
    // Remove markers whose state no longer exists
    for (const [icao, marker] of markersRef.current) {
      if (!statesRef.current.has(icao)) {
        marker.remove();
        markersRef.current.delete(icao);
      }
    }
    onVisibleCountChange(markersRef.current.size);
  }

  function applyMarkerState(el: HTMLElement, a: AircraftState) {
    const heading = a.heading_deg ?? 0;
    const svg = el.querySelector("svg");
    if (svg) (svg as SVGElement).style.transform = `rotate(${heading}deg)`;

    const color = altitudeColor(a);
    el.querySelector("path")?.setAttribute("fill", color);

    const cs = (a.callsign ?? "").toUpperCase();
    const prefix = cs.slice(0, 3);
    const isFav =
      (cs && favCallRef.current.has(cs)) ||
      (prefix && favAirRef.current.has(prefix));

    el.classList.toggle("favorited", !!isFav);
    el.classList.toggle("selected", selectedRef.current === a.icao24);
  }

  function buildMarkerEl(a: AircraftState): HTMLElement {
    const el = document.createElement("div");
    el.className = "plane-marker";
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" style="transform: rotate(0deg); transform-origin: center;">
        <path d="M12 2 L14 10 L22 12 L22 14 L14 14 L13 22 L11 22 L10 14 L2 14 L2 12 L10 10 Z"
              fill="#22d3ee" stroke="#05070b" stroke-width="0.8"/>
      </svg>
    `;
    applyMarkerState(el, a);
    return el;
  }

  return <div ref={containerRef} className="absolute inset-0" />;
}

function altitudeColor(a: AircraftState): string {
  if (a.on_ground) return "#6b7280"; // gray
  const alt = a.altitude_m ?? 0;
  if (alt < 2000) return "#34d399"; // green — low
  if (alt < 6000) return "#fbbf24"; // amber
  if (alt < 10000) return "#22d3ee"; // cyan
  return "#a78bfa"; // purple — very high
}
