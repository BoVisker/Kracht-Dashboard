import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface ExerciseListEntry {
  id: string
  canonicalName: string
  setCount: number
  isPinned: boolean
}

interface ExerciseListRow {
  id: string
  canonical_name: string
  is_pinned: boolean
  sets: { count: number }[]
}

export function useExercisesList() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['exercises_list', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<ExerciseListEntry[]> => {
      const { data, error } = await supabase!
        .from('exercises')
        .select('id, canonical_name, is_pinned, sets(count)')
        .order('canonical_name', { ascending: true })
      if (error) throw error
      return (data as ExerciseListRow[])
        .map((row) => ({ id: row.id, canonicalName: row.canonical_name, setCount: row.sets[0]?.count ?? 0, isPinned: row.is_pinned }))
        .filter((e) => e.setCount > 0)
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return b.setCount - a.setCount
        })
    },
  })
}

/** Server-side, not localStorage -- the user asked for this to sync between phone and computer. */
export function useTogglePinExercise() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      if (!supabase) throw new Error('Supabase is niet geconfigureerd.')
      const { error } = await supabase.from('exercises').update({ is_pinned: pinned }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises_list', session?.user.id] })
    },
  })
}
