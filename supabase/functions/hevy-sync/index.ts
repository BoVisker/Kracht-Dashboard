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
// Incremental sync via GET /v1/workouts/events: the exact response shape
// (page/page_count/events[], each event {type:'updated', workout} or
// {type:'deleted', id, deleted_at}) is taken from Hevy's own published
// OpenAPI spec (github.com/chrisdoc/hevy-mcp, openapi-spec.json) -- this
// is the schema Hevy documents, not a guess, but it has still never been
// checked against a real live response from this account, since no Hevy
// Pro key was available while writing this. That's why every incremental
// attempt is wrapped to fall back to the full refresh (fetchAllWorkouts)
// on ANY error or unexpected shape -- see runSync below. Full refresh
// alone was already correct, just not incremental; this only adds a
// faster path on top, never replaces the safe one.
//
// Deletions: full refresh never removed a training_sessions row for a
// workout deleted on Hevy's side -- it only upserts, so a deleted-in-Hevy
// workout stayed forever. Incremental sync's 'deleted' events are the
// only place that gap is closed; full refresh still won't catch a
// deletion that happened before the last incremental sync ever ran.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { chunk } from '../_shared/chunk.ts'
import { fitLinearTrend, forecastAchievementDate, trendConfidence, type HistoryPoint } from '../_shared/trend.ts'

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

interface HevyWorkoutEvent {
  type: 'updated' | 'deleted'
  workout?: HevyWorkout
  id?: string
  deleted_at?: string
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

    const { data: integrationRow } = await admin
      .from('integrations')
      .select('last_sync_at')
      .eq('user_id', userId)
      .eq('provider', 'hevy')
      .maybeSingle()
    const lastSyncAt = (integrationRow as { last_sync_at: string | null } | null)?.last_sync_at ?? null

    const syncStart = new Date().toISOString()
    const { data: syncRun } = await admin
      .from('sync_runs')
      .insert({ user_id: userId, provider: 'hevy', started_at: syncStart })
      .select('id')
      .single()

    const errors: string[] = []
    let fetched = 0
    let upserted = 0
    let deletedCount = 0
    let mode: 'full' | 'incremental' = 'full'

    try {
      if (lastSyncAt) {
        try {
          const { updated, deletedIds } = await fetchWorkoutEvents(hevyApiKey, lastSyncAt)
          fetched = updated.length
          upserted = await upsertAllWorkouts(admin, userId, updated)
          deletedCount = await deleteWorkoutsByExternalIds(admin, userId, deletedIds)
          mode = 'incremental'
        } catch (incrementalErr) {
          // See file header: never trust the incremental path alone --
          // any failure (network, unexpected shape, Hevy API error) falls
          // back to the full refresh that was already known-correct.
          console.error('Incremental Hevy sync failed, falling back to full refresh:', incrementalErr)
          const workouts = await fetchAllWorkouts(hevyApiKey)
          fetched = workouts.length
          upserted = await upsertAllWorkouts(admin, userId, workouts)
          deletedCount = 0
          mode = 'full'
        }
      } else {
        const workouts = await fetchAllWorkouts(hevyApiKey)
        fetched = workouts.length
        upserted = await upsertAllWorkouts(admin, userId, workouts)
      }
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
        records_deleted: deletedCount,
        errors,
      })
      .eq('id', syncRun?.id)

    return json({ fetched, upserted, deleted: deletedCount, mode, errors })
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

/**
 * Incremental alternative to fetchAllWorkouts: GET /v1/workouts/events,
 * paginated (page/pageSize, max pageSize 10 per Hevy's spec) and filtered
 * by `since`. Response shape per Hevy's published OpenAPI spec:
 * `{ page, page_count, events: [{type:'updated', workout} | {type:'deleted', id, deleted_at}] }`,
 * newest-to-oldest. `page_count` from the first response drives how many
 * pages to walk -- see file header for why every caller of this wraps it
 * in a fallback to fetchAllWorkouts.
 */
async function fetchWorkoutEvents(apiKey: string, since: string): Promise<{ updated: HevyWorkout[]; deletedIds: string[] }> {
  const updated: HevyWorkout[] = []
  const deletedIds: string[] = []
  const pageSize = 10
  let pageCount = 1
  for (let page = 1; page <= pageCount; page++) {
    const res = await fetch(`${HEVY_BASE}/workouts/events?page=${page}&pageSize=${pageSize}&since=${encodeURIComponent(since)}`, {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    })
    if (res.status === 404) break // no events since `since` at all
    if (!res.ok) throw new Error(`Hevy events API HTTP ${res.status} on page ${page}`)
    const data = await res.json()
    if (typeof data.page_count !== 'number' || !Array.isArray(data.events)) {
      throw new Error('Unexpected /v1/workouts/events response shape')
    }
    pageCount = data.page_count
    for (const event of data.events as HevyWorkoutEvent[]) {
      if (event.type === 'updated' && event.workout) updated.push(event.workout)
      else if (event.type === 'deleted' && event.id) deletedIds.push(event.id)
    }
    if (page >= pageCount) break
  }
  return { updated, deletedIds }
}

/** Full refresh never removed a row for a workout deleted on Hevy's side -- this is the incremental-only fix for that, see file header. */
async function deleteWorkoutsByExternalIds(admin: AdminClient, userId: string, externalIds: string[]): Promise<number> {
  if (!externalIds.length) return 0
  let deletedCount = 0
  for (const idBatch of chunk(externalIds, 200)) {
    const { data, error } = await admin
      .from('training_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'hevy')
      .in('external_id', idBatch)
      .select('id')
    if (error) throw new Error(`Failed to delete removed workouts: ${error.message}`)
    deletedCount += data?.length ?? 0
  }
  return deletedCount
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
 * recomputes current_value (estimated 1RM of the most recent session's best
 * set) and forecast_date (linear trend over every session's best set,
 * extrapolated to the goal's target_value). Generic across any
 * exercise-linked goal, not hardcoded to bench/dips/pull-ups -- goals with
 * no linked exercise, or whose exercise has no sets yet, are left with
 * current_value/forecast_date at null rather than a fabricated number.
 *
 * Status itself is NOT written here -- the frontend's useGoals hook
 * recomputes status/percent reactively from current_value + deadline +
 * forecast_date on every render (see toGoalWithProgress), so writing it
 * here would just be a second, easily-stale copy of the same logic.
 */
async function recomputeGoalProgress(admin: AdminClient, userId: string): Promise<void> {
  const { data: goals, error: goalsError } = await admin
    .from('goals')
    .select('id, exercise_id, target_value')
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

  for (const goal of goals as { id: string; exercise_id: string; target_value: number }[]) {
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

    // ...then every session becomes one point in the trend history, sorted chronologically.
    const history: HistoryPoint[] = Array.from(bestPerSession.entries())
      .map(([sessionId, e1rm]) => ({ date: new Date(sessionDateById.get(sessionId) ?? 0), value: e1rm }))
      .filter((p) => p.date.getTime() > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    if (!history.length) continue

    const latest = history[history.length - 1]
    const trend = fitLinearTrend(history)
    const forecastDate = trend ? forecastAchievementDate(trend, latest, goal.target_value) : null

    await admin
      .from('goals')
      .update({
        current_value: Math.round(latest.value * 10) / 10,
        forecast_date: forecastDate ? forecastDate.toISOString().slice(0, 10) : null,
        confidence: trendConfidence(trend),
        updated_at: new Date().toISOString(),
      })
      .eq('id', goal.id)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
