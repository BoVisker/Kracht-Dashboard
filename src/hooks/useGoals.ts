import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SEED_GOALS } from '../data/seedGoals'
import { computeGoalStatus, goalProgressPercent } from '../lib/goals/goalEngine'
import type { Goal } from '../lib/types/canonical'

export interface GoalWithProgress {
  goal: Goal
  percent: number | null
}

/** Raw shape of a `goals` row exactly as Postgres/PostgREST returns it (snake_case). */
interface GoalRow {
  id: string
  name: string
  category: Goal['category']
  exercise_id: string | null
  unit: string
  start_value: number | null
  current_value: number | null
  target_value: number
  start_date: string
  deadline: string | null
  status: Goal['status']
  forecast_date: string | null
  confidence: Goal['confidence']
  priority: number
}

/**
 * Postgres/PostgREST columns are snake_case; the canonical Goal type is
 * camelCase everywhere else in the app. `as Goal[]` alone does NOT convert
 * between them -- it just tells TypeScript to trust a shape that doesn't
 * match at runtime, which silently produced `undefined` for every renamed
 * field (targetValue, currentValue, ...) until this mapper existed.
 */
function mapGoalRow(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    exerciseId: row.exercise_id,
    unit: row.unit,
    startValue: row.start_value,
    currentValue: row.current_value,
    targetValue: row.target_value,
    startDate: row.start_date,
    deadline: row.deadline,
    status: row.status,
    forecastDate: row.forecast_date,
    confidence: row.confidence,
    priority: row.priority,
  }
}

/**
 * Reads from Supabase `goals` once a project is connected; falls back to
 * the seed goals (with honest null/insufficient-data values, never a
 * fabricated current value) when Supabase isn't configured yet — see
 * lib/supabase.ts for what "not configured" means.
 */
export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async (): Promise<GoalWithProgress[]> => {
      if (!supabase) {
        return SEED_GOALS.map((g, i) => toGoalWithProgress({ ...g, id: `seed-${i}` }))
      }
      const { data, error } = await supabase.from('goals').select('*').order('priority', { ascending: true })
      if (error) throw error
      return (data as GoalRow[]).map(mapGoalRow).map(toGoalWithProgress)
    },
  })
}

function toGoalWithProgress(goal: Goal): GoalWithProgress {
  const percent = goalProgressPercent(goal.startValue, goal.currentValue, goal.targetValue)
  const status = computeGoalStatus({
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    deadline: goal.deadline,
    forecastDate: goal.forecastDate ? new Date(goal.forecastDate) : null,
  })
  return { goal: { ...goal, status }, percent }
}
