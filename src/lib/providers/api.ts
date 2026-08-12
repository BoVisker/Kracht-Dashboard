import { supabase } from '../supabase'

export interface SaveProviderTokenInput {
  provider: 'hevy' | 'strava' | 'garmin'
  accessToken: string
  refreshToken?: string
  expiresAt?: string
}

/**
 * The only path a provider secret takes into the database -- calls the
 * save-provider-token Edge Function, which writes into provider_tokens
 * using service_role (that table has no RLS policy for anon/authenticated,
 * see supabase/migrations/0001_init.sql). Never writes the key anywhere
 * client-side (no localStorage, no state that outlives the form).
 */
export async function saveProviderToken(input: SaveProviderTokenInput): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is niet geconfigureerd.' }
  const { data, error } = await supabase.functions.invoke('save-provider-token', { body: input })
  if (error) return { error: error.message }
  if (data?.error) return { error: data.error as string }
  return { error: null }
}

export interface SyncResult {
  fetched?: number
  upserted?: number
  errors?: string[]
  error?: string
}

export async function triggerSync(provider: 'hevy' | 'strava'): Promise<SyncResult> {
  if (!supabase) return { error: 'Supabase is niet geconfigureerd.' }
  const { data, error } = await supabase.functions.invoke(`${provider}-sync`)
  if (error) return { error: error.message }
  return data as SyncResult
}

/** Best-effort: creates (or confirms) the Strava push subscription so future activity changes sync automatically, not just on manual "Sync now". Not on the critical path -- polling still works if this fails. */
export async function subscribeStravaWebhook(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is niet geconfigureerd.' }
  const { data, error } = await supabase.functions.invoke('strava-webhook', { body: { action: 'subscribe' } })
  if (error) return { error: error.message }
  if (data?.error) return { error: data.error as string }
  return { error: null }
}
