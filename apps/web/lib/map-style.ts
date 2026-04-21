import type { StyleSpecification } from "maplibre-gl";

/**
 * Custom dark basemap: OpenStreetMap raster tiles darkened and desaturated
 * via MapLibre paint properties. No API key, globally reachable, navy/black
 * land with teal water and readable labels.
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a1324" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-opacity": 0.7,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.5,
        "raster-contrast": 0.25,
        "raster-saturation": -0.25,
        "raster-hue-rotate": 210,
      },
    },
  ],
};
