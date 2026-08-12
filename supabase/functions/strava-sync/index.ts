// Strava sync Edge Function. Same shape as hevy-sync: verify the caller's
// Supabase session, read that user's stored Strava tokens (provider_tokens
// has no RLS policy for anon/authenticated -- service_role only), fetch
// activities, batch-upsert into the canonical cardio_sessions table.
//
// Strava access tokens expire after ~6 hours; the refresh_token does not
// (until revoked). This refreshes on demand whenever the stored token is
// expired or close to it, rather than requiring a separate refresh step.
//
// This is the manual/full-refresh path ("Sync now"). strava-webhook (same
// folder tree, see ../strava-webhook) complements this with near-real-time
// single-activity updates pushed by Strava -- this function stays as the
// bulk-catchup fallback (first connect, missed webhook deliveries, etc.).
// Calories aren't implemented: Strava's activity-list endpoint doesn't
// return them, and fetching per-activity detail just to get `kilojoules`
// would multiply request counts against Strava's rate limits for no
// immediate benefit.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { chunk } from '../_shared/chunk.ts'
import { getValidStravaAccessToken } from '../_shared/stravaAuth.ts'
import { mapActivityToCardioRow, type StravaActivity } from '../_shared/stravaCardio.ts'

const STRAVA_API = 'https://www.strava.com/api/v3'

type AdminClient = ReturnType<typeof createClient>

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
      const accessToken = await getValidStravaAccessToken(admin, userId)
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
    const rows = batch.map((a) => mapActivityToCardioRow(userId, a))
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
