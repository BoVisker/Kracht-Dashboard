export type ReportPeriod = 'week' | 'month'

/** Rolling N-day windows, not calendar week/month -- a calendar-month view taken on the 12th would compare a
 * 12-day "this month" against a full 31-day "last month" and make every metric look like a crash. Rolling
 * windows of equal length are the only comparison that's actually apples-to-apples. */
const WINDOW_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30 }

export interface PeriodMetric {
  current: number
  previous: number
  deltaAbsolute: number
  /** Null (not 0 or Infinity) when the previous period was zero -- "+400%" from a zero baseline is a fabricated number, not a real rate of change. */
  deltaPercent: number | null
}

export interface PeriodReport {
  period: ReportPeriod
  rangeStart: Date
  rangeEnd: Date
  priorRangeStart: Date
  trainingSessions: PeriodMetric
  sets: PeriodMetric
  cardioSessions: PeriodMetric
  cardioDistanceMeters: PeriodMetric
  cardioMovingTimeSeconds: PeriodMetric
  personalRecords: PeriodMetric
}

export interface TrainingSessionInput {
  date: Date
  setCount: number
}

export interface CardioSessionInput {
  date: Date
  distanceMeters: number | null
  movingTimeSeconds: number | null
}

export interface AchievementInput {
  date: Date
}

function metric(current: number, previous: number): PeriodMetric {
  const deltaAbsolute = current - previous
  const deltaPercent = previous === 0 ? null : Math.round((deltaAbsolute / previous) * 1000) / 10
  return { current, previous, deltaAbsolute, deltaPercent }
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

/** (start, end] -- exclusive start so a boundary event falls in exactly one of the two adjacent windows, never both or neither. */
function inRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() > start.getTime() && date.getTime() <= end.getTime()
}

/**
 * Aggregates already-fetched training/cardio/achievement data into a
 * current-vs-prior-period report. Purely a reducer over data the app
 * already has -- no new data source, no new sync, same principle as the
 * achievements feed reusing detectPersonalRecords' logic.
 */
export function buildPeriodReport(
  period: ReportPeriod,
  data: { trainingSessions: TrainingSessionInput[]; cardioSessions: CardioSessionInput[]; achievements: AchievementInput[] },
  asOf: Date = new Date(),
): PeriodReport {
  const windowMs = WINDOW_DAYS[period] * 86_400_000
  const rangeEnd = asOf
  const rangeStart = new Date(asOf.getTime() - windowMs)
  const priorRangeStart = new Date(rangeStart.getTime() - windowMs)

  const currentSessions = data.trainingSessions.filter((s) => inRange(s.date, rangeStart, rangeEnd))
  const priorSessions = data.trainingSessions.filter((s) => inRange(s.date, priorRangeStart, rangeStart))

  const currentCardio = data.cardioSessions.filter((s) => inRange(s.date, rangeStart, rangeEnd))
  const priorCardio = data.cardioSessions.filter((s) => inRange(s.date, priorRangeStart, rangeStart))

  const currentPRs = data.achievements.filter((a) => inRange(a.date, rangeStart, rangeEnd))
  const priorPRs = data.achievements.filter((a) => inRange(a.date, priorRangeStart, rangeStart))

  return {
    period,
    rangeStart,
    rangeEnd,
    priorRangeStart,
    trainingSessions: metric(currentSessions.length, priorSessions.length),
    sets: metric(sum(currentSessions.map((s) => s.setCount)), sum(priorSessions.map((s) => s.setCount))),
    cardioSessions: metric(currentCardio.length, priorCardio.length),
    cardioDistanceMeters: metric(sum(currentCardio.map((s) => s.distanceMeters ?? 0)), sum(priorCardio.map((s) => s.distanceMeters ?? 0))),
    cardioMovingTimeSeconds: metric(
      sum(currentCardio.map((s) => s.movingTimeSeconds ?? 0)),
      sum(priorCardio.map((s) => s.movingTimeSeconds ?? 0)),
    ),
    personalRecords: metric(currentPRs.length, priorPRs.length),
  }
}
