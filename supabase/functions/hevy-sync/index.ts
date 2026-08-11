// Hevy sync Edge Function -- the only place the Hevy API key ever touches
// a network request. Runs server-side on Supabase, never in the browser.
//
// Flow: Hevy (api-key header) -> this function -> canonical tables
// (training_sessions / exercises / sets), keyed by (user_id, source,
// external_id) so re-running the sync is idempotent -- Hevy workouts
// that already exist get updated, not duplicated.
//
// Auth model: the frontend calls this via supabase.functions.invoke(),
// which forwards the caller's Supabase JWT in the Authorization header.
// We verify that JWT to get the user_id, then read *that user's* Hevy
// API key from provider_tokens (service_role bypasses RLS -- this table
// has no policies granting access to anyone else, see migration 0001).
//
// IMPORTANT -- verify before first real deploy: the exact JSON shape of
// GET /v1/workouts/events (used for incremental sync) was not directly
// observable from Hevy's Swagger UI (it doesn't serve to non-browser
// fetchers) -- the endpoint's existence and purpose ("Retrieve paged
// workout events (updates/deletes) since a given date") is confirmed
// from their published OpenAPI spec, but the response field names below
// are a best-effort guess and MUST be checked against a real response
// (e.g. via `curl` with a real api-key) before this is trusted to catch
// deletions correctly. Full-refresh sync (fetchAllWorkouts) does not
// depend on this and is safe to use today.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const HEVY_BASE = 'https://api.hevyapp.com/v1'

interface HevySet {
  index?: number
  type?: string // 'warmup' | 'normal' | 'failure' | 'dropset' etc — Hevy's own vocabulary, mapped below
  weight_kg?: number | null
  reps?: number | null
  distance_meters?: number | null
  duration_seconds?: number | null
  rpe?: number | null
}

interface HevyExercise {
  title?: string
  exercise_template_id?: string
  sets?: HevySet[]
}

interface HevyWorkout {
  id: string
  title?: string
  start_time?: string
  end_time?: string
  created_at?: string
  exercises?: HevyExercise[]
}

const SET_TYPE_MAP: Record<string, string> = {
  warmup: 'warmup',
  normal: 'work',
  working: 'work',
  failure: 'failure',
  dropset: 'dropset',
  amrap: 'amrap',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    // Verify the caller's JWT using the anon client, so an arbitrary
    // caller can't sync on someone else's behalf just by knowing a user_id.
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await anonClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Invalid or expired session' }, 401)
    }
    const userId = userData.user.id

    // service_role bypasses RLS -- required to read provider_tokens
    // (which has no policies granting access to authenticated/anon) and
    // to write sync_runs (which only allows select, not insert, for
    // non-service roles).
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: tokenRow } = await admin
      .from('provider_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'hevy')
      .maybeSingle()

    const hevyApiKey = tokenRow?.access_token
    if (!hevyApiKey) {
      return json({ error: 'Geen Hevy API-sleutel opgeslagen voor deze gebruiker. Voeg deze toe via Settings.' }, 400)
    }

    const syncStart = new Date().toISOString()
    const { data: syncRun } = await admin
      .from('sync_runs')
      .insert({ user_id: userId, provider: 'hevy', started_at: syncStart })
      .select('id')
      .single()

    const errors: string[] = []
    let fetched = 0
    let upserted = 0

    try {
      const workouts = await fetchAllWorkouts(hevyApiKey)
      fetched = workouts.length

      for (const workout of workouts) {
        upserted += await upsertWorkout(admin, userId, workout)
      }

      await admin
        .from('integrations')
        .upsert(
          { user_id: userId, provider: 'hevy', status: 'connected', last_sync_at: new Date().toISOString(), last_error: null },
          { onConflict: 'user_id,provider' },
        )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
      await admin
        .from('integrations')
        .upsert(
          { user_id: userId, provider: 'hevy', status: 'error', last_error: message },
          { onConflict: 'user_id,provider' },
        )
    }

    await admin
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        records_fetched: fetched,
        records_upserted: upserted,
        errors,
      })
      .eq('id', syncRun?.id)

    return json({ fetched, upserted, errors })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

async function fetchAllWorkouts(apiKey: string): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = []
  const pageSize = 10
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`${HEVY_BASE}/workouts?page=${page}&pageSize=${pageSize}`, {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`Hevy API HTTP ${res.status} on page ${page}`)
    }
    const data = await res.json()
    const workouts: HevyWorkout[] = data.workouts ?? data.items ?? []
    if (!workouts.length) break
    all.push(...workouts)
    if (workouts.length < pageSize) break
  }
  return all
}

/** Upserts one workout + its exercises/sets. Returns the number of set rows written. */
async function upsertWorkout(
  admin: ReturnType<typeof createClient>,
  userId: string,
  workout: HevyWorkout,
): Promise<number> {
  const date = (workout.start_time ?? workout.created_at ?? new Date().toISOString()).slice(0, 10)

  const { data: session, error: sessionError } = await admin
    .from('training_sessions')
    .upsert(
      {
        user_id: userId,
        source: 'hevy',
        external_id: workout.id,
        date,
        start_time: workout.start_time ?? null,
        end_time: workout.end_time ?? null,
        training_type: 'other', // classifying push/pull/legs from exercise composition is phase 9 (training-plan analysis), not this sync step
        notes: workout.title ?? null,
        raw: workout,
      },
      { onConflict: 'user_id,source,external_id' },
    )
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error(`Failed to upsert session ${workout.id}: ${sessionError?.message}`)
  }

  // Existing sets for this session are replaced wholesale on each sync --
  // simpler and still correct/idempotent, since Hevy is the source of
  // truth for its own workouts and set order/count can change on edit.
  await admin.from('sets').delete().eq('session_id', session.id)

  let setCount = 0
  for (const exercise of workout.exercises ?? []) {
    const exerciseId = await upsertExercise(admin, userId, exercise)
    const sets = exercise.sets ?? []
    const rows = sets.map((s, i) => ({
      session_id: session.id,
      exercise_id: exerciseId,
      set_index: s.index ?? i,
      set_type: SET_TYPE_MAP[s.type ?? 'normal'] ?? 'work',
      weight_kg: s.weight_kg ?? null,
      reps: s.reps ?? null,
      distance_meters: s.distance_meters ?? null,
      duration_seconds: s.duration_seconds ?? null,
      rpe: s.rpe ?? null,
      quality: 'imported',
    }))
    if (rows.length) {
      const { error } = await admin.from('sets').insert(rows)
      if (error) throw new Error(`Failed to insert sets for ${exercise.title}: ${error.message}`)
      setCount += rows.length
    }
  }
  return setCount
}

async function upsertExercise(
  admin: ReturnType<typeof createClient>,
  userId: string,
  exercise: HevyExercise,
): Promise<string> {
  const canonicalName = exercise.title ?? 'Unknown exercise'

  const { data: existing } = await admin
    .from('exercises')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_name', canonicalName)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data: created, error } = await admin
    .from('exercises')
    .insert({
      user_id: userId,
      canonical_name: canonicalName,
      source_names: { hevy: canonicalName },
    })
    .select('id')
    .single()

  if (error || !created) throw new Error(`Failed to create exercise ${canonicalName}: ${error?.message}`)
  return created.id as string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
