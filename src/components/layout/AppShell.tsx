import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'
import { StravaCallbackHandler } from '../StravaCallbackHandler'

const NAV_ITEMS = [
  { to: '/', label: 'Command Center', end: true },
  { to: '/goals', label: 'Goals' },
  { to: '/training', label: 'Training' },
  { to: '/cardio', label: 'Cardio' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/cluster-6', label: 'Cluster 6' },
  { to: '/sync', label: 'Sync' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-page-plane text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold">Sport Performance Dashboard</h1>
            <p className="text-sm text-text-secondary">Word ik daadwerkelijk beter?</p>
          </div>
          {session && (
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="hidden sm:inline">{session.user.email}</span>
              <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-md border border-border px-3 py-1.5 font-semibold text-text-secondary hover:text-text-primary">
                Log uit
              </button>
            </div>
          )}
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6" aria-label="Hoofdnavigatie">
          <ul className="flex gap-1 border-t border-border/0">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block min-h-11 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                      isActive ? 'border-series-1 text-accent-text' : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <StravaCallbackHandler />
        <Outlet />
      </main>
    </div>
  )
}
