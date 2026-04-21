"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSupabase } from "./supabase-browser";

type FavoritesState = {
  favoriteCallsigns: Set<string>;
  favoriteAirlines: Set<string>;
  toggleFlight: (callsign: string) => Promise<void>;
  toggleAirline: (icaoPrefix: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const supabase = useSupabase();
  const [callsigns, setCallsigns] = useState<Set<string>>(new Set());
  const [airlines, setAirlines] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCallsigns(new Set());
      setAirlines(new Set());
      return;
    }
    const [{ data: flights }, { data: als }] = await Promise.all([
      supabase.from("favorite_flights").select("callsign"),
      supabase.from("favorite_airlines").select("icao_prefix"),
    ]);
    setCallsigns(new Set((flights ?? []).map((r) => (r.callsign as string).toUpperCase())));
    setAirlines(new Set((als ?? []).map((r) => (r.icao_prefix as string).toUpperCase())));
  }, [isSignedIn, supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleFlight = useCallback(
    async (callsign: string) => {
      if (!isSignedIn) return;
      const cs = callsign.trim().toUpperCase();
      if (!cs) return;
      const has = callsigns.has(cs);

      // Resolve the users.id for the current Clerk user.
      const { data: me } = await supabase.from("users").select("id").limit(1).maybeSingle();
      if (!me) return;

      setCallsigns((prev) => {
        const next = new Set(prev);
        if (has) next.delete(cs);
        else next.add(cs);
        return next;
      });

      if (has) {
        await supabase.from("favorite_flights").delete().eq("callsign", cs).eq("user_id", me.id);
      } else {
        await supabase.from("favorite_flights").insert({ user_id: me.id, callsign: cs });
      }
    },
    [isSignedIn, callsigns, supabase]
  );

  const toggleAirline = useCallback(
    async (icaoPrefix: string) => {
      if (!isSignedIn) return;
      const code = icaoPrefix.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return;
      const has = airlines.has(code);

      const { data: me } = await supabase.from("users").select("id").limit(1).maybeSingle();
      if (!me) return;

      setAirlines((prev) => {
        const next = new Set(prev);
        if (has) next.delete(code);
        else next.add(code);
        return next;
      });

      if (has) {
        await supabase.from("favorite_airlines").delete().eq("icao_prefix", code).eq("user_id", me.id);
      } else {
        await supabase.from("favorite_airlines").insert({ user_id: me.id, icao_prefix: code });
      }
    },
    [isSignedIn, airlines, supabase]
  );

  const value = useMemo<FavoritesState>(
    () => ({
      favoriteCallsigns: callsigns,
      favoriteAirlines: airlines,
      toggleFlight,
      toggleAirline,
      refresh,
    }),
    [callsigns, airlines, toggleFlight, toggleAirline, refresh]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    // Permissive fallback so LiveMap still renders for signed-out users.
    return {
      favoriteCallsigns: new Set(),
      favoriteAirlines: new Set(),
      toggleFlight: async () => {},
      toggleAirline: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
