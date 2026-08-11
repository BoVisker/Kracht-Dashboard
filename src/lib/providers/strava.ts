import type { FitnessDataProvider, ProviderStatus } from './FitnessDataProvider'

/**
 * Frontend-side descriptor only — the OAuth client secret and token
 * exchange happen in supabase/functions/strava-oauth-callback and
 * strava-webhook. The browser only ever sees the Strava client ID
 * (public by design in OAuth2 authorization-code flow) to build the
 * "Connect Strava" link; it never sees the client secret or refresh token.
 */
export const stravaProvider: FitnessDataProvider = {
  id: 'strava',
  label: 'Strava',
  capabilities: {
    strengthTraining: false,
    cardio: true,
    recovery: false,
    webhooks: true,
    incrementalSync: true,
  },
  status(): ProviderStatus {
    return {
      availability: 'not_configured',
      detail: 'Nog niet gekoppeld. Klik "Connect Strava" om de OAuth-flow te starten.',
      lastSyncAt: null,
    }
  },
}
