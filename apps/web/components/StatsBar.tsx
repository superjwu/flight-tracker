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
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 rounded-md border border-[--color-border] bg-[--color-panel]/90 backdrop-blur px-4 py-2 shadow-lg font-mono text-xs">
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-[--color-accent-green] live-dot" />
        LIVE
      </span>
      <span className="text-[--color-muted]">·</span>
      <span>
        <span className="text-[--color-muted]">visible </span>
        <span className="text-[--color-accent]">{visibleCount.toLocaleString()}</span>
      </span>
      <span className="text-[--color-muted]">·</span>
      <span>
        <span className="text-[--color-muted]">region </span>
        <span className="uppercase">{region.replace("_", " ")}</span>
      </span>
      <span className="text-[--color-muted]">·</span>
      <span>
        <span className="text-[--color-muted]">updated </span>
        <span>{age}</span>
      </span>
    </div>
  );
}
