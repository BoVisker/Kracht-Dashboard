import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import { findPRHistory, type PersonalRecordEvent, type SetRecord } from '../lib/strength/personalRecords'

export interface AchievementEvent extends PersonalRecordEvent {
  exerciseId: string
  exerciseName: string
}

interface SetRow {
  session_id: string
  exercise_id: string
  weight_kg: number | null
  reps: number | null
  set_type: string
  exercises: { canonical_name: string } | { canonical_name: string }[] | null
  training_sessions: { date: string } | { date: string }[] | null
}

/** PostgREST embeds a to-one FK as an object, but generated types sometimes widen it to an array -- normalize either shape. */
function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * All-time PR history across every exercise, for the achievements feed --
 * reuses the same findPRHistory logic ExercisePage would use per exercise,
 * just run once per exercise group and flattened. One query (not N), since
 * this is exactly the kind of per-exercise round-trip that caused the
 * hevy-sync timeout earlier in the project.
 */
export function useAchievements() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['achievements', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<AchievementEvent[]> => {
      const { data, error } = await supabase!
        .from('sets')
        .select('session_id, exercise_id, weight_kg, reps, set_type, exercises(canonical_name), training_sessions(date)')
      if (error) throw error

      const byExercise = new Map<string, { exerciseName: string; history: SetRecord[] }>()
      for (const row of data as SetRow[]) {
        if (row.set_type === 'warmup' || row.reps == null) continue
        const dateStr = firstOf(row.training_sessions)?.date
        if (!dateStr) continue
        const exerciseName = firstOf(row.exercises)?.canonical_name ?? 'Onbekende oefening'

        const group = byExercise.get(row.exercise_id) ?? { exerciseName, history: [] }
        group.history.push({ sessionId: row.session_id, date: new Date(dateStr), weightKg: row.weight_kg ?? 0, reps: row.reps })
        byExercise.set(row.exercise_id, group)
      }

      const events: AchievementEvent[] = []
      for (const [exerciseId, { exerciseName, history }] of byExercise) {
        history.sort((a, b) => a.date.getTime() - b.date.getTime())
        for (const event of findPRHistory(history)) {
          events.push({ ...event, exerciseId, exerciseName })
        }
      }

      return events.sort((a, b) => b.date.getTime() - a.date.getTime())
    },
  })
}
