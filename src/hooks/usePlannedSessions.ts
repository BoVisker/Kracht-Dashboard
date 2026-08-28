import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import { SEED_PLANNED_SESSIONS } from '../data/seedPlannedSessions'
import type { DayOfWeek, PlannedSession } from '../lib/types/canonical'

export const WEEKDAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface PlannedSessionRow {
  id: string
  day_of_week: DayOfWeek
  sort_order: number
  training_type: PlannedSession['trainingType']
  training_subtype: PlannedSession['trainingSubtype']
  label: string
  notes: string | null
}

function mapRow(row: PlannedSessionRow): PlannedSession {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    sortOrder: row.sort_order,
    trainingType: row.training_type,
    trainingSubtype: row.training_subtype,
    label: row.label,
    notes: row.notes,
  }
}

function sortSessions(sessions: PlannedSession[]): PlannedSession[] {
  return [...sessions].sort((a, b) => {
    const dayDiff = WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek)
    return dayDiff !== 0 ? dayDiff : a.sortOrder - b.sortOrder
  })
}

/**
 * Reads the weekly plan template (see migration 0006); falls back to the
 * seed schedule when Supabase isn't configured yet, or when it is
 * configured but the table is still empty (first run, before the user has
 * saved anything) -- same "never show an empty Today card if there's a
 * sensible starting point" reasoning as useGoals.
 */
export function usePlannedSessions() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['planned_sessions', session?.user.id],
    queryFn: async (): Promise<PlannedSession[]> => {
      if (!supabase) {
        return sortSessions(SEED_PLANNED_SESSIONS.map((s, i) => ({ ...s, id: `seed-${i}` })))
      }
      const { data, error } = await supabase.from('planned_sessions').select('*')
      if (error) throw error
      const rows = data as PlannedSessionRow[]
      if (rows.length === 0) {
        return sortSessions(SEED_PLANNED_SESSIONS.map((s, i) => ({ ...s, id: `seed-${i}` })))
      }
      return sortSessions(rows.map(mapRow))
    },
  })
}

export function useSetPlannedSession() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<PlannedSession, 'id'> & { id?: string }) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const isRealId = !!input.id && !input.id.startsWith('seed-')
      const { error } = await supabase.from('planned_sessions').upsert({
        ...(isRealId ? { id: input.id } : {}),
        user_id: session.user.id,
        day_of_week: input.dayOfWeek,
        sort_order: input.sortOrder,
        training_type: input.trainingType,
        training_subtype: input.trainingSubtype,
        label: input.label,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned_sessions', session?.user.id] }),
  })
}

export function useDeletePlannedSession() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      if (id.startsWith('seed-')) return // nothing persisted yet to delete
      const { error } = await supabase.from('planned_sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned_sessions', session?.user.id] }),
  })
}
