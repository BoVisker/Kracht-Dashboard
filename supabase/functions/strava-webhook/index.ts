// Strava push-subscription webhook receiver. Complements strava-sync (the
// manual/full-refresh "Sync now" path) with near-real-time single-activity
// updates: Strava POSTs here the moment an activity is created, updated,
// or deleted, instead of waiting for the next manual sync.
//
// Deployed with --no-verify-jwt: Strava's own servers call this endpoint
// directly (both the GET subscription-verification handshake and the POST
// event deliveries), and neither carries a Supabase session JWT. The one
// authenticated action this function also handles -- {"action":"subscribe"}
// -- checks the caller's Supabase session manually instead, the same
// pattern hevy-sync/strava-sync use for their own auth.
//
// Security note: Strava's webhook protocol has no per-event signature --
// the only verification happens once, at subscription-creation time (the
// hub.challenge handshake below). Anyone who learns this callback URL and
// a real Strava athlete_id could POST a fake event. The blast radius is
// small and recoverable: activity data always comes from a fetch against
// Strava's real API using *our own* stored token (never from the event
// body), so a forged event can at most trigger a redundant re-sync of a
// real activity or delete one cached cardio_sessions row (a subsequent
// "Sync now" restores it, since Strava stays the source of truth). Not
// worth spending this app's Strava rate-limit budget on an extra
// verification call per event for a risk that small.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { getValidStravaAccessToken } from '../_shared/stravaAuth.ts'
import { mapActivityToCardioRow, type StravaActivity } from '../_shared/stravaCardio.ts'

const STRAVA_API = 'https://www.strava.com/api/v3'

type AdminClient = ReturnType<typeof createClient>

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates?: Record<string, string>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)

  // Strava's one-time subscription-verification handshake.
  if (req.method === 'GET' && url.searchParams.get('hub.mode') === 'subscribe') {
    const verifyToken = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN')
    if (!expected || verifyToken !== expected) return json({ error: 'verify_token mismatch' }, 403)
    return json({ 'hub.challenge': challenge })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))

  // Management action, called once from the app (not by Strava) to create the push subscription.
  if (body?.action === 'subscribe') {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await anonClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
    await ensureAthleteId(admin, userData.user.id)
    return await handleSubscribe(supabaseUrl)
  }

  return await handleEvent(admin, body as StravaWebhookEvent)
})

/**
 * provider_tokens.external_account_id is only populated by
 * strava-exchange-token on a *fresh* OAuth authorization -- an account
 * connected before tonight (or before this column existed) needs a
 * one-time backfill. Uses the already-stored access/refresh token, so no
 * new login or re-authorization is required.
 */
async function ensureAthleteId(admin: AdminClient, userId: string): Promise<void> {
  const { data: tokenRow } = await admin.from('provider_tokens').select('external_account_id').eq('user_id', userId).eq('provider', 'strava').maybeSingle()
  if (!tokenRow || tokenRow.external_account_id) return
  try {
    const accessToken = await getValidStravaAccessToken(admin, userId)
    const res = await fetch(`${STRAVA_API}/athlete`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return
    const athlete = (await res.json()) as { id: number }
    await admin.from('provider_tokens').update({ external_account_id: String(athlete.id) }).eq('user_id', userId).eq('provider', 'strava')
  } catch {
    // Best-effort -- if this fails, external_account_id stays null and webhook events for this user just won't route until the next attempt. Manual "Sync now" is unaffected either way.
  }
}

async function handleSubscribe(supabaseUrl: string): Promise<Response> {
  const clientId = Deno.env.get('STRAVA_CLIENT_ID')
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
  const verifyToken = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN')
  if (!clientId || !clientSecret || !verifyToken) {
    return json({ error: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_WEBHOOK_VERIFY_TOKEN not configured server-side.' }, 500)
  }

  // Strava allows exactly one push subscription per application -- check before creating to avoid a duplicate-subscription error on retries.
  const existingRes = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`)
  if (existingRes.ok) {
    const existing = (await existingRes.json()) as { id: number }[]
    if (existing.length > 0) return json({ ok: true, alreadySubscribed: true, subscriptionId: existing[0].id })
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/strava-webhook`
  const createRes = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, callback_url: callbackUrl, verify_token: verifyToken }),
  })
  const resBody = await createRes.json()
  if (!createRes.ok) return json({ error: `Strava subscription creation failed (HTTP ${createRes.status}): ${JSON.stringify(resBody)}` }, 400)
  return json({ ok: true, subscriptionId: resBody.id })
}

async function handleEvent(admin: AdminClient, event: StravaWebhookEvent): Promise<Response> {
  // Ack anything malformed/unrecognized rather than erroring -- Strava retries non-2xx responses, and there's nothing actionable in a body we can't parse.
  if (!event?.object_type) return json({ ok: true })

  if (event.object_type === 'athlete') {
    if (event.updates?.authorized === 'false') {
      const userId = await findUserIdByAthleteId(admin, event.owner_id)
      if (userId) {
        await admin
          .from('integrations')
          .upsert({ user_id: userId, provider: 'strava', status: 'error', last_error: 'Toegang ingetrokken via Strava.' }, { onConflict: 'user_id,provider' })
      }
    }
    return json({ ok: true })
  }

  if (event.object_type !== 'activity') return json({ ok: true })

  const userId = await findUserIdByAthleteId(admin, event.owner_id)
  if (!userId) return json({ ok: true }) // event for an athlete this app has no mapping for

  if (event.aspect_type === 'delete') {
    await admin.from('cardio_sessions').delete().eq('user_id', userId).eq('source', 'strava').eq('external_id', String(event.object_id))
    return json({ ok: true })
  }

  try {
    const accessToken = await getValidStravaAccessToken(admin, userId)
    const res = await fetch(`${STRAVA_API}/activities/${event.object_id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Strava activity detail HTTP ${res.status}`)
    const activity = (await res.json()) as StravaActivity
    const row = mapActivityToCardioRow(userId, activity)
    await admin.from('cardio_sessions').upsert(row, { onConflict: 'user_id,source,external_id' })
    await admin
      .from('integrations')
      .upsert({ user_id: userId, provider: 'strava', status: 'connected', last_sync_at: new Date().toISOString(), last_error: null }, { onConflict: 'user_id,provider' })
  } catch (err) {
    // Log but still ack 200 -- a non-2xx here makes Strava retry the same event repeatedly; a transient failure on one activity isn't worth a retry storm when the next "Sync now" (or the next webhook delivery for this activity) will catch it.
    console.error('strava-webhook activity processing failed:', err)
  }

  return json({ ok: true })
}

async function findUserIdByAthleteId(admin: AdminClient, athleteId: number): Promise<string | null> {
  const { data } = await admin.from('provider_tokens').select('user_id').eq('provider', 'strava').eq('external_account_id', String(athleteId)).maybeSingle()
  return (data?.user_id as string) ?? null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
