import type { StyleSpecification } from "maplibre-gl";

export type ThemeKey = "dark" | "navy" | "light" | "satellite-ish";

type ThemeConfig = {
  bg: string;
  paint: Record<string, number>;
  label: string;
  hint: string;
};

const THEMES: Record<ThemeKey, ThemeConfig> = {
  dark: {
    label: "Dark",
    hint: "Muted charcoal",
    bg: "#05070c",
    paint: {
      "raster-opacity": 0.55,
      "raster-brightness-min": 0,
      "raster-brightness-max": 0.32,
      "raster-contrast": 0.1,
      "raster-saturation": -0.8,
      "raster-hue-rotate": 0,
    },
  },
  navy: {
    label: "Navy",
    hint: "Control-tower blue",
    bg: "#0a1324",
    paint: {
      "raster-opacity": 0.7,
      "raster-brightness-min": 0,
      "raster-brightness-max": 0.5,
      "raster-contrast": 0.25,
      "raster-saturation": -0.25,
      "raster-hue-rotate": 210,
    },
  },
  light: {
    label: "Light",
    hint: "Clean daytime",
    bg: "#e9edf3",
    paint: {
      "raster-opacity": 0.95,
      "raster-brightness-min": 0.3,
      "raster-brightness-max": 1,
      "raster-contrast": 0,
      "raster-saturation": -0.15,
      "raster-hue-rotate": 0,
    },
  },
  "satellite-ish": {
    label: "Midnight",
    hint: "Deep navy / teal water",
    bg: "#061022",
    paint: {
      "raster-opacity": 0.55,
      "raster-brightness-min": 0.02,
      "raster-brightness-max": 0.38,
      "raster-contrast": 0.35,
      "raster-saturation": 0.15,
      "raster-hue-rotate": 225,
    },
  },
};

export const THEME_LIST: Array<ThemeKey & {}> = Object.keys(THEMES) as ThemeKey[];
export const THEME_META = THEMES;

export function buildStyle(theme: ThemeKey): StyleSpecification {
  const cfg = THEMES[theme] ?? THEMES.navy;
  return {
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
      { id: "bg", type: "background", paint: { "background-color": cfg.bg } },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: cfg.paint as Record<string, number>,
      },
    ],
  };
}

// Backward-compat default export used by older imports.
export const MAP_STYLE = buildStyle("navy");
