import { describe, expect, it } from 'vitest'
import {
  computeGoalStatus,
  fitLinearTrend,
  forecastAchievementDate,
  goalProgressPercent,
  isDeadlineExpired,
  requiredPaceToDeadline,
  suggestNextTarget,
  trendConfidence,
  type HistoryPoint,
} from './goalEngine'

describe('goalProgressPercent', () => {
  it('computes percent of the way from start to target', () => {
    expect(goalProgressPercent(80, 87.5, 100)).toBeCloseTo(37.5, 5)
  })

  it('clamps below 0% and above 100%', () => {
    expect(goalProgressPercent(80, 75, 100)).toBe(0)
    expect(goalProgressPercent(80, 110, 100)).toBe(100)
  })

  it('returns null instead of a fabricated number when start or current is missing', () => {
    expect(goalProgressPercent(null, 87.5, 100)).toBeNull()
    expect(goalProgressPercent(80, null, 100)).toBeNull()
  })
})

describe('fitLinearTrend', () => {
  it('refuses to fit a trend on fewer than 3 points', () => {
    const history: HistoryPoint[] = [
      { date: new Date('2026-01-01'), value: 80 },
      { date: new Date('2026-02-01'), value: 82.5 },
    ]
    expect(fitLinearTrend(history)).toBeNull()
  })

  it('refuses to fit a trend spanning less than a week', () => {
    const history: HistoryPoint[] = [
      { date: new Date('2026-01-01'), value: 80 },
      { date: new Date('2026-01-02'), value: 81 },
      { date: new Date('2026-01-03'), value: 82 },
    ]
    expect(fitLinearTrend(history)).toBeNull()
  })

  it('fits a positive slope for steadily increasing values', () => {
    const history: HistoryPoint[] = [
      { date: new Date('2026-01-01'), value: 80 },
      { date: new Date('2026-01-15'), value: 82.5 },
      { date: new Date('2026-02-01'), value: 85 },
    ]
    const trend = fitLinearTrend(history)
    expect(trend).not.toBeNull()
    expect(trend!.slopePerDay).toBeGreaterThan(0)
  })
})

describe('forecastAchievementDate', () => {
  it('projects forward when trending toward the target', () => {
    const trend = { slopePerDay: 0.1, intercept: 0, n: 5 }
    const latest: HistoryPoint = { date: new Date('2026-08-01'), value: 90 }
    const forecast = forecastAchievementDate(trend, latest, 100)
    expect(forecast).not.toBeNull()
    expect(forecast!.getTime()).toBeGreaterThan(latest.date.getTime())
  })

  it('returns null when the trend is moving away from the target', () => {
    const trend = { slopePerDay: -0.1, intercept: 0, n: 5 }
    const latest: HistoryPoint = { date: new Date('2026-08-01'), value: 90 }
    expect(forecastAchievementDate(trend, latest, 100)).toBeNull()
  })

  it('returns null for a completely flat trend', () => {
    const trend = { slopePerDay: 0, intercept: 0, n: 5 }
    const latest: HistoryPoint = { date: new Date('2026-08-01'), value: 90 }
    expect(forecastAchievementDate(trend, latest, 100)).toBeNull()
  })
})

describe('isDeadlineExpired — the "deadline in the past" edge case (brief section 47)', () => {
  it('flags the original bench deadline of 1 Jan 2026 as expired when viewed in August 2026', () => {
    expect(isDeadlineExpired('2026-01-01', new Date('2026-08-11'))).toBe(true)
  })

  it('does not flag the corrected 1 Jan 2027 deadline as expired in August 2026', () => {
    expect(isDeadlineExpired('2027-01-01', new Date('2026-08-11'))).toBe(false)
  })

  it('treats a null deadline as never expired', () => {
    expect(isDeadlineExpired(null)).toBe(false)
  })
})

