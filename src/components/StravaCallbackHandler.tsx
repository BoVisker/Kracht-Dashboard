import { useEffect, useRef, useState } from 'react'
import { exchangeStravaCode } from '../lib/providers/stravaOAuth'
import { subscribeStravaWebhook } from '../lib/providers/api'
import { useInvalidateIntegrations } from '../hooks/useIntegrationStatus'

/**
 * Strava's redirect_uri is this app's own root URL (see stravaOAuth.ts) --
 * with HashRouter that means `?code=...` always lands on window.location
 * .search regardless of which hash route ends up rendering, so this needs
 * to run once at the app shell level rather than inside a specific route.
 */
export function StravaCallbackHandler() {
  const ranOnce = useRef(false)
  const [status, setStatus] = useState<'idle' | 'exchanging' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const invalidateIntegrations = useInvalidateIntegrations()

  useEffect(() => {
    if (ranOnce.current) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return
    ranOnce.current = true

    setStatus('exchanging')
    exchangeStravaCode(code).then(({ error }) => {
      // Strip ?code=&scope=... from the URL either way -- retrying with a
      // stale/used code would just fail again, and a raw OAuth code sitting
      // in the address bar/history is worth clearing regardless of outcome.
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      if (error) {
        setStatus('error')
        setError(error)
      } else {
        setStatus('idle')
        invalidateIntegrations()
        // Fire-and-forget: sets up push-based updates going forward. Not
        // critical path -- "Sync now" polling works regardless of whether
        // this succeeds, so a failure here doesn't need to surface as an
        // error to the user (it already has its own retry via the Sync
        // page next time a manual sync happens to prompt a resubscribe).
        void subscribeStravaWebhook()
      }
    })
  }, [invalidateIntegrations])

  if (status === 'exchanging') {
    return (
      <div className="mb-4 rounded-lg border border-border bg-card-bg px-4 py-3 text-sm text-text-secondary">Strava koppelen…</div>
    )
  }
  if (status === 'error') {
    return (
      <div className="mb-4 rounded-lg border border-status-crit/40 bg-status-crit/10 px-4 py-3 text-sm text-text-primary">
        Strava-koppeling mislukt: {error}
      </div>
    )
  }
  return null
}
