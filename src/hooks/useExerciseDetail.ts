import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface ExerciseSetHistoryEntry {
  sessionId: string
  date: Date
  weightKg: number
  reps: number
}

export interface ExerciseDetail {
  id: string
  canonicalName: string
  loadIncrementKg: number
  /** Work sets only (warmups excluded) -- see brief section 11: a warmup set corrupts "top set of the day" reads. */
  history: ExerciseSetHistoryEntry[]
}

interface SetRow {
  session_id: string
  weight_kg: number | null
  reps: number | null
  set_type: string
  training_sessions: { date: string } | { date: string }[] | null
}

/** PostgREST returns the embedded resource as an object for a to-one FK, but supabase-js's generated types sometimes widen it to an array -- normalize either shape. */
function extractDate(sessions: SetRow['training_sessions']): string | null {
  if (!sessions) return null
  return Array.isArray(sessions) ? (sessions[0]?.date ?? null) : sessions.date
}

export function useExerciseDetail(exerciseId: string | undefined) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['exercise_detail', exerciseId],
    enabled: !!supabase && !!session && !!exerciseId,
    queryFn: async (): Promise<ExerciseDetail | null> => {
      const { data: exerciseRow, error: exerciseError } = await supabase!
        .from('exercises')
        .select('id, canonical_name, load_increment_kg')
        .eq('id', exerciseId)
        .maybeSingle()
      if (exerciseError) throw exerciseError
      if (!exerciseRow) return null

      const { data: setRows, error: setsError } = await supabase!
        .from('sets')
        .select('session_id, weight_kg, reps, set_type, training_sessions(date)')
        .eq('exercise_id', exerciseId)
      if (setsError) throw setsError

      const history: ExerciseSetHistoryEntry[] = (setRows as SetRow[])
        .filter((r) => r.set_type !== 'warmup' && r.reps != null)
        .map((r) => {
          const dateStr = extractDate(r.training_sessions)
          return {
            sessionId: r.session_id,
            date: dateStr ? new Date(dateStr) : new Date(0),
            weightKg: r.weight_kg ?? 0,
            reps: r.reps as number,
          }
        })
        .filter((r) => r.date.getTime() > 0)
        .sort((a, b) => a.date.getTime() - b.date.getTime())

      return {
        id: exerciseRow.id as string,
        canonicalName: exerciseRow.canonical_name as string,
        loadIncrementKg: exerciseRow.load_increment_kg as number,
        history,
      }
    },
  })
}
