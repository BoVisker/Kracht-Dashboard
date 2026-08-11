import { useState, type FormEvent } from 'react'
import { saveProviderToken } from '../lib/providers/api'
import { useInvalidateIntegrations } from '../hooks/useIntegrationStatus'

export function HevyKeyForm() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const invalidateIntegrations = useInvalidateIntegrations()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    const { error } = await saveProviderToken({ provider: 'hevy', accessToken: apiKey })
    if (error) {
      setStatus('error')
      setError(error)
      return
    }
    setStatus('saved')
    setApiKey('')
    invalidateIntegrations()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="hevyKey" className="text-xs text-text-secondary">
        Hevy API-sleutel (uit hevy.com/settings?developer, vereist Hevy Pro)
      </label>
      <div className="flex gap-2">
        <input
          id="hevyKey"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          required
          className="min-h-11 flex-1 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
        />
        <button
          type="submit"
          disabled={status === 'saving'}
          className="min-h-11 rounded-md bg-series-1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {status === 'saving' ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
      {status === 'saved' && <p className="text-xs text-status-good">Opgeslagen — ga naar Sync om te synchroniseren.</p>}
      {status === 'error' && <p className="text-xs text-status-crit">{error}</p>}
      <p className="text-xs text-text-muted">Deze sleutel wordt direct server-side opgeslagen (nooit in de browser bewaard) en is nergens anders zichtbaar dan hier tijdens het invoeren.</p>
    </form>
  )
}
