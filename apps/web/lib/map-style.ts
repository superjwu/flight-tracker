import type { StyleSpecification } from "maplibre-gl";

/**
 * Custom dark vector-tile style using OpenFreeMap's Planet tiles.
 * No API key required. Good for production.
 *
 * To switch to a simpler raster fallback, replace with OSM tiles:
 *   sources: { osm: { type: "raster", tiles: [...openstreetmap], tileSize: 256 } }
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
