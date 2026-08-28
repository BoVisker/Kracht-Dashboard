/**
 * Canonical domain model. Every data source (Hevy, Strava, Garmin, manual
 * entry) maps INTO these shapes before anything in the app touches them —
 * analytics and UI never see a Hevy workout or a Strava activity directly.
 * See ARCHITECTURE.md, "Canonical data model".
 */

export type DataSource = 'hevy' | 'strava' | 'garmin' | 'manual'

/** How much to trust a value. Never render a number without knowing this. */
export type DataQuality = 'verified' | 'imported' | 'estimated' | 'missing' | 'conflicting'

export interface TrainingSession {
  id: string
  source: DataSource
  externalId: string | null
  date: string // ISO date
  startTime: string | null
  endTime: string | null
  durationSeconds: number | null
  trainingType: 'push' | 'pull' | 'legs' | 'cardio' | 'rest' | 'other'
  trainingSubtype: 'heavy' | 'volume' | null
  plannedSessionId: string | null
  perceivedExertion: number | null // RPE 1-10, if logged
  notes: string | null
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

/** One slot in the repeating weekly template -- not tied to a calendar date. See migration 0006. */
export interface PlannedSession {
  id: string
  dayOfWeek: DayOfWeek
  sortOrder: number
  trainingType: 'push' | 'pull' | 'legs' | 'cardio' | 'rest' | 'other'
  trainingSubtype: 'heavy' | 'volume' | null
  label: string
  notes: string | null
}

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'carry'
  | 'core'
  | 'other'

export interface ExerciseDefinition {
  id: string
  canonicalName: string
  sourceNames: Partial<Record<DataSource, string>>
  muscleGroupsPrimary: string[]
  muscleGroupsSecondary: string[]
  movementPattern: MovementPattern
  equipment: string | null
  classification: 'strength' | 'hypertrophy' | 'both'
  /** kg increment this exercise is realistically loaded in — drives goal-engine step sizing. */
  loadIncrementKg: number
}

export type SetType = 'warmup' | 'work' | 'failure' | 'dropset' | 'amrap'

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  setIndex: number
  setType: SetType
  weightKg: number | null
  bodyweightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  rir: number | null
  tempo: string | null
  quality: DataQuality
}

export interface CardioSession {
  id: string
  source: DataSource
  externalId: string | null
  sport: string
  date: string
  movingTimeSeconds: number | null
  elapsedTimeSeconds: number | null
  distanceMeters: number | null
  averageSpeedMs: number | null
  elevationGainMeters: number | null
  averageHeartRate: number | null
  maxHeartRate: number | null
  averagePower: number | null
  averageCadence: number | null
  calories: number | null
  quality: DataQuality
}

export type GoalCategory =
  | 'strength'
  | 'reps'
  | 'bodyweight_calisthenics'
  | 'cardio_distance'
  | 'cardio_time'
  | 'cluster6'
  | 'bodyweight'
  | 'consistency'
  | 'training_volume'

export type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'insufficient_data' | 'achieved' | 'expired'

export interface Goal {
  id: string
  name: string
  category: GoalCategory
  exerciseId: string | null
  unit: string
  startValue: number | null
  currentValue: number | null
  targetValue: number
  startDate: string
  deadline: string | null
  status: GoalStatus
  /** Only ever a heuristic forecast — see goalEngine.ts. Null when data is insufficient. */
  forecastDate: string | null
  confidence: 'low' | 'medium' | 'high' | null
  priority: number
}

export interface PersonalRecord {
  id: string
  exerciseId: string
  kind: 'weight' | 'reps' | 'volume' | 'estimated_1rm' | 'distance' | 'pace'
  value: number
  unit: string
  achievedAt: string
  sessionId: string | null
  previousValue: number | null
}

export type RecoverySource = 'manual' | 'garmin_csv' | 'garmin_export'

/** One row per calendar day -- unlike a PersonalRecord or ClusterTest, a resting heart rate isn't a repeatable "attempt", it's a daily fact. */
export interface RecoveryMetric {
  id: string
  date: string
  source: RecoverySource
  restingHeartRate: number | null
  hrvMs: number | null
  sleepDurationMinutes: number | null
  sleepScore: number | null
  bodyBattery: number | null
  stressAverage: number | null
  notes: string | null
}
