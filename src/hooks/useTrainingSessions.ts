import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { DataSource } from '../lib/types/canonical'

export interface TrainingSessionSummary {
  id: string
  source: DataSource
  date: string
  notes: string | null
  setCount: number
}

interface TrainingSessionSummaryRow {
  id: string
  source: DataSource
  date: string
  notes: string | null
  sets: { count: number }[]
}

/**
 * A lighter shape than the full canonical TrainingSession -- this is a
 * history list, not a session-detail view, so it only pulls what a list
 * row needs (via PostgREST's embedded-resource count, `sets(count)`,
 * instead of fetching every set row just to count them).
 */
export function useTrainingSessions() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['training_sessions', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<TrainingSessionSummary[]> => {
      const { data, error } = await supabase!
        .from('training_sessions')
        .select('id, source, date, notes, sets(count)')
        .order('date', { ascending: false })
      if (error) throw error
      return (data as TrainingSessionSummaryRow[]).map((row) => ({
        id: row.id,
        source: row.source,
        date: row.date,
        notes: row.notes,
        setCount: row.sets[0]?.count ?? 0,
      }))
    },
  })
}
