import type { GoalStatus } from '../types/canonical'

export interface HistoryPoint {
  date: Date
  value: number
}

export interface LinearTrend {
  /** Change in value per day. */
  slopePerDay: number
  intercept: number
  /** Number of points the trend was fit on — carry this through to confidence. */
  n: number
}

/** Percent of the way from start to target. Null when start/target data is missing — never 0% by default. */
export function goalProgressPercent(startValue: number | null, currentValue: number | null, targetValue: number): number | null {
  if (startValue == null || currentValue == null) return null
  const span = targetValue - startValue
  if (span === 0) return currentValue >= targetValue ? 100 : 0
  const pct = ((currentValue - startValue) / span) * 100
  return Math.max(0, Math.min(100, pct))
}

/**
 * Ordinary least-squares fit of value ~ days-since-first-point. Needs at
 * least 3 points spread over at least 7 days — fewer than that and a
 * "trend" is just noise dressed up as a number, so callers should treat
 * a null return as "insufficient data", not silently fall back to 0.
 */
export function fitLinearTrend(history: HistoryPoint[]): LinearTrend | null {
  if (history.length < 3) return null
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime())
  const spanDays = (sorted[sorted.length - 1].date.getTime() - sorted[0].date.getTime()) / 86_400_000
  if (spanDays < 7) return null

  const t0 = sorted[0].date.getTime()
  const xs = sorted.map((p) => (p.date.getTime() - t0) / 86_400_000)
  const ys = sorted.map((p) => p.value)
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slopePerDay = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slopePerDay * sumX) / n
  return { slopePerDay, intercept, n }
}

/**
 * Extrapolates a linear trend forward to find when it crosses the target.
 * Returns null when the trend is flat/moving away from the target — never
 * invent a date for a goal that isn't progressing (brief section 38/53).
 */
export function forecastAchievementDate(
  trend: LinearTrend,
  latestPoint: HistoryPoint,
  targetValue: number,
): Date | null {
  const movingTowardTarget =
    (targetValue > latestPoint.value && trend.slopePerDay > 0) ||
    (targetValue < latestPoint.value && trend.slopePerDay < 0)
  if (!movingTowardTarget) return null

  const daysToTarget = (targetValue - latestPoint.value) / trend.slopePerDay
  if (!Number.isFinite(daysToTarget) || daysToTarget < 0) return null
  const ms = latestPoint.date.getTime() + daysToTarget * 86_400_000
  return new Date(ms)
}

/** More history over a longer span = more trustworthy trend. A blunt but honest heuristic, not a statistical guarantee. */
export function trendConfidence(trend: LinearTrend | null): 'low' | 'medium' | 'high' | null {
  if (!trend) return null
  if (trend.n >= 8) return 'high'
  if (trend.n >= 5) return 'medium'
  return 'low'
}

export function isDeadlineExpired(deadline: string | null, asOf: Date = new Date()): boolean {
  if (!deadline) return false
  return new Date(deadline).getTime() < asOf.getTime()
}

export interface GoalStatusInput {
  currentValue: number | null
  targetValue: number
  deadline: string | null
  forecastDate: Date | null
  asOf?: Date
}

/**
 * Status is deliberately conservative: 'insufficient_data' beats a
 * confident-looking guess (section 14/53). A goal only becomes
 * on_track/at_risk/behind once there's an actual forecast to compare
 * against the deadline.
 */
export function computeGoalStatus({ currentValue, targetValue, deadline, forecastDate, asOf = new Date() }: GoalStatusInput): GoalStatus {
  if (currentValue != null && currentValue >= targetValue) return 'achieved'
  if (isDeadlineExpired(deadline, asOf)) return 'expired'
  if (currentValue == null || !forecastDate) return 'insufficient_data'
  if (!deadline) return forecastDate ? 'on_track' : 'insufficient_data'

  const deadlineMs = new Date(deadline).getTime()
  const forecastMs = forecastDate.getTime()
  const bufferDays = (deadlineMs - forecastMs) / 86_400_000

  if (bufferDays >= 14) return 'on_track'
  if (bufferDays >= -14) return 'at_risk'
  return 'behind'
}

/**
 * Proposes the next target after a goal is achieved (section 13), sized to
 * the athlete's own recent pace rather than an arbitrary round number.
 * Falls back to one load-increment step when there's no usable trend yet.
 */
export function suggestNextTarget(achievedValue: number, trend: LinearTrend | null, loadIncrement: number): number {
  if (!trend || trend.slopePerDay <= 0) {
    return roundToIncrement(achievedValue + loadIncrement, loadIncrement)
  }
  const monthlyPace = trend.slopePerDay * 30
  // Aim for ~3 months of continued progress at the current pace, floored at one increment.
  const step = Math.max(loadIncrement, monthlyPace * 3)
  return roundToIncrement(achievedValue + step, loadIncrement)
}

function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value
  return Math.round(value / increment) * increment
}
