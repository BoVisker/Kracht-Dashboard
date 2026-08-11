import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth/useAuth'
import type { CardioSession, DataSource, DataQuality } from '../lib/types/canonical'

/** Raw shape of a `cardio_sessions` row exactly as Postgres/PostgREST returns it (snake_case). */
interface CardioSessionRow {
  id: string
  source: DataSource
  external_id: string | null
  sport: string
  date: string
  moving_time_seconds: number | null
  elapsed_time_seconds: number | null
  distance_meters: number | null
  average_speed_ms: number | null
  elevation_gain_meters: number | null
  average_heart_rate: number | null
  max_heart_rate: number | null
  average_power: number | null
  average_cadence: number | null
  calories: number | null
  quality: DataQuality
}

/** Same snake_case -> camelCase gap as goals -- see hooks/useGoals.ts's mapGoalRow comment. */
function mapCardioSessionRow(row: CardioSessionRow): CardioSession {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    sport: row.sport,
    date: row.date,
    movingTimeSeconds: row.moving_time_seconds,
    elapsedTimeSeconds: row.elapsed_time_seconds,
    distanceMeters: row.distance_meters,
    averageSpeedMs: row.average_speed_ms,
    elevationGainMeters: row.elevation_gain_meters,
    averageHeartRate: row.average_heart_rate,
    maxHeartRate: row.max_heart_rate,
    averagePower: row.average_power,
    averageCadence: row.average_cadence,
    calories: row.calories,
    quality: row.quality,
  }
}

export function useCardioSessions() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['cardio_sessions', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<CardioSession[]> => {
      const { data, error } = await supabase!.from('cardio_sessions').select('*').order('date', { ascending: false })
      if (error) throw error
      return (data as CardioSessionRow[]).map(mapCardioSessionRow)
    },
  })
}
