import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface ClusterRequirementOverride {
  requirementId: string
  targetValue: number | null
  bufferMargin: number | null
  strongBufferMargin: number | null
}

interface OverrideRow {
  requirement_id: string
  target_value: number | null
  buffer_margin: number | null
  strong_buffer_margin: number | null
}

/** Keyed by requirement_id -- Cluster6Page/Settings look up "is there an override for this requirement" by id, not by scanning a list. */
export function useClusterRequirementOverrides() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['cluster_requirement_overrides', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Record<string, ClusterRequirementOverride>> => {
      const { data, error } = await supabase!.from('cluster_requirement_overrides').select('requirement_id, target_value, buffer_margin, strong_buffer_margin')
      if (error) throw error
      const byId: Record<string, ClusterRequirementOverride> = {}
      for (const row of data as OverrideRow[]) {
        byId[row.requirement_id] = { requirementId: row.requirement_id, targetValue: row.target_value, bufferMargin: row.buffer_margin, strongBufferMargin: row.strong_buffer_margin }
      }
      return byId
    },
  })
}

export function useSetClusterRequirementOverride() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClusterRequirementOverride) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('cluster_requirement_overrides').upsert(
        {
          user_id: session.user.id,
          requirement_id: input.requirementId,
          target_value: input.targetValue,
          buffer_margin: input.bufferMargin,
          strong_buffer_margin: input.strongBufferMargin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,requirement_id' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster_requirement_overrides', session?.user.id] }),
  })
}

export function useResetClusterRequirementOverride() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requirementId: string) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('cluster_requirement_overrides').delete().eq('requirement_id', requirementId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cluster_requirement_overrides', session?.user.id] }),
  })
}
