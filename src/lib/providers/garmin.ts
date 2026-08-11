import type { FitnessDataProvider, ProviderStatus } from './FitnessDataProvider'

/**
 * Deliberately unimplemented. Garmin Connect Developer Program access is
 * partner/enterprise-only (legal entity required; production Health API
 * access carries a $5,000 one-time fee) and, as of this writing, new
 * sign-ups appear to be on hold entirely — there is no self-serve path for
 * an individual to pull their own Garmin data via an official API.
 *
 * This adapter exists so the rest of the system (provider lists, the Sync
 * Center page, the FitnessDataProvider interface) already has a slot for
 * Garmin. Re-check developer.garmin.com/gc-developer-program/ before ever
 * flipping `availability` away from 'unavailable' — do not build a scraper
 * or unofficial workaround as a substitute.
 */
export const garminProvider: FitnessDataProvider = {
  id: 'garmin',
  label: 'Garmin',
  capabilities: {
    strengthTraining: false,
    cardio: true,
    recovery: true,
    webhooks: true,
    incrementalSync: true,
  },
  status(): ProviderStatus {
    return {
      availability: 'unavailable',
      detail:
        'Garmin Connect Developer Program is alleen voor bedrijven/instellingen (geen self-serve toegang voor individuele ontwikkelaars). Controleer developer.garmin.com voor de actuele status.',
      lastSyncAt: null,
    }
  },
}
