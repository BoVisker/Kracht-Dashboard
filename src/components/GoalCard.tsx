import { Link } from 'react-router-dom'
import type { Goal } from '../lib/types/canonical'
import { Badge, type BadgeTone } from './ui/Badge'
import { ProgressBar } from './ui/ProgressBar'
import { isDeadlineExpired, requiredPaceToDeadline } from '../lib/goals/goalEngine'

const STATUS_LABEL: Record<Goal['status'], string> = {
  on_track: 'Op schema',
  at_risk: 'Risico',
  behind: 'Achter',
  insufficient_data: 'Onvoldoende data',
  achieved: 'Behaald',
  expired: 'Deadline verlopen',
}

const STATUS_TONE: Record<Goal['status'], BadgeTone> = {
  on_track: 'good',
  at_risk: 'warn',
  behind: 'crit',
  insufficient_data: 'neutral',
  achieved: 'good',
  expired: 'crit',
}

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '–'
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${unit}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

const CONFIDENCE_LABEL: Record<NonNullable<Goal['confidence']>, string> = {
  low: 'ruwe schatting',
  medium: 'indicatie',
  high: 'betrouwbaar',
}

const PACE_NOTE_TEXT_TONE: Record<BadgeTone, string> = {
  good: 'text-status-good',
  warn: 'text-status-warn',
  crit: 'text-status-crit',
  neutral: 'text-text-primary',
}

/**
 * Only for priority-1 goals (explicit user request): "what do I need to
 * do to get back on schedule". Always phrased to match the status badge
 * above it -- an earlier version compared against a separate naive
 * straight-line schedule and could flatly contradict the badge (real
 * case: badge said "Achter" while that comparison said "vóór op schema"
 * for the same goal at the same moment). This derives from the same
 * currentValue/targetValue/deadline computeGoalStatus already used, so
 * the two can't disagree -- just one required pace, framed by status.
 */
function ScheduleNote({ goal }: { goal: Goal }) {
  if (goal.priority !== 1 || goal.status === 'achieved' || goal.status === 'expired') return null
  if (goal.currentValue == null || !goal.deadline) return null

  const requiredRatePerMonth = requiredPaceToDeadline({
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    deadline: goal.deadline,
  })
  if (requiredRatePerMonth == null) return null

  const tone = STATUS_TONE[goal.status]
  const pace = `${fmt1(requiredRatePerMonth)} ${goal.unit}/maand`
  const text =
    goal.status === 'on_track'
      ? `Op schema — blijf minimaal ${pace} aanhouden om de deadline te halen.`
      : `Nodig: ${pace} vanaf nu om de deadline nog te halen.`

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-1 px-3 py-2 text-xs">
      <span className={`font-semibold ${PACE_NOTE_TEXT_TONE[tone]}`}>{text}</span>
    </div>
  )
}

/** Layout follows brief section 48's mock exactly: current → target, bar, remaining, deadline, status, forecast. */
export function GoalCard({ goal, percent }: { goal: Goal; percent: number | null }) {
  const expired = isDeadlineExpired(goal.deadline)
  const remaining = goal.currentValue == null ? null : goal.targetValue - goal.currentValue

  return (
    <div className="rounded-xl border border-border bg-card-bg p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-text-secondary uppercase">{goal.name}</h3>
        <Badge tone={STATUS_TONE[goal.status]}>{STATUS_LABEL[goal.status]}</Badge>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-text-primary">{formatValue(goal.currentValue, goal.unit)}</span>
        <span className="text-text-muted">→</span>
        <span className="text-2xl font-semibold text-text-primary">{formatValue(goal.targetValue, goal.unit)}</span>
      </div>

      <ProgressBar percent={percent} />
      <div className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
        <span>{percent == null ? 'Onvoldoende data voor percentage' : `${Math.round(percent)}%`}</span>
        <span>{remaining != null && remaining > 0 ? `+${remaining % 1 === 0 ? remaining : remaining.toFixed(1)} ${goal.unit} te gaan` : null}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-text-muted">Deadline</div>
          <div className={expired ? 'font-medium text-status-crit' : 'text-text-primary'}>{formatDate(goal.deadline)}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Forecast</div>
          <div className="text-text-primary">
            {goal.forecastDate ? formatDate(goal.forecastDate) : 'Insufficient data'}
            {goal.forecastDate && goal.confidence && <span className="ml-1 text-xs text-text-muted">({CONFIDENCE_LABEL[goal.confidence]})</span>}
          </div>
        </div>
      </div>

      <ScheduleNote goal={goal} />

      {expired && goal.status !== 'achieved' && (
        <div className="mt-3 rounded-md border border-status-crit/30 bg-status-crit/10 px-3 py-2 text-xs text-text-primary">
          Deadline expired — confirmation required. Pas de deadline aan in Doelen-instellingen, deze wordt niet automatisch gewijzigd.
        </div>
      )}

      {goal.exerciseId && (
        <Link to={`/exercises/${goal.exerciseId}`} className="mt-3 block text-xs font-semibold text-accent-text">
          Bekijk oefening →
        </Link>
      )}
    </div>
  )
}
