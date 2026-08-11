import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { GoalCard } from '../components/GoalCard'
import { useGoals } from '../hooks/useGoals'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Command Center — brief section 30/54: goals-on-schedule first, then
 * strength/cardio/Cluster 6 trend, then last session, then the week plan.
 * Every section shows "insufficient data" honestly rather than a number
 * until Supabase + a real sync are connected — see Sync page.
 */
export function DashboardPage() {
  const { data: goals, isLoading } = useGoals()
  const topGoals = goals?.slice(0, 3) ?? []

  return (
    <div className="flex flex-col gap-6">
      {!isSupabaseConfigured() && (
        <div className="rounded-lg border border-status-warn/40 bg-status-warn/10 px-4 py-3 text-sm text-text-primary">
          Nog niet gekoppeld aan een database. Doelen hieronder zijn seed-data zonder gemeten voortgang — zie{' '}
          <Link to="/sync" className="font-semibold text-accent-text underline">
            Sync
          </Link>{' '}
          om Hevy/Strava en Supabase te koppelen.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">Today</h2>
        <Card>
          <InsufficientData label="Geen trainingsplan-koppeling actief — te configureren in Settings." />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">Goals</h2>
        {isLoading ? (
          <Card>
            <InsufficientData label="Laden…" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {topGoals.map(({ goal, percent }) => (
              <GoalCard key={goal.id} goal={goal} percent={percent} />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Strength trend">
          <InsufficientData />
        </Card>
        <Card title="Cardio trend">
          <InsufficientData />
        </Card>
        <Card title="Cluster 6 readiness">
          <InsufficientData />
          <Link to="/cluster-6" className="mt-2 block text-sm font-semibold text-accent-text">
            Bekijk vereisten →
          </Link>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">Recent</h2>
        <Card>
          <InsufficientData label="Nog geen sessies gesynchroniseerd." />
        </Card>
      </section>
    </div>
  )
}
