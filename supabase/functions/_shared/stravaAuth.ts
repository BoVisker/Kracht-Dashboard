// Shared by strava-sync and strava-webhook -- both are Deno Edge Functions
// in the same deploy unit (unlike trend.ts's frontend/backend duplication),
// so sharing this instead of copy-pasting it twice is the correct call.

import type { createClient } from 'npm:@supabase/supabase-js@2'

type AdminClient = ReturnType<typeof createClient>

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

/** Returns a live access token for the given user, refreshing via Strava's token endpoint first if the stored one is expired or about to be. */
export async function getValidStravaAccessToken(admin: AdminClient, userId: string): Promise<string> {
  const { data: tokenRow, error } = await admin
    .from('provider_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .maybeSingle()

  if (error || !tokenRow) {
    throw new Error('Geen Strava-koppeling gevonden voor deze gebruiker. Klik "Connect Strava" op de Sync-pagina.')
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at as string).getTime() : 0
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
  if (expiresAt > fiveMinutesFromNow) {
    return tokenRow.access_token as string
  }

  const clientId = Deno.env.get('STRAVA_CLIENT_ID')
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Strava client credentials not configured server-side.')

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
    }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed (HTTP ${res.status}): ${await res.text()}`)

  const refreshed = (await res.json()) as { access_token: string; refresh_token: string; expires_at: number }
  await admin
    .from('provider_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return refreshed.access_token
}
