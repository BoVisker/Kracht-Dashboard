import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'

export interface Profile {
  bodyweightKg: number | null
  units: 'metric' | 'imperial'
  timezone: string
}

const DEFAULT_PROFILE: Profile = { bodyweightKg: null, units: 'metric', timezone: 'Europe/Amsterdam' }

interface ProfileRow {
  bodyweight_kg: number | null
  units: 'metric' | 'imperial'
  timezone: string
}

/** profiles has one row per user (id = auth.uid()), created lazily on first save rather than at signup -- there's no DB trigger for it, so a missing row just means defaults. */
export function useProfile() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase!.from('profiles').select('bodyweight_kg, units, timezone').eq('id', session!.user.id).maybeSingle()
      if (error) throw error
      if (!data) return DEFAULT_PROFILE
      const row = data as ProfileRow
      return { bodyweightKg: row.bodyweight_kg, units: row.units, timezone: row.timezone }
    },
  })
}

export function useUpdateProfile() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Profile>) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        ...(input.bodyweightKg !== undefined ? { bodyweight_kg: input.bodyweightKg } : {}),
        ...(input.units !== undefined ? { units: input.units } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] }),
  })
}
