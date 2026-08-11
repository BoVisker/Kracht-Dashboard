import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SEED_GOALS } from '../data/seedGoals'
import { computeGoalStatus, goalProgressPercent } from '../lib/goals/goalEngine'
import type { Goal } from '../lib/types/canonical'

export interface GoalWithProgress {
  goal: Goal
  percent: number | null
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
      return (data as Goal[]).map(toGoalWithProgress)
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
