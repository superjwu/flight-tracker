"use client";
import { useAuth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase browser client using Clerk as a third-party auth provider.
 *
 * Supabase is configured (dashboard → Authentication → Third-Party Auth → Clerk)
 * to accept Clerk-issued JWTs verified against Clerk's JWKS endpoint — no shared
 * secret needed. The `accessToken` callback below hands Supabase a fresh Clerk
 * session token on every request; RLS policies read `auth.jwt() ->> 'sub'` to
 * resolve the Clerk user.
 *
 * Signed-out users still get the anon key (accessToken returns null), which is
 * fine for the publicly-readable aircraft_states / aircraft_positions tables.
 */
export function useSupabase(): SupabaseClient {
  const { getToken, isSignedIn } = useAuth();

  return useMemo(() => {
    return createClient(url, anonKey, {
      async accessToken() {
        if (!isSignedIn) return null;
        return (await getToken()) ?? null;
      },
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }, [isSignedIn, getToken]);
}

/** Anonymous client — for contexts outside a React tree (e.g. rare server components). */
export function createAnonClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
