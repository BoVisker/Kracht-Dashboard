import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

/**
 * Not exported: sync_runs (RLS grants owner *read* only -- sync history the
 * app already shows, not really "your data" in the export sense) and
 * provider_tokens (zero client policies by design, see ARCHITECTURE.md --
 * OAuth/API secrets, not personal data this feature is meant to surface).
 */
const EXPORT_TABLES = [
  'profiles',
  'exercises',
  'training_sessions',
  'sets',
  'cardio_sessions',
  'goals',
  'goal_events',
  'personal_records',
  'cluster_tests',
  'cluster_requirement_overrides',
  'recovery_metrics',
  'planned_sessions',
  'achievements',
  'integrations',
] as const

export function useExportUserData() {
  const { session } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const result: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: session.user.id }
      for (const table of EXPORT_TABLES) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw error
        result[table] = data
      }
      return result
    },
  })
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Order matters: sets.exercise_id -> exercises is ON DELETE RESTRICT
 * (migration 0001), so exercises can't go while any set still references
 * one -- deleting training_sessions first cascades away every set, which
 * clears that block by the time exercises' turn comes. goal_events cascade
 * from goals automatically, same for sets from training_sessions.
 *
 * sync_runs and provider_tokens are deliberately NOT deleted here: RLS
 * gives the authenticated role no delete policy on either. Disconnecting
 * an integration (which does touch provider_tokens, via an Edge Function)
 * is a separate action from "delete my data".
 */
const DELETE_ORDER = [
  'training_sessions',
  'cardio_sessions',
  'goals',
  'personal_records',
  'cluster_tests',
  'cluster_requirement_overrides',
  'recovery_metrics',
  'planned_sessions',
  'achievements',
  'integrations',
  'exercises',
  'profiles',
] as const

export function useDeleteAllUserData() {
  const { session } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      for (const table of DELETE_ORDER) {
        const column = table === 'profiles' ? 'id' : 'user_id'
        const { error } = await supabase.from(table).delete().eq(column, session.user.id)
        if (error) throw error
      }
    },
  })
}
