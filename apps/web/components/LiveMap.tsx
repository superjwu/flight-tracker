"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import type { AircraftState, Bbox } from "@flight-tracker/shared";
import { useSupabase } from "@/lib/supabase-browser";
import { buildStyle, type ThemeKey } from "@/lib/map-style";
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
  registerFlyTo?: (fn: (lon: number, lat: number, zoom?: number) => void) => void;
  theme?: ThemeKey;
};

const MIN_RELOAD_INTERVAL_MS = 1500;
const PROJECTION_TICK_MS = 500;
const PROJECTION_STALE_MS = 120_000;
const METERS_PER_DEG_LAT = 111_320;

type Anchor = {
  lon: number;
  lat: number;
  velocityMs: number;
  headingDeg: number;
  anchorMs: number;
  onGround: boolean;
};

export default function LiveMap({
  filters,
  initialBbox,
  selectedIcao24,
  onSelect,
  onVisibleCountChange,
  onLastUpdateChange,
  registerBboxGetter,
  registerFlyTo,
  theme = "light",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const statesRef = useRef<Map<string, AircraftState>>(new Map());
  const anchorsRef = useRef<Map<string, Anchor>>(new Map());
  const supabase = useSupabase();
  const { favoriteCallsigns, favoriteAirlines } = useFavorites();
  const [ready, setReady] = useState(false);
  const reloadBucketRef = useRef(0);
  const loadSnapshotRef = useRef<() => Promise<void>>(async () => {});

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
      style: buildStyle(theme),
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

    if (registerFlyTo) {
      registerFlyTo((lon, lat, zoom = 8) => {
        map.flyTo({ center: [lon, lat], zoom, duration: 1400, essential: true });
        // Trigger a re-fetch after fly completes so markers populate around the destination.
        setTimeout(() => {
          reloadBucketRef.current = Date.now();
          loadSnapshotRef.current();
        }, 1500);
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

  // Swap map style when the user picks a new theme. MapLibre preserves
  // camera + sources across setStyle, but DOM markers (our planes) are
  // unaffected since they live outside the GL layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(buildStyle(theme));
  }, [theme, ready]);

  // Pan to region when filter changes and force a re-fetch when pan completes
  // (moveend throttle could otherwise skip the reload and leave the map empty).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.fitBounds(
      [
        [initialBbox.minLon, initialBbox.minLat],
        [initialBbox.maxLon, initialBbox.maxLat],
      ],
      { padding: 40, duration: 700, maxZoom: 6 }
    );
    const t = setTimeout(() => {
      reloadBucketRef.current = Date.now();
      loadSnapshotRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [initialBbox, ready]);

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
      // RPC samples with order-by-random so world view doesn't collapse to NA
      // (default api row cap returns first 1000 by icao24 PK = US-registered).
      const { data, error } = await supabase.rpc("sample_aircraft_in_bbox", {
        p_min_lon: bbox.minLon,
        p_min_lat: bbox.minLat,
        p_max_lon: bbox.maxLon,
        p_max_lat: bbox.maxLat,
        p_limit: 2000,
      });
      if (error || cancelled) return;
      const next = new Map<string, AircraftState>();
      for (const row of (data ?? []) as AircraftState[]) {
        next.set(row.icao24, row);
        setAnchor(row);
      }
      statesRef.current = next;
      // Clear markers not in the new snapshot (pre-empt realtime removal race)
      for (const [icao, marker] of markersRef.current) {
        if (!next.has(icao)) {
          marker.remove();
          markersRef.current.delete(icao);
          anchorsRef.current.delete(icao);
        }
      }
      // Drop anchors for planes no longer in the snapshot (regardless of marker state).
      for (const icao of anchorsRef.current.keys()) {
        if (!next.has(icao)) anchorsRef.current.delete(icao);
      }
      renderAll();
      onLastUpdateChange(Date.now());
    };
    loadSnapshotRef.current = loadSnapshot;

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
            const known = statesRef.current.has(row.icao24);
            if (known) {
              // Already-rendered plane: always update position even if it has left
              // the viewport (let the next snapshot reconcile). Don't remove here —
              // that race caused region-switch to empty the map.
              statesRef.current.set(row.icao24, row);
              setAnchor(row);
              upsertMarker(row);
              onLastUpdateChange(Date.now());
              return;
            }
            if (inView) {
              // New plane just entered the viewport — add it so the map stays live
              // without requiring pan/zoom.
              statesRef.current.set(row.icao24, row);
              setAnchor(row);
              upsertMarker(row);
              onLastUpdateChange(Date.now());
            }
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

  // Dead-reckoning tick: project each marker forward from its last-known
  // anchor using velocity + heading, so planes glide smoothly between the
  // 10s realtime updates instead of snapping.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const [icao, anchor] of anchorsRef.current) {
        const marker = markersRef.current.get(icao);
        if (!marker) continue;
        const dtSec = (now - anchor.anchorMs) / 1000;
        if (
          anchor.onGround ||
          anchor.velocityMs <= 0 ||
          dtSec <= 0 ||
          dtSec > PROJECTION_STALE_MS / 1000
        ) {
          continue;
        }
        const hRad = (anchor.headingDeg * Math.PI) / 180;
        const distM = anchor.velocityMs * dtSec;
        const dLat = (distM * Math.cos(hRad)) / METERS_PER_DEG_LAT;
        const cosLat = Math.cos((anchor.lat * Math.PI) / 180);
        const dLon = cosLat > 1e-6
          ? (distM * Math.sin(hRad)) / (METERS_PER_DEG_LAT * cosLat)
          : 0;
        marker.setLngLat([anchor.lon + dLon, anchor.lat + dLat]);
      }
    }, PROJECTION_TICK_MS);
    return () => clearInterval(id);
  }, [ready]);

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
    anchorsRef.current.delete(icao);
  }

  function setAnchor(a: AircraftState) {
    if (a.longitude == null || a.latitude == null) return;
    anchorsRef.current.set(a.icao24, {
      lon: a.longitude,
      lat: a.latitude,
      velocityMs: a.velocity_ms ?? 0,
      headingDeg: a.heading_deg ?? 0,
      anchorMs: a.last_contact ? Date.parse(a.last_contact) : Date.now(),
      onGround: a.on_ground,
    });
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
      // Position is driven by the projection tick from the anchor we just set.
      // Snapping to the raw (seconds-stale) lon/lat here would cause a visible
      // backward jump each realtime update before the next tick re-projects.
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
    // Airplane silhouette (top-down view). Nose faces +Y (up), so heading=0 means north.
    el.innerHTML = `
      <svg viewBox="-12 -12 24 24" width="18" height="18" style="transform-origin: center;">
        <path d="M0 -10 L1.6 -2 L10 1 L10 3 L1.6 2 L1.2 8 L3 9.5 L3 11 L0 10 L-3 11 L-3 9.5 L-1.2 8 L-1.6 2 L-10 3 L-10 1 L-1.6 -2 Z"
              fill="#22d3ee" stroke="#0b1220" stroke-width="1" stroke-linejoin="round"/>
      </svg>
    `;
    applyMarkerState(el, a);
    return el;
  }

  // MapLibre rewrites the container's `position` to `relative` on init, which
  // clobbers `absolute inset-0`. Give explicit width/height so the relative
  // container still fills its absolute-positioned parent.
  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

function altitudeColor(a: AircraftState): string {
  if (a.on_ground) return "#6b7280"; // gray
  const alt = a.altitude_m ?? 0;
  if (alt < 2000) return "#34d399"; // green — low
  if (alt < 6000) return "#fbbf24"; // amber
  if (alt < 10000) return "#22d3ee"; // cyan
  return "#a78bfa"; // purple — very high
}
