import type { CardioSession, TrainingSession } from '../types/canonical'

/**
 * Every external fitness data source implements this. The rest of the app
 * (sync orchestration, analytics, UI) depends only on this interface, never
 * on a specific provider's API shape — adding a new source later means
 * writing one adapter, not touching anything downstream.
 *
 * Adapters that hold secrets (API keys, OAuth client secrets) only run
 * server-side, inside Supabase Edge Functions — see
 * supabase/functions/*-sync. The frontend never imports those; it only
 * imports the status/capability shapes below.
 */
export interface FitnessDataProvider {
  readonly id: 'hevy' | 'strava' | 'garmin'
  readonly label: string
  readonly capabilities: ProviderCapabilities

  /** Whether this provider is actually usable right now (not just "designed for"). */
  status(): ProviderStatus
}

export interface ProviderCapabilities {
  strengthTraining: boolean
  cardio: boolean
  recovery: boolean
  webhooks: boolean
  incrementalSync: boolean
}

export type ProviderAvailability =
  | 'connected'
  | 'not_configured'
  | 'error'
  | 'unavailable'

export interface ProviderStatus {
  availability: ProviderAvailability
  /** Human explanation — especially for 'unavailable', e.g. Garmin's enterprise-only access. */
  detail: string
  lastSyncAt: string | null
}

export interface SyncResult {
  provider: FitnessDataProvider['id']
  startedAt: string
  finishedAt: string
  recordsFetched: number
  recordsUpserted: number
  recordsDeleted: number
  errors: string[]
}

/** Shape an adapter's raw fetch normalizes into before DB upsert. Used server-side only. */
export interface NormalizedImport {
  trainingSessions: TrainingSession[]
  cardioSessions: CardioSession[]
}
