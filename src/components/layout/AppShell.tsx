import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Command Center', end: true },
  { to: '/goals', label: 'Goals' },
  { to: '/training', label: 'Training' },
  { to: '/cardio', label: 'Cardio' },
  { to: '/cluster-6', label: 'Cluster 6' },
  { to: '/sync', label: 'Sync' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  return (
    <div className="min-h-screen bg-page-plane text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-xl font-semibold">Sport Performance Dashboard</h1>
          <p className="text-sm text-text-secondary">Word ik daadwerkelijk beter?</p>
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
        <Outlet />
      </main>
    </div>
  )
}
