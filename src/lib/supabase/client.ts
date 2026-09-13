/**
 * Supabase client (browser).
 * ------------------------------------------------------------------
 * Uses ONLY the public anon key + project URL (committed to .env). All
 * privileged work happens behind Row-Level Security or in edge functions.
 * The client is always constructed so the app renders even if a call fails;
 * data-access layers degrade gracefully to the local simulation when offline.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the public Supabase config is present in the bundle. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * A single shared client. If config is somehow missing we still return a client
 * pointed at a harmless placeholder so imports never throw — callers wrap every
 * request in try/catch and fall back to the in-browser simulation.
 */
export const supabase = createClient(
  url ?? "https://localhost.invalid",
  anonKey ?? "public-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "healthguard.supabase.auth",
    },
  },
);

export const FUNCTIONS_URL = url ? `${url}/functions/v1` : "";
