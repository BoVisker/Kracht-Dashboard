import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { GoalCategory } from '../lib/types/canonical'

export interface GoalInput {
  name: string
  category: GoalCategory
  unit: string
  targetValue: number
  startValue: number | null
  deadline: string | null
  exerciseId: string | null
  priority: number
}

export interface GoalUpdateInput {
  name: string
  targetValue: number
  deadline: string | null
  priority: number
}

/**
 * Direct client-side CRUD, not an Edge Function -- unlike provider_tokens,
 * the goals table already has a full owner RLS policy (see migration
 * 0001), so there's no secret to protect and no reason to add a network
 * hop. All three mutations invalidate the same query the read hooks use
 * (useGoals' ['goals'] key), so the Goals page and Settings stay in sync.
 */
export function useGoalMutations() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['goals'] })

  const create = useMutation({
    mutationFn: async (input: GoalInput) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('goals').insert({
        user_id: session.user.id,
        name: input.name,
        category: input.category,
        unit: input.unit,
        target_value: input.targetValue,
        start_value: input.startValue,
        deadline: input.deadline,
        exercise_id: input.exerciseId,
        priority: input.priority,
        status: 'insufficient_data',
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: GoalUpdateInput }) => {
      if (!supabase) throw new Error('Supabase is niet geconfigureerd.')
      const { error } = await supabase
        .from('goals')
        .update({
          name: input.name,
          target_value: input.targetValue,
          deadline: input.deadline,
          priority: input.priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is niet geconfigureerd.')
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
