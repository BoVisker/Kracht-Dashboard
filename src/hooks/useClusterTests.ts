import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface ClusterTestResult {
  value: number
  testedAt: string
}

interface ClusterTestRow {
  requirement_id: string
  value: number
  tested_at: string
}

/** Latest logged value per requirement_id -- older entries stay in the table as history, only the most recent drives the current status. */
export function useClusterTestResults() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['cluster_tests', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Record<string, ClusterTestResult>> => {
      const { data, error } = await supabase!.from('cluster_tests').select('requirement_id, value, tested_at').order('tested_at', { ascending: false })
      if (error) throw error
      const latest: Record<string, ClusterTestResult> = {}
      for (const row of data as ClusterTestRow[]) {
        // Already sorted newest-first, so the first row seen per requirement is the latest.
        if (!latest[row.requirement_id]) latest[row.requirement_id] = { value: row.value, testedAt: row.tested_at }
      }
      return latest
    },
  })
}

export function useLogClusterTest() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ requirementId, value }: { requirementId: string; value: number }) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('cluster_tests').insert({
        user_id: session.user.id,
        requirement_id: requirementId,
        value,
        tested_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster_tests', session?.user.id] }),
  })
}
