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
// Writes are batched (see upsertAllWorkouts), not one round-trip per
// workout/exercise/set -- an earlier version awaited a DB call per
// exercise per workout, which meant ~160 real workouts turned into
// nearly 2000 sequential queries and the sync never finished inside
// the Edge Function's execution window. Confirmed live before the fix.
//
// IMPORTANT -- verify before relying on it: the exact JSON shape of
// GET /v1/workouts/events (used for incremental sync) was not directly
// observable from Hevy's Swagger UI (it doesn't serve to non-browser
// fetchers) -- the endpoint's existence and purpose ("Retrieve paged
// workout events (updates/deletes) since a given date") is confirmed
// from their published OpenAPI spec, but the response field names are a
// best-effort guess and MUST be checked against a real response before
// being trusted to catch deletions correctly. Full-refresh sync
// (fetchAllWorkouts) does not depend on this and is safe to use today.

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

type AdminClient = ReturnType<typeof createClient>

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
      upserted = await upsertAllWorkouts(admin, userId, workouts)
      await recomputeGoalProgress(admin, userId)

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
    // Confirmed by hitting the real API: Hevy returns 404, not an empty
    // 200, once `page` exceeds the account's actual page_count. That is
    // "no more workouts", not a real error.
    if (res.status === 404) break
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Batched upsert for every fetched workout in a handful of round-trips
 * total, instead of one round-trip per workout/exercise/set. That
 * earlier per-row approach is what made a ~160-workout account take
 * minutes and never actually finish inside the function's time budget.
 */
async function upsertAllWorkouts(admin: AdminClient, userId: string, workouts: HevyWorkout[]): Promise<number> {
  if (!workouts.length) return 0

  // 1) Upsert all training_sessions, chunked to keep each request body
  // (which includes the full raw workout JSON) reasonably sized.
  const sessionIdByExternalId = new Map<string, string>()
  for (const batch of chunk(workouts, 200)) {
    const rows = batch.map((w) => ({
      user_id: userId,
      source: 'hevy',
      external_id: w.id,
      date: (w.start_time ?? w.created_at ?? new Date().toISOString()).slice(0, 10),
      start_time: w.start_time ?? null,
      end_time: w.end_time ?? null,
      training_type: 'other', // classifying push/pull/legs from exercise composition is phase 9 (training-plan analysis), not this sync step
      notes: w.title ?? null,
      raw: w,
    }))
    const { data, error } = await admin
      .from('training_sessions')
      .upsert(rows, { onConflict: 'user_id,source,external_id' })
      .select('id, external_id')
    if (error || !data) throw new Error(`Failed to upsert sessions: ${error?.message}`)
    for (const row of data as { id: string; external_id: string }[]) {
      sessionIdByExternalId.set(row.external_id, row.id)
    }
  }

  // 2) Resolve every distinct exercise name in one lookup + one insert
  // for whatever's missing, instead of a SELECT-then-maybe-INSERT per
  // exercise per workout (the same lift reappears in nearly every
  // session, so this alone was most of the wasted round-trips).
  const allExerciseNames = new Set<string>()
  for (const w of workouts) {
    for (const ex of w.exercises ?? []) allExerciseNames.add(ex.title ?? 'Unknown exercise')
  }
  const nameList = Array.from(allExerciseNames)
  const exerciseIdByName = new Map<string, string>()

  if (nameList.length) {
    const { data: existing, error: fetchErr } = await admin
      .from('exercises')
      .select('id, canonical_name')
      .eq('user_id', userId)
      .in('canonical_name', nameList)
    if (fetchErr) throw new Error(`Failed to fetch exercises: ${fetchErr.message}`)
    for (const row of (existing ?? []) as { id: string; canonical_name: string }[]) {
      exerciseIdByName.set(row.canonical_name, row.id)
    }

    const missing = nameList.filter((n) => !exerciseIdByName.has(n))
    if (missing.length) {
      const { data: created, error: insertErr } = await admin
        .from('exercises')
        .insert(missing.map((name) => ({ user_id: userId, canonical_name: name, source_names: { hevy: name } })))
        .select('id, canonical_name')
      if (insertErr || !created) throw new Error(`Failed to create exercises: ${insertErr?.message}`)
      for (const row of created as { id: string; canonical_name: string }[]) {
        exerciseIdByName.set(row.canonical_name, row.id)
      }
    }
  }

  // 3) Clear existing sets for every touched session in one call, then
  // bulk-insert the fresh set rows -- simpler and still correct/
  // idempotent, since Hevy is the source of truth for its own workouts.
  const sessionIds = Array.from(sessionIdByExternalId.values())
  if (sessionIds.length) {
    for (const idBatch of chunk(sessionIds, 500)) {
      const { error } = await admin.from('sets').delete().in('session_id', idBatch)
      if (error) throw new Error(`Failed to clear existing sets: ${error.message}`)
    }
  }

  const setRows: Record<string, unknown>[] = []
  for (const w of workouts) {
    const sessionId = sessionIdByExternalId.get(w.id)
    if (!sessionId) continue
    for (const ex of w.exercises ?? []) {
      const exerciseId = exerciseIdByName.get(ex.title ?? 'Unknown exercise')
      if (!exerciseId) continue
      ;(ex.sets ?? []).forEach((s, i) => {
        setRows.push({
          session_id: sessionId,
          exercise_id: exerciseId,
          set_index: s.index ?? i,
          set_type: SET_TYPE_MAP[s.type ?? 'normal'] ?? 'work',
          weight_kg: s.weight_kg ?? null,
          reps: s.reps ?? null,
          distance_meters: s.distance_meters ?? null,
          duration_seconds: s.duration_seconds ?? null,
          rpe: s.rpe ?? null,
          quality: 'imported',
        })
      })
    }
  }

  let inserted = 0
  for (const batch of chunk(setRows, 500)) {
    const { error } = await admin.from('sets').insert(batch)
    if (error) throw new Error(`Failed to insert sets: ${error.message}`)
    inserted += batch.length
  }

  return inserted
}

