import type { FitnessDataProvider, ProviderStatus } from './FitnessDataProvider'

/**
 * Frontend-side descriptor only. The actual Hevy API key and HTTP calls
 * live in supabase/functions/hevy-sync — Hevy auth is a single static
 * `api-key` header (no OAuth, confirmed against their published OpenAPI
 * spec), which makes it exactly the kind of secret that must never reach
 * the browser bundle deployed to GitHub Pages. This file only describes
 * what Hevy can do and lets the UI ask Supabase for the last-known status.
 */
export const hevyProvider: FitnessDataProvider = {
  id: 'hevy',
  label: 'Hevy',
  capabilities: {
    strengthTraining: true,
    cardio: false,
    recovery: false,
    webhooks: false, // Hevy has no webhooks; /v1/workouts/events is polled instead.
    incrementalSync: true,
  },
  status(): ProviderStatus {
    // Real status comes from the `integrations` table (last_sync_at, last_error),
    // fetched via useIntegrationStatus() — this static fallback only covers
    // the case where that query hasn't resolved yet.
    return {
      availability: 'not_configured',
      detail: 'Nog niet gekoppeld. Vereist een Hevy Pro-abonnement en een API-sleutel uit hevy.com/settings?developer.',
      lastSyncAt: null,
    }
  },
}
