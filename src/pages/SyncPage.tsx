import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { hevyProvider } from '../lib/providers/hevy'
import { stravaProvider } from '../lib/providers/strava'
import { garminProvider } from '../lib/providers/garmin'
import type { FitnessDataProvider, ProviderAvailability } from '../lib/providers/FitnessDataProvider'
import { isSupabaseConfigured } from '../lib/supabase'
import { useIntegrationStatus, useInvalidateIntegrations, type IntegrationRow } from '../hooks/useIntegrationStatus'
import { triggerSync } from '../lib/providers/api'
import { buildStravaAuthorizeUrl, isStravaConfigured } from '../lib/providers/stravaOAuth'

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

/** Providers with a real, deployed sync function today. Garmin has none (see lib/providers/garmin.ts). */
const SYNCABLE_PROVIDERS = new Set(['hevy', 'strava'])

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'nooit'
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SyncPage() {
  const providers = [hevyProvider, stravaProvider, garminProvider]
  const { data: rows, isLoading } = useIntegrationStatus()
  const invalidateIntegrations = useInvalidateIntegrations()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const rowFor = (id: string): IntegrationRow | undefined => rows?.find((r) => r.provider === id)

  async function handleSync(provider: FitnessDataProvider) {
    if (!SYNCABLE_PROVIDERS.has(provider.id)) return
    setSyncing(provider.id)
    setSyncMessage(null)
    const result = await triggerSync(provider.id as 'hevy' | 'strava')
    setSyncing(null)
    if (result.error) {
      setSyncMessage(`Fout: ${result.error}`)
    } else {
      const noun = provider.id === 'hevy' ? 'sets' : 'cardio-sessies'
      let message = `${result.upserted ?? 0} ${noun} bijgewerkt uit ${result.fetched ?? 0} ${provider.id === 'hevy' ? 'workouts' : 'activiteiten'}.`
      if (provider.id === 'hevy') {
        if (result.deleted) message += ` ${result.deleted} verwijderde workout(s) opgeruimd.`
        if (result.mode) message += ` (${result.mode === 'incremental' ? 'incrementeel' : 'volledige refresh'})`
      }
      setSyncMessage(message)
    }
    invalidateIntegrations()
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Sync Center</h2>
      <p className="mb-4 text-sm text-text-secondary">Connectiestatus per bron. Secrets (API-sleutels, OAuth-tokens) blijven server-side — zie ARCHITECTURE.md.</p>

      {!isSupabaseConfigured() && (
        <div className="mb-4 rounded-lg border border-status-warn/40 bg-status-warn/10 px-4 py-3 text-sm">
          Geen Supabase-project gekoppeld. Zonder backend kan geen enkele sync daadwerkelijk draaien — zie README.md "Setup" voor de stappen.
        </div>
      )}
      {syncMessage && <div className="mb-4 rounded-lg border border-border bg-card-bg px-4 py-3 text-sm">{syncMessage}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {providers.map((provider) => {
          const row = rowFor(provider.id)
          const fallbackStatus = provider.status()
          const availability = row?.status ?? fallbackStatus.availability
          const connected = availability === 'connected'
          // row.last_error is legitimately null once connected (nothing went
          // wrong) -- falling back to the generic "not connected" copy in
          // that case was misleading, since the account IS connected.
          const detail = connected ? `Verbonden. Klik "Sync now" om de laatste data op te halen.` : (row?.last_error ?? fallbackStatus.detail)
          const canSync = SYNCABLE_PROVIDERS.has(provider.id) && connected
          const showConnectStrava = provider.id === 'strava' && !connected && isSupabaseConfigured()

          return (
            <Card key={provider.id} title={provider.label}>
              <div className="mb-3">
                <Badge tone={AVAILABILITY_TONE[availability]}>{AVAILABILITY_LABEL[availability]}</Badge>
              </div>
              <p className="mb-3 text-sm text-text-secondary">{detail}</p>
              {row?.last_sync_at !== undefined && (
                <p className="mb-3 text-xs text-text-muted">Laatste sync: {isLoading ? '…' : formatSyncTime(row?.last_sync_at ?? null)}</p>
              )}
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

              {showConnectStrava ? (
                isStravaConfigured() ? (
                  <a
                    href={buildStravaAuthorizeUrl()}
                    className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-series-1 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Connect Strava
                  </a>
                ) : (
                  <p className="mt-4 text-xs text-text-muted">VITE_STRAVA_CLIENT_ID ontbreekt — zie README.md "Strava" setup.</p>
                )
              ) : (
                <button
                  type="button"
                  disabled={!canSync || syncing === provider.id}
                  onClick={() => handleSync(provider)}
                  className="mt-4 min-h-11 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {syncing === provider.id ? 'Bezig…' : 'Sync now'}
                </button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