/**
 * For every one of the user's goals linked to an exercise (goals.exercise_id),
 * recomputes current_value from the sets actually on record: estimated 1RM
 * (Epley) of the best set in the most recent session that touched that
 * exercise. Generic across any exercise-linked goal, not hardcoded to
 * bench/dips/pull-ups -- goals with no linked exercise are left untouched,
 * and a goal whose exercise has no sets yet keeps current_value at null
 * rather than getting a fabricated number.
 */
async function recomputeGoalProgress(admin: AdminClient, userId: string): Promise<void> {
  const { data: goals, error: goalsError } = await admin
    .from('goals')
    .select('id, exercise_id')
    .eq('user_id', userId)
    .not('exercise_id', 'is', null)
  if (goalsError || !goals?.length) return

  const { data: sessions, error: sessionsError } = await admin
    .from('training_sessions')
    .select('id, date')
    .eq('user_id', userId)
  if (sessionsError || !sessions?.length) return
  const sessionDateById = new Map((sessions as { id: string; date: string }[]).map((s) => [s.id, s.date]))
  const sessionIds = Array.from(sessionDateById.keys())

  for (const goal of goals as { id: string; exercise_id: string }[]) {
    const { data: setsForExercise, error: setsError } = await admin
      .from('sets')
      .select('session_id, weight_kg, reps')
      .eq('exercise_id', goal.exercise_id)
      .in('session_id', sessionIds)
    if (setsError || !setsForExercise?.length) continue

    // Best (highest estimated 1RM) set per session...
    const bestPerSession = new Map<string, number>()
    for (const s of setsForExercise as { session_id: string; weight_kg: number | null; reps: number | null }[]) {
      if (s.reps == null || s.reps <= 0) continue
      const weight = s.weight_kg ?? 0
      const e1rm = weight * (1 + s.reps / 30) // Epley -- matches src/lib/strength/estimate1RM.ts
      if (e1rm > (bestPerSession.get(s.session_id) ?? -Infinity)) bestPerSession.set(s.session_id, e1rm)
    }

    // ...then the most recent session among those wins as "current".
    let latestDate = ''
    let latestE1rm: number | null = null
    for (const [sessionId, e1rm] of bestPerSession) {
      const date = sessionDateById.get(sessionId) ?? ''
      if (date > latestDate) {
        latestDate = date
        latestE1rm = e1rm
      }
    }
    if (latestE1rm == null) continue

    await admin
      .from('goals')
      .update({ current_value: Math.round(latestE1rm * 10) / 10, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