describe('computeGoalStatus', () => {
  it('returns achieved once current value reaches target, regardless of deadline', () => {
    const status = computeGoalStatus({
      currentValue: 100,
      targetValue: 100,
      deadline: '2026-01-01',
      forecastDate: null,
      asOf: new Date('2026-08-11'),
    })
    expect(status).toBe('achieved')
  })

  it('returns expired for a past deadline that was not met', () => {
    const status = computeGoalStatus({
      currentValue: 90,
      targetValue: 100,
      deadline: '2026-01-01',
      forecastDate: null,
      asOf: new Date('2026-08-11'),
    })
    expect(status).toBe('expired')
  })

  it('returns insufficient_data when there is no current value or forecast yet', () => {
    const status = computeGoalStatus({
      currentValue: null,
      targetValue: 100,
      deadline: '2027-01-01',
      forecastDate: null,
      asOf: new Date('2026-08-11'),
    })
    expect(status).toBe('insufficient_data')
  })

  it('returns on_track when the forecast comfortably beats the deadline', () => {
    const status = computeGoalStatus({
      currentValue: 90,
      targetValue: 100,
      deadline: '2027-01-01',
      forecastDate: new Date('2026-10-01'),
      asOf: new Date('2026-08-11'),
    })
    expect(status).toBe('on_track')
  })

  it('returns behind when the forecast lands well after the deadline', () => {
    const status = computeGoalStatus({
      currentValue: 90,
      targetValue: 100,
      deadline: '2026-09-01',
      forecastDate: new Date('2027-06-01'),
      asOf: new Date('2026-08-11'),
    })
    expect(status).toBe('behind')
  })
})

describe('suggestNextTarget', () => {
  it('falls back to one increment step when there is no usable trend', () => {
    expect(suggestNextTarget(100, null, 2.5)).toBe(102.5)
  })

  it('scales the next target to recent pace, rounded to the load increment', () => {
    const trend = { slopePerDay: 0.05, intercept: 0, n: 8 } // 1.5kg/month
    const next = suggestNextTarget(100, trend, 2.5)
    expect(next).toBeGreaterThan(100)
    expect(next % 2.5).toBeCloseTo(0, 5)
  })
})

describe('trendConfidence', () => {
  it('returns null when there is no trend', () => {
    expect(trendConfidence(null)).toBeNull()
  })

  it('scales confidence with sample size', () => {
    expect(trendConfidence({ slopePerDay: 0.1, intercept: 0, n: 3 })).toBe('low')
    expect(trendConfidence({ slopePerDay: 0.1, intercept: 0, n: 5 })).toBe('medium')
    expect(trendConfidence({ slopePerDay: 0.1, intercept: 0, n: 9 })).toBe('high')
  })
})

describe('requiredPaceToDeadline', () => {
  it('computes the monthly pace needed to close the remaining gap by the deadline', () => {
    // 12.2kg short with ~142 days left (2026-08-11 -> 2027-01-01) -> ~2.6kg/month.
    const rate = requiredPaceToDeadline({
      currentValue: 87.8,
      targetValue: 100,
      deadline: '2027-01-01',
      asOf: new Date('2026-08-11'),
    })
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(2.6, 1)
  })

  it('returns null once the goal is already achieved -- nothing left to need', () => {
    const rate = requiredPaceToDeadline({ currentValue: 100, targetValue: 100, deadline: '2027-01-01', asOf: new Date('2026-06-01') })
    expect(rate).toBeNull()
  })

  it('returns null once the deadline has passed rather than dividing by a negative/zero span', () => {
    const rate = requiredPaceToDeadline({ currentValue: 90, targetValue: 100, deadline: '2026-06-01', asOf: new Date('2026-08-11') })
    expect(rate).toBeNull()
  })

  it('does not need a start_value -- works for open-ended goals seeded without one', () => {
    const rate = requiredPaceToDeadline({ currentValue: 33, targetValue: 40, deadline: '2027-01-01', asOf: new Date('2026-08-11') })
    expect(rate).not.toBeNull()
  })
})
