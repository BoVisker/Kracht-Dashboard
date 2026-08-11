import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { ProviderAvailability } from '../lib/providers/FitnessDataProvider'

export interface IntegrationRow {
  provider: 'hevy' | 'strava' | 'garmin'
  status: ProviderAvailability
  last_sync_at: string | null
  last_error: string | null
}

/**
 * Real status from the `integrations` table once Supabase + auth are in
 * place; the static provider.status() fallback in lib/providers/*.ts only
 * covers the "nothing to query yet" case (see SyncPage).
 */
export function useIntegrationStatus() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['integrations', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<IntegrationRow[]> => {
      const { data, error } = await supabase!.from('integrations').select('provider, status, last_sync_at, last_error')
      if (error) throw error
      return data as IntegrationRow[]
    },
  })
}

export function useInvalidateIntegrations() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['integrations'] })
}
