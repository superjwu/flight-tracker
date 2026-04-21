"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useSupabase } from "@/lib/supabase-browser";
import type { AlertCondition } from "@flight-tracker/shared";

type SavedView = { id: string; name: string };
type AlertRule = {
  id: string;
  name: string;
  callsign: string | null;
  region_view_id: string | null;
  condition: AlertCondition;
  threshold: number | null;
  active: boolean;
  last_triggered: string | null;
};
type AlertEvent = {
  id: number;
  rule_id: string;
  icao24: string | null;
  callsign: string | null;
  triggered_at: string;
  details: Record<string, unknown> | null;
};

export default function AlertsClient() {
  const supabase = useSupabase();
  const [views, setViews] = useState<SavedView[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [regionViewId, setRegionViewId] = useState<string>("");
  const [condition, setCondition] = useState<AlertCondition>("altitude_below");
  const [threshold, setThreshold] = useState<string>("3000");

  async function refresh() {
    const [vRes, rRes, eRes] = await Promise.all([
      supabase.from("saved_views").select("id,name").order("created_at", { ascending: false }),
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_events").select("*").order("triggered_at", { ascending: false }).limit(30),
    ]);
    setViews((vRes.data ?? []) as SavedView[]);
    setRules((rRes.data ?? []) as AlertRule[]);
    setEvents((eRes.data ?? []) as AlertEvent[]);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: me } = await supabase.from("users").select("id").limit(1).maybeSingle();
    if (!me) return;

    const row = {
      user_id: me.id,
      name: name.trim(),
      callsign: callsign.trim() ? callsign.trim().toUpperCase() : null,
      region_view_id: regionViewId || null,
      condition,
      threshold: condition.startsWith("altitude") ? Number(threshold) : null,
      active: true,
    };
    const { error } = await supabase.from("alert_rules").insert(row);
    if (error) {
      setMsg(`Error: ${error.message}`);
      return;
    }
    setName(""); setCallsign(""); setRegionViewId(""); setThreshold("3000");
    setMsg("Rule created.");
    refresh();
  }

  async function toggleActive(r: AlertRule) {
    await supabase.from("alert_rules").update({ active: !r.active }).eq("id", r.id);
    refresh();
  }
  async function deleteRule(r: AlertRule) {
    await supabase.from("alert_rules").delete().eq("id", r.id);
    refresh();
  }
  async function checkNow() {
    setChecking(true);
    setMsg(null);
    try {
      const res = await fetch("/api/alerts/check", { method: "POST" });
      const data = await res.json();
      setMsg(`Checked ${data.rulesChecked ?? 0} rules · ${data.eventsCreated ?? 0} new events`);
      refresh();
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-5 border-b border-[--color-border]">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm">
          <span className="inline-block size-2 rounded-full bg-[--color-accent] live-dot" />
          FLIGHT_TRACKER
        </Link>
        <nav className="flex items-center gap-5 text-sm text-[--color-muted]">
          <Link href="/map" className="hover:text-[--color-fg]">Live Map</Link>
          <Link href="/favorites" className="hover:text-[--color-fg]">Favorites</Link>
          <UserButton afterSignOutUrl="/" />
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-8 py-12 space-y-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Alerts</h1>
            <p className="mt-2 text-[--color-muted]">
              Rules evaluate against the latest aircraft snapshot. A Vercel cron runs every 5 min, or check manually.
            </p>
          </div>
          <button
            onClick={checkNow}
            disabled={checking}
            className="rounded bg-[--color-accent] text-black px-4 py-2 text-sm font-medium hover:bg-cyan-300 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>

        {msg && (
          <div className="text-sm rounded border border-[--color-border] bg-[--color-panel] px-3 py-2 text-[--color-muted]">
            {msg}
          </div>
        )}

        <section className="rounded-lg border border-[--color-border] bg-[--color-panel] p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            New rule
          </h2>
          <form onSubmit={createRule} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Rule name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Descending into SFO"
                className="w-full bg-[--color-panel-2] border border-[--color-border] rounded px-3 py-2 text-sm focus:outline-none focus:border-[--color-accent]"
                required
              />
            </Field>
            <Field label="Callsign (optional)">
              <input
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                placeholder="Any flight if empty"
                className="w-full bg-[--color-panel-2] border border-[--color-border] rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[--color-accent]"
              />
            </Field>
            <Field label="Condition">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AlertCondition)}
                className="w-full bg-[--color-panel-2] border border-[--color-border] rounded px-3 py-2 text-sm focus:outline-none focus:border-[--color-accent]"
              >
                <option value="enters_region">Enters region</option>
                <option value="leaves_region">Leaves region</option>
                <option value="altitude_below">Altitude below (meters)</option>
                <option value="altitude_above">Altitude above (meters)</option>
              </select>
            </Field>
            {condition.startsWith("altitude") ? (
              <Field label="Threshold (meters)">
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full bg-[--color-panel-2] border border-[--color-border] rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[--color-accent]"
                />
              </Field>
            ) : (
              <Field label="Region (saved view)">
                <select
                  value={regionViewId}
                  onChange={(e) => setRegionViewId(e.target.value)}
                  className="w-full bg-[--color-panel-2] border border-[--color-border] rounded px-3 py-2 text-sm focus:outline-none focus:border-[--color-accent]"
                >
                  <option value="">— select a saved view —</option>
                  {views.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded bg-[--color-accent] text-black px-5 py-2 text-sm font-medium hover:bg-cyan-300"
              >
                Create rule
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            Rules ({rules.length})
          </h2>
          <ul className="mt-4 divide-y divide-[--color-border] border border-[--color-border] rounded-md bg-[--color-panel]">
            {rules.length === 0 ? (
              <li className="px-4 py-6 text-sm text-[--color-muted]">No rules yet.</li>
            ) : (
              rules.map((r) => (
                <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${r.active ? "" : "text-[--color-muted] line-through"}`}>
                        {r.name}
                      </span>
                      {r.callsign && (
                        <span className="font-mono text-xs text-[--color-accent]">{r.callsign}</span>
                      )}
                    </div>
                    <div className="text-xs text-[--color-muted] mt-0.5">
                      {describeRule(r, views)}
                      {r.last_triggered && (
                        <span className="ml-2">· last triggered {new Date(r.last_triggered).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleActive(r)}
                      className="text-xs text-[--color-muted] hover:text-[--color-accent]"
                    >
                      {r.active ? "disable" : "enable"}
                    </button>
                    <button
                      onClick={() => deleteRule(r)}
                      className="text-xs text-[--color-muted] hover:text-[--color-accent-red]"
                    >
                      delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[--color-muted]">
            Recent events ({events.length})
          </h2>
          <ul className="mt-4 divide-y divide-[--color-border] border border-[--color-border] rounded-md bg-[--color-panel]">
            {events.length === 0 ? (
              <li className="px-4 py-6 text-sm text-[--color-muted]">No events yet.</li>
            ) : (
              events.map((e) => (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-mono">{e.callsign ?? e.icao24 ?? "—"}</div>
                    <div className="text-xs text-[--color-muted]">
                      {JSON.stringify(e.details)}
                    </div>
                  </div>
                  <div className="text-xs text-[--color-muted]">
                    {new Date(e.triggered_at).toLocaleString()}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[--color-muted]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function describeRule(r: AlertRule, views: SavedView[]): string {
  if (r.condition === "altitude_below") return `altitude below ${r.threshold}m`;
  if (r.condition === "altitude_above") return `altitude above ${r.threshold}m`;
  const v = views.find((x) => x.id === r.region_view_id);
  const region = v ? `"${v.name}"` : "(region)";
  return r.condition === "enters_region" ? `enters ${region}` : `leaves ${region}`;
}
