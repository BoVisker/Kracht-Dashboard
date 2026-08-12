import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { RecoveryMetric, RecoverySource } from '../lib/types/canonical'
import type { ParsedRecoveryRow } from '../lib/recovery/parseRecoveryImport'

interface RecoveryMetricRow {
  id: string
  date: string
  source: RecoverySource
  resting_heart_rate: number | null
  hrv_ms: number | null
  sleep_duration_minutes: number | null
  sleep_score: number | null
  body_battery: number | null
  stress_average: number | null
  notes: string | null
}

function mapRow(row: RecoveryMetricRow): RecoveryMetric {
  return {
    id: row.id,
    date: row.date,
    source: row.source,
    restingHeartRate: row.resting_heart_rate,
    hrvMs: row.hrv_ms,
    sleepDurationMinutes: row.sleep_duration_minutes,
    sleepScore: row.sleep_score,
    bodyBattery: row.body_battery,
    stressAverage: row.stress_average,
    notes: row.notes,
  }
}

export function useRecoveryMetrics() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['recovery_metrics', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<RecoveryMetric[]> => {
      const { data, error } = await supabase!.from('recovery_metrics').select('*').order('date', { ascending: false })
      if (error) throw error
      return (data as RecoveryMetricRow[]).map(mapRow)
    },
  })
}

export interface LogRecoveryMetricInput {
  date: string
  restingHeartRate: number | null
  hrvMs: number | null
  sleepDurationMinutes: number | null
  sleepScore: number | null
  bodyBattery: number | null
  stressAverage: number | null
  notes: string | null
}

/** One row per day (unique user_id+date, see migration 0004) -- upsert so re-entering the same day overwrites instead of erroring or duplicating. */
export function useLogRecoveryMetric() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LogRecoveryMetricInput) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      const { error } = await supabase.from('recovery_metrics').upsert(
        {
          user_id: session.user.id,
          date: input.date,
          source: 'manual' as RecoverySource,
          resting_heart_rate: input.restingHeartRate,
          hrv_ms: input.hrvMs,
          sleep_duration_minutes: input.sleepDurationMinutes,
          sleep_score: input.sleepScore,
          body_battery: input.bodyBattery,
          stress_average: input.stressAverage,
          notes: input.notes,
        },
        { onConflict: 'user_id,date' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recovery_metrics', session?.user.id] }),
  })
}

/** Bulk upsert for a parsed CSV/JSON import -- same one-row-per-day upsert semantics as manual entry, just many rows at once. */
export function useImportRecoveryMetrics() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: ParsedRecoveryRow[]) => {
      if (!supabase || !session) throw new Error('Niet ingelogd.')
      if (!rows.length) return
      const payload = rows.map((r) => ({
        user_id: session.user.id,
        date: r.date,
        source: 'garmin_csv' as RecoverySource,
        resting_heart_rate: r.restingHeartRate,
        hrv_ms: r.hrvMs,
        sleep_duration_minutes: r.sleepDurationMinutes,
        sleep_score: r.sleepScore,
        body_battery: r.bodyBattery,
        stress_average: r.stressAverage,
      }))
      const { error } = await supabase.from('recovery_metrics').upsert(payload, { onConflict: 'user_id,date' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recovery_metrics', session?.user.id] }),
  })
}
