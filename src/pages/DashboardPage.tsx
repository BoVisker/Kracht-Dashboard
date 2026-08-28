import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { GoalCard } from '../components/GoalCard'
import { useGoals } from '../hooks/useGoals'
import { useAchievements } from '../hooks/useAchievements'
import { useReport } from '../hooks/useReports'
import { useTrainingSessions } from '../hooks/useTrainingSessions'
import { useCardioSessions } from '../hooks/useCardioSessions'
import { useClusterTestResults } from '../hooks/useClusterTests'
import { useClusterRequirementOverrides } from '../hooks/useClusterRequirementOverrides'
import { usePlannedSessions } from '../hooks/usePlannedSessions'
import { CLUSTER_6_REQUIREMENTS } from '../lib/cluster6/requirements'
import { classifyClusterResult, DEFAULT_BUFFER_CONFIG, type ClusterBufferConfig } from '../lib/cluster6/classify'
import { isSupabaseConfigured } from '../lib/supabase'
import type { DayOfWeek } from '../lib/types/canonical'

const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const TRAINING_TYPE_LABELS: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  cardio: 'Cardio',
  rest: 'Rust',
  other: 'Overig',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateIso(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

interface RecentSession {
  key: string
  date: string
  label: string
  detail: string
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
  const { report: weekReport, isLoading: weekLoading } = useReport('week')
  const { data: trainingSessions, isLoading: trainingLoading } = useTrainingSessions()
  const { data: cardioSessions, isLoading: cardioLoading } = useCardioSessions()
  const { data: clusterResults, isLoading: clusterLoading } = useClusterTestResults()
  const { data: clusterOverrides } = useClusterRequirementOverrides()
  const { data: plannedSessions, isLoading: plannedLoading } = usePlannedSessions()

  const todaysPlan = useMemo(() => {
    const today = JS_DAY_TO_DAY_OF_WEEK[new Date().getDay()]
    return (plannedSessions ?? []).filter((s) => s.dayOfWeek === today)
  }, [plannedSessions])

  const topGoals = goals?.slice(0, 3) ?? []
  const recentAchievements = achievements?.slice(0, 3) ?? []

  const clusterSummary = useMemo(() => {
    if (!clusterResults) return null
    let achievedCount = 0
    let measuredCount = 0
    for (const req of CLUSTER_6_REQUIREMENTS) {
      const override = clusterOverrides?.[req.id]
      const effectiveTarget = override?.targetValue ?? req.targetValue
      const bufferConfig: ClusterBufferConfig = {
        bufferMargin: override?.bufferMargin ?? DEFAULT_BUFFER_CONFIG.bufferMargin,
        strongBufferMargin: override?.strongBufferMargin ?? DEFAULT_BUFFER_CONFIG.strongBufferMargin,
        approachingThreshold: DEFAULT_BUFFER_CONFIG.approachingThreshold,
      }
      const status = classifyClusterResult({ ...req, targetValue: effectiveTarget }, clusterResults[req.id]?.value ?? null, bufferConfig)
      if (status !== 'not_measured') measuredCount++
      if (status === 'target_achieved' || status === 'buffer_achieved' || status === 'strong_buffer_achieved') achievedCount++
    }
    return { achievedCount, measuredCount, total: CLUSTER_6_REQUIREMENTS.length }
  }, [clusterResults, clusterOverrides])

  const recentSessions = useMemo<RecentSession[]>(() => {
    const training = (trainingSessions ?? []).map((s) => ({
      key: `training-${s.id}`,
      date: s.date,
      label: s.notes ?? 'Trainingssessie',
      detail: `${s.setCount} sets · ${s.source}`,
    }))
    const cardio = (cardioSessions ?? []).map((s) => ({
      key: `cardio-${s.id}`,
      date: s.date,
      label: s.sport,
      detail: s.source,
    }))
    return [...training, ...cardio].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  }, [trainingSessions, cardioSessions])

  const strengthTrendEmpty = !weekReport || (weekReport.trainingSessions.current === 0 && weekReport.trainingSessions.previous === 0)
  const cardioTrendEmpty = !weekReport || (weekReport.cardioSessions.current === 0 && weekReport.cardioSessions.previous === 0)

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
          {plannedLoading ? (
            <InsufficientData label="Laden…" />
          ) : todaysPlan.length === 0 ? (
            <InsufficientData label="Geen sessie gepland voor vandaag — te bewerken in Settings." />
          ) : (
            <div className="flex flex-col divide-y divide-gridline">
              {todaysPlan.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-text-primary">{s.label}</span>
                  <span className="text-text-muted">
                    {TRAINING_TYPE_LABELS[s.trainingType]}
                    {s.trainingSubtype ? ` (${s.trainingSubtype})` : ''}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link to="/settings" className="mt-2 block text-sm font-semibold text-accent-text">
            Trainingsplan bewerken →
          </Link>
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
          {weekLoading ? (
            <InsufficientData label="Laden…" />
          ) : strengthTrendEmpty ? (
            <InsufficientData label="Nog geen trainingssessies deze of vorige week." />
          ) : (
            <>
              <div className="text-2xl font-semibold text-text-primary">{weekReport!.sets.current} sets</div>
              <div className="text-xs text-text-muted">vorige week: {weekReport!.sets.previous}</div>
            </>
          )}
        </Card>
        <Card title="Cardio trend">
          {weekLoading ? (
            <InsufficientData label="Laden…" />
          ) : cardioTrendEmpty ? (
            <InsufficientData label="Nog geen cardio-sessies deze of vorige week." />
          ) : (
            <>
              <div className="text-2xl font-semibold text-text-primary">{formatDistance(weekReport!.cardioDistanceMeters.current)}</div>
              <div className="text-xs text-text-muted">vorige week: {formatDistance(weekReport!.cardioDistanceMeters.previous)}</div>
            </>
          )}
        </Card>
        <Card title="Cluster 6 readiness">
          {clusterLoading ? (
            <InsufficientData label="Laden…" />
          ) : !clusterSummary || clusterSummary.measuredCount === 0 ? (
            <InsufficientData label="Nog geen Cluster 6-resultaten gelogd." />
          ) : (
            <>
              <div className="text-2xl font-semibold text-text-primary">
                {clusterSummary.achievedCount}/{clusterSummary.total} behaald
              </div>
              <div className="text-xs text-text-muted">{clusterSummary.measuredCount} van {clusterSummary.total} gemeten</div>
            </>
          )}
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
          {trainingLoading || cardioLoading ? (
            <InsufficientData label="Laden…" />
          ) : recentSessions.length === 0 ? (
            <InsufficientData label="Nog geen sessies gesynchroniseerd." />
          ) : (
            <div className="flex flex-col divide-y divide-gridline">
              {recentSessions.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-text-primary">{s.label}</span>
                  <span className="text-text-muted">
                    {s.detail} · {formatDateIso(s.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
