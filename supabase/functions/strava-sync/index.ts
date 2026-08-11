// Strava sync Edge Function. Same shape as hevy-sync: verify the caller's
// Supabase session, read that user's stored Strava tokens (provider_tokens
// has no RLS policy for anon/authenticated -- service_role only), fetch
// activities, batch-upsert into the canonical cardio_sessions table.
//
// Strava access tokens expire after ~6 hours; the refresh_token does not
// (until revoked). This refreshes on demand whenever the stored token is
// expired or close to it, rather than requiring a separate refresh step.
//
// Not implemented yet: Strava webhooks (brief section 7/43F) -- this is
// polling-only for now, same scope boundary as Hevy's sync. Also not
// implemented: calories (Strava's activity-list endpoint doesn't return
// them; only the per-activity detail endpoint sometimes does via
// `kilojoules`, and fetching detail per-activity would multiply request
// counts against Strava's rate limits for no immediate benefit).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { chunk } from '../_shared/chunk.ts'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

type AdminClient = ReturnType<typeof createClient>

interface StravaActivity {
  id: number
  name?: string
  type?: string
  sport_type?: string
  start_date?: string
  moving_time?: number
  elapsed_time?: number
  distance?: number
  average_speed?: number
  total_elevation_gain?: number
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  average_cadence?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await anonClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
    const userId = userData.user.id

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const syncStart = new Date().toISOString()
    const { data: syncRun } = await admin
      .from('sync_runs')
      .insert({ user_id: userId, provider: 'strava', started_at: syncStart })
      .select('id')
      .single()

    const errors: string[] = []
    let fetched = 0
    let upserted = 0

    try {
      const accessToken = await getValidAccessToken(admin, userId)
      const activities = await fetchAllActivities(accessToken)
      fetched = activities.length
      upserted = await upsertAllActivities(admin, userId, activities)

      await admin
        .from('integrations')
        .upsert(
          { user_id: userId, provider: 'strava', status: 'connected', last_sync_at: new Date().toISOString(), last_error: null },
          { onConflict: 'user_id,provider' },
        )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
      await admin
        .from('integrations')
        .upsert({ user_id: userId, provider: 'strava', status: 'error', last_error: message }, { onConflict: 'user_id,provider' })
    }

    await admin
      .from('sync_runs')
      .update({ finished_at: new Date().toISOString(), records_fetched: fetched, records_upserted: upserted, errors })
      .eq('id', syncRun?.id)

    return json({ fetched, upserted, errors })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

/** Returns a live access token, refreshing via Strava's token endpoint first if the stored one is expired or about to be. */
async function getValidAccessToken(admin: AdminClient, userId: string): Promise<string> {
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

async function fetchAllActivities(accessToken: string): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  const perPage = 100 // Strava's documented max per page
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${STRAVA_API}/athlete/activities?page=${page}&per_page=${perPage}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 429) throw new Error('Strava rate limit hit (429) -- probeer het later opnieuw.')
    if (!res.ok) throw new Error(`Strava API HTTP ${res.status} on page ${page}`)
    const activities: StravaActivity[] = await res.json()
    if (!activities.length) break
    all.push(...activities)
    if (activities.length < perPage) break
  }
  return all
}

async function upsertAllActivities(admin: AdminClient, userId: string, activities: StravaActivity[]): Promise<number> {
  if (!activities.length) return 0
  let upserted = 0
  for (const batch of chunk(activities, 200)) {
    const rows = batch.map((a) => ({
      user_id: userId,
      source: 'strava',
      external_id: String(a.id),
      sport: a.sport_type ?? a.type ?? 'Unknown',
      date: (a.start_date ?? new Date().toISOString()).slice(0, 10),
      moving_time_seconds: a.moving_time ?? null,
      elapsed_time_seconds: a.elapsed_time ?? null,
      distance_meters: a.distance ?? null,
      average_speed_ms: a.average_speed ?? null,
      elevation_gain_meters: a.total_elevation_gain ?? null,
      average_heart_rate: a.average_heartrate ?? null,
      max_heart_rate: a.max_heartrate ?? null,
      average_power: a.average_watts ?? null,
      average_cadence: a.average_cadence ?? null,
      calories: null, // not available from the activity-list endpoint -- see file header
      quality: 'imported',
      raw: a,
    }))
    const { error } = await admin.from('cardio_sessions').upsert(rows, { onConflict: 'user_id,source,external_id' })
    if (error) throw new Error(`Failed to upsert cardio sessions: ${error.message}`)
    upserted += rows.length
  }
  return upserted
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
