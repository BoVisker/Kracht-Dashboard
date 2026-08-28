import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { SessionMovementType, SessionSubtype } from '../lib/training/classifySession'

export interface SessionClassificationOverride {
  sessionId: string
  types: SessionMovementType[]
  subtype: SessionSubtype
}

interface OverrideRow {
  session_id: string
  types: SessionMovementType[]
  subtype: SessionSubtype
}

/** Keyed by session_id -- TrainingPage looks up "is there an override for this session" by id, same shape as useClusterRequirementOverrides. */
export function useSessionClassificationOverrides() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['session_classification_overrides', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Record<string, SessionClassificationOverride>> => {
      const { data, error } = await supabase!.from('session_classification_overrides').select('session_id, types, subtype')
      if (error) throw error
      const byId: Record<string, SessionClassificationOverride> = {}
      for (const row of data as OverrideRow[]) {
        byId[row.session_id] = { sessionId: row.session_id, types: row.types, subtype: row.subtype }
      }
      return byId
    },
  })
}

export function useSetSessionClassificationOverride() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SessionClassificationOverride) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('session_classification_overrides').upsert(
        {
          session_id: input.sessionId,
          user_id: session.user.id,
          types: input.types,
          subtype: input.subtype,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session_classification_overrides', session?.user.id] }),
  })
}

export function useResetSessionClassificationOverride() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('session_classification_overrides').delete().eq('session_id', sessionId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session_classification_overrides', session?.user.id] }),
  })
}
