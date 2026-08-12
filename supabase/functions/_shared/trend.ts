// Intentional duplication of src/lib/goals/goalEngine.ts's fitLinearTrend
// and forecastAchievementDate: Edge Functions are their own Deno deploy
// unit, and this repo already accepted the same tradeoff for the Epley
// formula (see hevy-sync's recomputeGoalProgress comment) rather than
// reaching across the frontend/backend boundary with a relative import.
// Keep this in sync with goalEngine.ts if the trend logic changes there.

export interface HistoryPoint {
  date: Date
  value: number
}

export interface LinearTrend {
  slopePerDay: number
  intercept: number
  n: number
}

/** Needs >=3 points spanning >=7 days -- fewer than that is noise, not a trend. */
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

/** Null when the trend is flat/moving away from target -- never invent a date for a goal that isn't progressing. */
export function forecastAchievementDate(trend: LinearTrend, latestPoint: HistoryPoint, targetValue: number): Date | null {
  const movingTowardTarget =
    (targetValue > latestPoint.value && trend.slopePerDay > 0) || (targetValue < latestPoint.value && trend.slopePerDay < 0)
  if (!movingTowardTarget) return null

  const daysToTarget = (targetValue - latestPoint.value) / trend.slopePerDay
  if (!Number.isFinite(daysToTarget) || daysToTarget < 0) return null
  return new Date(latestPoint.date.getTime() + daysToTarget * 86_400_000)
}
