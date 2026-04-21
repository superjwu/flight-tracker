"use client";
import { useState } from "react";
import { SignedIn } from "@clerk/nextjs";
import { useSupabase } from "@/lib/supabase-browser";

export default function SaveViewButton({
  getBbox,
}: {
  getBbox: () => { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
}) {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bbox = getBbox();
    if (!bbox || !name.trim()) return;
    const { data: me } = await supabase.from("users").select("id").limit(1).maybeSingle();
    if (!me) { setStatus("Not signed in"); return; }
    const { error } = await supabase.from("saved_views").insert({
      user_id: me.id,
      name: name.trim(),
      min_lon: bbox.minLon, min_lat: bbox.minLat,
      max_lon: bbox.maxLon, max_lat: bbox.maxLat,
    });
    if (error) { setStatus(`Error: ${error.message}`); return; }
    setStatus("Saved.");
    setName("");
    setTimeout(() => { setOpen(false); setStatus(null); }, 800);
  }

  return (
    <SignedIn>
      <div className="absolute bottom-4 right-20 z-10">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md border border-[--color-border] bg-[--color-panel]/90 backdrop-blur px-3 py-2 text-xs font-mono hover:border-[--color-accent] hover:text-[--color-accent]"
          >
            ＋ Save view
          </button>
        ) : (
          <form
            onSubmit={save}
            className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-panel]/95 backdrop-blur p-2"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="View name"
              className="bg-[--color-panel-2] border border-[--color-border] rounded px-2 py-1 text-xs focus:outline-none focus:border-[--color-accent] w-40"
            />
            <button
              type="submit"
              className="rounded bg-[--color-accent] text-black px-2 py-1 text-xs font-medium hover:bg-cyan-300"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setStatus(null); }}
              className="text-xs text-[--color-muted] hover:text-[--color-fg] px-1"
            >
              ✕
            </button>
            {status && <span className="text-xs text-[--color-muted]">{status}</span>}
          </form>
        )}
      </div>
    </SignedIn>
  );
}
