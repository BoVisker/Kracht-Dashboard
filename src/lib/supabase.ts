import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Null when Supabase isn't configured yet (no project created, or env vars
 * not set in .env.local / GitHub Actions secrets) — callers must handle
 * that as "not connected", not crash. The anon key is safe to ship in the
 * frontend bundle by design (Supabase's model): every table it can touch
 * is behind Row Level Security scoped to auth.uid(), so the key alone
 * grants no access to anyone else's data. It is NOT the same kind of
 * secret as the Hevy API key or Strava client secret, which stay
 * server-side in Edge Functions — see ARCHITECTURE.md.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export function isSupabaseConfigured(): boolean {
  return supabase !== null
}
