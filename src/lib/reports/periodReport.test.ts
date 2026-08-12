import { describe, expect, it } from 'vitest'
import { buildPeriodReport } from './periodReport'

const ASOF = new Date('2026-08-12T12:00:00Z')

describe('buildPeriodReport', () => {
  it('returns all-zero metrics with null percent deltas for no data', () => {
    const report = buildPeriodReport('week', { trainingSessions: [], cardioSessions: [], achievements: [] }, ASOF)
    expect(report.trainingSessions).toEqual({ current: 0, previous: 0, deltaAbsolute: 0, deltaPercent: null })
    expect(report.sets).toEqual({ current: 0, previous: 0, deltaAbsolute: 0, deltaPercent: null })
  })

  it('counts sessions and sums sets into the correct rolling 7-day window', () => {
    const trainingSessions = [
      { date: new Date('2026-08-10T00:00:00Z'), setCount: 20 }, // 2 days ago -> current week
      { date: new Date('2026-08-06T00:00:00Z'), setCount: 15 }, // 6 days ago -> current week
      { date: new Date('2026-08-01T00:00:00Z'), setCount: 25 }, // 11 days ago -> prior week
      { date: new Date('2026-07-20T00:00:00Z'), setCount: 99 }, // outside both windows
    ]
    const report = buildPeriodReport('week', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    expect(report.trainingSessions.current).toBe(2)
    expect(report.trainingSessions.previous).toBe(1)
    expect(report.sets.current).toBe(35)
    expect(report.sets.previous).toBe(25)
  })

  it('computes a correct percent delta, and rounds to one decimal', () => {
    const trainingSessions = [
      { date: new Date('2026-08-10T00:00:00Z'), setCount: 30 },
      { date: new Date('2026-08-01T00:00:00Z'), setCount: 20 },
    ]
    const report = buildPeriodReport('week', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    expect(report.sets).toEqual({ current: 30, previous: 20, deltaAbsolute: 10, deltaPercent: 50 })
  })

  it('returns a null percent delta (not Infinity or a fabricated number) when the previous period was zero', () => {
    const trainingSessions = [{ date: new Date('2026-08-10T00:00:00Z'), setCount: 10 }]
    const report = buildPeriodReport('week', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    expect(report.trainingSessions.previous).toBe(0)
    expect(report.trainingSessions.deltaPercent).toBeNull()
  })

  it('sums cardio distance and moving time, treating null fields as zero rather than skewing the sum with NaN', () => {
    const cardioSessions = [
      { date: new Date('2026-08-10T00:00:00Z'), distanceMeters: 5000, movingTimeSeconds: 1500 },
      { date: new Date('2026-08-09T00:00:00Z'), distanceMeters: null, movingTimeSeconds: null },
    ]
    const report = buildPeriodReport('week', { trainingSessions: [], cardioSessions, achievements: [] }, ASOF)
    expect(report.cardioSessions.current).toBe(2)
    expect(report.cardioDistanceMeters.current).toBe(5000)
    expect(report.cardioMovingTimeSeconds.current).toBe(1500)
  })

  it('counts achievements (PR events) in the current vs prior window', () => {
    const achievements = [{ date: new Date('2026-08-11T00:00:00Z') }, { date: new Date('2026-08-02T00:00:00Z') }]
    const report = buildPeriodReport('week', { trainingSessions: [], cardioSessions: [], achievements }, ASOF)
    expect(report.personalRecords.current).toBe(1)
    expect(report.personalRecords.previous).toBe(1)
  })

  it('uses a 30-day rolling window for the month period, distinct from the 7-day week window', () => {
    const trainingSessions = [{ date: new Date('2026-07-20T00:00:00Z'), setCount: 40 }] // 23 days ago
    const weekReport = buildPeriodReport('week', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    const monthReport = buildPeriodReport('month', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    expect(weekReport.sets.current).toBe(0)
    expect(weekReport.sets.previous).toBe(0)
    expect(monthReport.sets.current).toBe(40)
  })

  it('places a boundary event in exactly one window, not both or neither', () => {
    // Exactly 7 days before asOf -- lands on the current window's start boundary (exclusive), so it belongs to the prior window.
    const boundaryDate = new Date(ASOF.getTime() - 7 * 86_400_000)
    const trainingSessions = [{ date: boundaryDate, setCount: 5 }]
    const report = buildPeriodReport('week', { trainingSessions, cardioSessions: [], achievements: [] }, ASOF)
    expect(report.trainingSessions.current).toBe(0)
    expect(report.trainingSessions.previous).toBe(1)
  })
})
