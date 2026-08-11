import { supabase } from '../supabase'

/**
 * Only the client ID is public (standard for OAuth2 authorization-code
 * flow) -- the redirect target is the app's own root URL, so Strava's
 * "Authorization Callback Domain" setting must match this deployment's
 * domain exactly (e.g. bovisker.github.io). See README "Strava" setup.
 */
export function isStravaConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRAVA_CLIENT_ID)
}

export function buildStravaAuthorizeUrl(): string {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID
  const redirectUri = `${window.location.origin}${window.location.pathname}`
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export async function exchangeStravaCode(code: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is niet geconfigureerd.' }
  const { data, error } = await supabase.functions.invoke('strava-exchange-token', { body: { code } })
  if (error) return { error: error.message }
  if (data?.error) return { error: data.error as string }
  return { error: null }
}
