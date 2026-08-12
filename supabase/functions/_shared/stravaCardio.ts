// Shared by strava-sync (bulk) and strava-webhook (single-activity) --
// both need the exact same Strava-activity -> cardio_sessions row mapping.

export interface StravaActivity {
  id: number
  name?: string
  type?: string
  sport_type?: string
  start_date?: string
  moving_time?: number
  elapsed_time?: number
  distance?: number
  average_speed?: number
  total_elevation_gain?: number
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  average_cadence?: number
}

/** calories stays null -- not available from either the activity-list or activity-detail endpoint without extra per-activity requests Strava's rate limits don't justify for this. */
export function mapActivityToCardioRow(userId: string, a: StravaActivity) {
  return {
    user_id: userId,
    source: 'strava',
    external_id: String(a.id),
    sport: a.sport_type ?? a.type ?? 'Unknown',
    date: (a.start_date ?? new Date().toISOString()).slice(0, 10),
    moving_time_seconds: a.moving_time ?? null,
    elapsed_time_seconds: a.elapsed_time ?? null,
    distance_meters: a.distance ?? null,
    average_speed_ms: a.average_speed ?? null,
    elevation_gain_meters: a.total_elevation_gain ?? null,
    average_heart_rate: a.average_heartrate ?? null,
    max_heart_rate: a.max_heartrate ?? null,
    average_power: a.average_watts ?? null,
    average_cadence: a.average_cadence ?? null,
    calories: null,
    quality: 'imported',
    raw: a,
  }
}
