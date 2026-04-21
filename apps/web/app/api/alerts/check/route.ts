import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Rule = {
  id: string;
  user_id: string;
  name: string;
  callsign: string | null;
  region_view_id: string | null;
  condition: "enters_region" | "leaves_region" | "altitude_below" | "altitude_above";
  threshold: number | null;
  active: boolean;
  last_triggered: string | null;
};

type View = {
  id: string;
  min_lon: number; min_lat: number; max_lon: number; max_lat: number;
};

type State = {
  icao24: string;
  callsign: string | null;
  longitude: number | null;
  latitude: number | null;
  altitude_m: number | null;
  on_ground: boolean;
  updated_at: string;
};

// Evaluate all active alert rules against the current aircraft_states snapshot.
// Triggered by a Vercel cron (see vercel.json crons) and a manual "Check now"
// button on /alerts. Respects a 15-minute debounce per (rule, aircraft).
export async function GET() { return handle(); }
export async function POST() { return handle(); }

async function handle() {
  const sb = supabaseAdmin();

  const [{ data: rules }, { data: states }, { data: views }] = await Promise.all([
    sb.from("alert_rules").select("*").eq("active", true),
    sb.from("aircraft_states").select("icao24,callsign,longitude,latitude,altitude_m,on_ground,updated_at"),
    sb.from("saved_views").select("id,min_lon,min_lat,max_lon,max_lat"),
  ]);

  const rs = (rules ?? []) as Rule[];
  const ss = (states ?? []) as State[];
  const vs = (views ?? []) as View[];
  const viewsById = new Map(vs.map((v) => [v.id, v]));

  const DEBOUNCE_MS = 15 * 60 * 1000;
  const now = Date.now();

  // Recent events keyed by (rule_id, icao24) for de-dup.
  const since = new Date(now - DEBOUNCE_MS).toISOString();
  const { data: recentEvents } = await sb
    .from("alert_events")
    .select("rule_id,icao24,triggered_at")
    .gte("triggered_at", since);
  const recentKey = new Set(
    (recentEvents ?? []).map((e) => `${e.rule_id}|${e.icao24}`)
  );

  const newEvents: Array<{
    rule_id: string;
    user_id: string;
    icao24: string;
    callsign: string | null;
    details: Record<string, unknown>;
  }> = [];

  for (const r of rs) {
    // Filter candidate states by callsign if set.
    const candidates = r.callsign
      ? ss.filter((s) => (s.callsign ?? "").trim().toUpperCase() === r.callsign!.toUpperCase())
      : ss;

    for (const s of candidates) {
      if (s.latitude == null || s.longitude == null) continue;
      const key = `${r.id}|${s.icao24}`;
      if (recentKey.has(key)) continue;

      let triggered = false;
      let details: Record<string, unknown> | null = null;

      if (r.condition === "altitude_below") {
        if (r.threshold != null && !s.on_ground && (s.altitude_m ?? Infinity) < r.threshold) {
          triggered = true;
          details = { altitude_m: s.altitude_m, threshold: r.threshold };
        }
      } else if (r.condition === "altitude_above") {
        if (r.threshold != null && (s.altitude_m ?? -Infinity) > r.threshold) {
          triggered = true;
          details = { altitude_m: s.altitude_m, threshold: r.threshold };
        }
      } else if (r.condition === "enters_region" || r.condition === "leaves_region") {
        const v = r.region_view_id ? viewsById.get(r.region_view_id) : null;
        if (!v) continue;
        const inside =
          s.longitude >= v.min_lon &&
          s.longitude <= v.max_lon &&
          s.latitude >= v.min_lat &&
          s.latitude <= v.max_lat;
        if (r.condition === "enters_region" && inside) {
          triggered = true;
          details = { lat: s.latitude, lon: s.longitude, region: v.id };
        }
        if (r.condition === "leaves_region" && !inside) {
          triggered = true;
          details = { lat: s.latitude, lon: s.longitude, region: v.id };
        }
      }

      if (triggered && details) {
        newEvents.push({
          rule_id: r.id,
          user_id: r.user_id,
          icao24: s.icao24,
          callsign: s.callsign,
          details,
        });
      }
    }
  }

  if (newEvents.length > 0) {
    await sb.from("alert_events").insert(newEvents);
    // Update last_triggered per rule.
    const byRule = new Map<string, number>();
    for (const e of newEvents) byRule.set(e.rule_id, (byRule.get(e.rule_id) ?? 0) + 1);
    for (const rid of byRule.keys()) {
      await sb
        .from("alert_rules")
        .update({ last_triggered: new Date().toISOString() })
        .eq("id", rid);
    }
  }

  return NextResponse.json({
    rulesChecked: rs.length,
    statesScanned: ss.length,
    eventsCreated: newEvents.length,
  });
}
