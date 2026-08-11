import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { Card } from '../components/ui/Card'

export function LoginPage() {
  const { session, loading, signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <Card title="Nog niet gekoppeld">
          <p className="text-sm text-text-secondary">
            Er is nog geen Supabase-project geconfigureerd (<code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> ontbreken). Volg de setup-stappen in{' '}
            <code>README.md</code> om in te kunnen loggen.
          </p>
        </Card>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <Card title="Sport Performance Dashboard" subtitle="Log in met het account dat je in Supabase Auth hebt aangemaakt.">
        {loading ? (
          <p className="text-sm text-text-muted">Laden…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs text-text-secondary">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs text-text-secondary">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
              />
            </div>
            {error && <p className="text-sm text-status-crit">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-md bg-series-1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Bezig…' : 'Inloggen'}
            </button>
          </form>
        )}
      </Card>
    </div>
  )
}
