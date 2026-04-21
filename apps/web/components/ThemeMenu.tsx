"use client";
import { useEffect, useRef, useState } from "react";
import { THEME_META, type ThemeKey } from "@/lib/map-style";

const ORDER: ThemeKey[] = ["navy", "dark", "satellite-ish", "light"];

export default function ThemeMenu({
  theme,
  onChange,
}: {
  theme: ThemeKey;
  onChange: (t: ThemeKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="absolute bottom-6 right-20 z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/95 backdrop-blur px-3 py-2 text-xs font-mono shadow-xl shadow-black/40 ring-1 ring-inset ring-white/5 hover:border-cyan-500/40 transition"
        aria-label="Change map theme"
      >
        <svg viewBox="0 0 24 24" className="size-3.5 text-slate-300">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.4-.15-.76-.4-1.04-.24-.27-.39-.63-.39-1.03 0-.82.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
          />
        </svg>
        <span className="text-slate-200">Theme</span>
        <span className="text-slate-500">· {THEME_META[theme]?.label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-52 rounded-lg border border-white/10 bg-slate-950/98 backdrop-blur-md shadow-2xl shadow-black/60 ring-1 ring-inset ring-white/5 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
            Map theme
          </div>
          {ORDER.map((key) => {
            const meta = THEME_META[key];
            const active = key === theme;
            return (
              <button
                key={key}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                  active ? "bg-cyan-500/10" : "hover:bg-white/5"
                }`}
              >
                <span
                  className="size-5 rounded border border-white/10 shrink-0"
                  style={{ background: swatchGradient(key) }}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${active ? "text-cyan-300" : "text-white"}`}>
                    {meta.label}
                  </div>
                  <div className="text-[11px] text-slate-500">{meta.hint}</div>
                </div>
                {active && (
                  <svg viewBox="0 0 24 24" className="size-3.5 text-cyan-400">
                    <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5 9-11" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function swatchGradient(t: ThemeKey): string {
  switch (t) {
    case "dark":
      return "linear-gradient(135deg, #0f1117 0%, #1b1f28 100%)";
    case "navy":
      return "linear-gradient(135deg, #0a1324 0%, #1a3a6b 100%)";
    case "light":
      return "linear-gradient(135deg, #e9edf3 0%, #b8c4d6 100%)";
    case "satellite-ish":
      return "linear-gradient(135deg, #061022 0%, #164e63 100%)";
  }
}
