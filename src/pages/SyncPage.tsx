import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { hevyProvider } from '../lib/providers/hevy'
import { stravaProvider } from '../lib/providers/strava'
import { garminProvider } from '../lib/providers/garmin'
import type { ProviderAvailability } from '../lib/providers/FitnessDataProvider'
import { isSupabaseConfigured } from '../lib/supabase'

const AVAILABILITY_LABEL: Record<ProviderAvailability, string> = {
  connected: 'Connected',
  not_configured: 'Not configured',
  error: 'Error',
  unavailable: 'Unavailable',
}

const AVAILABILITY_TONE: Record<ProviderAvailability, BadgeTone> = {
  connected: 'good',
  not_configured: 'neutral',
  error: 'crit',
  unavailable: 'warn',
}

export function SyncPage() {
  const providers = [hevyProvider, stravaProvider, garminProvider]

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Sync Center</h2>
      <p className="mb-4 text-sm text-text-secondary">Connectiestatus per bron. Secrets (API-sleutels, OAuth-tokens) blijven server-side — zie ARCHITECTURE.md.</p>

      {!isSupabaseConfigured() && (
        <div className="mb-4 rounded-lg border border-status-warn/40 bg-status-warn/10 px-4 py-3 text-sm">
          Geen Supabase-project gekoppeld. Zonder backend kan geen enkele sync daadwerkelijk draaien — zie README.md "Setup" voor de stappen.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {providers.map((provider) => {
          const status = provider.status()
          return (
            <Card key={provider.id} title={provider.label}>
              <div className="mb-3">
                <Badge tone={AVAILABILITY_TONE[status.availability]}>{AVAILABILITY_LABEL[status.availability]}</Badge>
              </div>
              <p className="mb-3 text-sm text-text-secondary">{status.detail}</p>
              <dl className="space-y-1 text-xs text-text-muted">
                <div className="flex justify-between">
                  <dt>Strength training</dt>
                  <dd>{provider.capabilities.strengthTraining ? 'ja' : 'nee'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Cardio</dt>
                  <dd>{provider.capabilities.cardio ? 'ja' : 'nee'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Webhooks</dt>
                  <dd>{provider.capabilities.webhooks ? 'ja' : 'nee'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Incremental sync</dt>
                  <dd>{provider.capabilities.incrementalSync ? 'ja' : 'nee'}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={status.availability !== 'connected'}
                className="mt-4 min-h-11 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sync now
              </button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
