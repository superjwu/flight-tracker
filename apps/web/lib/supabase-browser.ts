"use client";
import { useAuth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase browser client that uses the Clerk session token (JWT template "supabase")
 * so Row Level Security policies can read `auth.jwt() ->> 'sub'` as the Clerk user id.
 *
 * If the user is signed out, the client falls back to the anon key — which is fine
 * for the public aircraft_states / aircraft_positions tables.
 */
export function useSupabase(): SupabaseClient {
  const { getToken, isSignedIn } = useAuth();

  return useMemo(() => {
    return createClient(url, anonKey, {
      global: {
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);
          if (isSignedIn) {
            const token = await getToken({ template: "supabase" });
            if (token) headers.set("Authorization", `Bearer ${token}`);
          }
          return fetch(input, { ...init, headers });
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    // intentionally only depend on isSignedIn — getToken is stable per session
  }, [isSignedIn, getToken]);
}

/** Anonymous client — for contexts outside a React tree (e.g. rare server components). */
export function createAnonClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
