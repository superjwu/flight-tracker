"use client";
import { useEffect, useState } from "react";
import type { RegionKey } from "@flight-tracker/shared";

export default function StatsBar({
  visibleCount,
  lastUpdate,
  region,
}: {
  visibleCount: number;
  lastUpdate: number | null;
  region: RegionKey;
}) {
  const [age, setAge] = useState<string>("—");

  useEffect(() => {
    if (!lastUpdate) return;
    const tick = () => {
      const s = Math.floor((Date.now() - lastUpdate) / 1000);
      setAge(s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  return (
    <div className="absolute bottom-6 left-6 z-10 flex items-stretch gap-px overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 ring-1 ring-inset ring-white/5">
      <Stat label="status" value={
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-emerald-400 live-dot" />
          <span className="text-emerald-300">LIVE</span>
        </span>
      } />
      <Stat label="aircraft" value={<span className="text-cyan-300">{visibleCount.toLocaleString()}</span>} />
      <Stat label="region" value={<span className="uppercase">{region.replace("_", " ")}</span>} />
      <Stat label="updated" value={<span className="text-slate-300">{age}</span>} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-slate-950 px-4 py-2.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <span className="font-mono text-sm font-medium text-white">{value}</span>
    </div>
  );
}
