export type AircraftState = {
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  longitude: number | null;
  latitude: number | null;
  altitude_m: number | null;
  velocity_ms: number | null;
  heading_deg: number | null;
  vertical_rate: number | null;
  on_ground: boolean;
  squawk: string | null;
  last_contact: string;
  updated_at?: string;
};

export type AircraftPosition = {
  icao24: string;
  longitude: number;
  latitude: number;
  altitude_m: number | null;
  observed_at: string;
};

export type Bbox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export const REGION_BBOXES = {
  world: { minLon: -180, minLat: -85, maxLon: 180, maxLat: 85 },
  north_america: { minLon: -168, minLat: 14, maxLon: -52, maxLat: 72 },
  europe: { minLon: -25, minLat: 34, maxLon: 45, maxLat: 72 },
  asia: { minLon: 40, minLat: -10, maxLon: 180, maxLat: 75 },
  south_america: { minLon: -82, minLat: -56, maxLon: -34, maxLat: 13 },
  africa: { minLon: -18, minLat: -35, maxLon: 52, maxLat: 38 },
  oceania: { minLon: 110, minLat: -48, maxLon: 180, maxLat: 0 },
} as const satisfies Record<string, Bbox>;

export type RegionKey = keyof typeof REGION_BBOXES;

export type AlertCondition =
  | "enters_region"
  | "leaves_region"
  | "altitude_below"
  | "altitude_above";
