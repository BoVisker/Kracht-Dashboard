import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface ExerciseListEntry {
  id: string
  canonicalName: string
  setCount: number
}

interface ExerciseListRow {
  id: string
  canonical_name: string
  sets: { count: number }[]
}

export function useExercisesList() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['exercises_list', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<ExerciseListEntry[]> => {
      const { data, error } = await supabase!.from('exercises').select('id, canonical_name, sets(count)').order('canonical_name', { ascending: true })
      if (error) throw error
      return (data as ExerciseListRow[])
        .map((row) => ({ id: row.id, canonicalName: row.canonical_name, setCount: row.sets[0]?.count ?? 0 }))
        .filter((e) => e.setCount > 0)
        .sort((a, b) => b.setCount - a.setCount)
    },
  })
}
