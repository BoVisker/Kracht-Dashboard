import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { GoalCard } from '../components/GoalCard'
import { useGoals } from '../hooks/useGoals'
import { useAchievements } from '../hooks/useAchievements'
import { isSupabaseConfigured } from '../lib/supabase'

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Command Center — brief section 30/54: goals-on-schedule first, then
 * strength/cardio/Cluster 6 trend, then last session, then the week plan.
 * Every section shows "insufficient data" honestly rather than a number
 * until Supabase + a real sync are connected — see Sync page.
 */
export function DashboardPage() {
  const { data: goals, isLoading } = useGoals()
  const { data: achievements, isLoading: achievementsLoading } = useAchievements()
  const topGoals = goals?.slice(0, 3) ?? []
  const recentAchievements = achievements?.slice(0, 3) ?? []

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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-text-secondary uppercase">Achievements</h2>
          <Link to="/achievements" className="text-xs font-semibold text-accent-text hover:underline">
            Alles bekijken →
          </Link>
        </div>
        <Card>
          {achievementsLoading ? (
            <InsufficientData label="Laden…" />
          ) : recentAchievements.length === 0 ? (
            <InsufficientData label="Nog geen PR's gevonden. Records verschijnen automatisch zodra een set een eerder record verbetert." />
          ) : (
            <div className="flex flex-col divide-y divide-gridline">
              {recentAchievements.map((event, i) => (
                <div key={`${event.exerciseId}-${event.kind}-${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-text-primary">{event.exerciseName}</span>
                  <span className="text-text-muted">
                    {event.detail} · {formatDate(event.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
