import { describe, expect, it } from 'vitest'
import { detectPersonalRecords, findPRHistory, type SetRecord } from './personalRecords'

describe('detectPersonalRecords', () => {
  it('returns an empty object for no history rather than fabricated zeros', () => {
    expect(detectPersonalRecords([])).toEqual({})
  })

  it('finds the heaviest weight regardless of reps', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 85, reps: 2 },
      { sessionId: 's3', date: new Date('2026-01-15'), weightKg: 82.5, reps: 4 },
    ]
    const records = detectPersonalRecords(history)
    expect(records.weight?.value).toBe(85)
    expect(records.weight?.date).toEqual(new Date('2026-01-08'))
  })

  it('finds the most reps in a single set regardless of weight', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 20, reps: 12 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 40, reps: 6 },
    ]
    const records = detectPersonalRecords(history)
    expect(records.reps?.value).toBe(12)
  })

  it('finds the highest estimated 1RM across all sets, not just the heaviest single weight', () => {
    // 80kg x 5 -> e1RM ~93; 85kg x 1 -> e1RM 85. The higher-rep lighter set should win here.
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 85, reps: 1 },
    ]
    const records = detectPersonalRecords(history)
    expect(records.estimated_1rm?.detail).toBe('80kg × 5')
  })

  it('sums volume per session (not per set) to find the highest-volume session', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 }, // 400
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 }, // 400 -> session total 800
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 90, reps: 6 }, // 540, single set, lower total
    ]
    const records = detectPersonalRecords(history)
    expect(records.volume?.value).toBe(800)
    expect(records.volume?.detail).toBe('2 sets')
  })

  it('ignores sets with zero or negative reps rather than letting them skew a PR', () => {
    const history: SetRecord[] = [{ sessionId: 's1', date: new Date('2026-01-01'), weightKg: 999, reps: 0 }]
    expect(detectPersonalRecords(history)).toEqual({})
  })
})

describe('findPRHistory', () => {
  it('returns no events for no history', () => {
    expect(findPRHistory([])).toEqual([])
  })

  it('does not treat the first-ever set as an achievement -- nothing to beat yet', () => {
    const history: SetRecord[] = [{ sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 }]
    expect(findPRHistory(history)).toEqual([])
  })

  it('emits a weight event only when a later set beats the running best', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 80, reps: 5 }, // ties, not a new PR
      { sessionId: 's3', date: new Date('2026-01-15'), weightKg: 85, reps: 5 },
    ]
    const events = findPRHistory(history).filter((e) => e.kind === 'weight')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ value: 85, date: new Date('2026-01-15') })
  })

  it('tracks weight/reps/estimated_1rm/volume independently, each with its own baseline', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 }, // baseline for all kinds
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 60, reps: 12 }, // reps PR, not weight PR
      { sessionId: 's3', date: new Date('2026-01-15'), weightKg: 90, reps: 3 }, // weight PR, not reps PR
    ]
    const events = findPRHistory(history)
    const kinds = events.map((e) => e.kind).sort()
    expect(kinds).toContain('reps')
    expect(kinds).toContain('weight')
    expect(events.find((e) => e.kind === 'reps')?.date).toEqual(new Date('2026-01-08'))
    expect(events.find((e) => e.kind === 'weight')?.date).toEqual(new Date('2026-01-15'))
  })

  it('detects a session-volume PR only when a later session beats the prior best total', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 }, // session total 400 -> baseline
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 50, reps: 5 }, // 250, below baseline
      { sessionId: 's3', date: new Date('2026-01-15'), weightKg: 80, reps: 6 }, // 480, new volume PR
    ]
    const volumeEvents = findPRHistory(history).filter((e) => e.kind === 'volume')
    expect(volumeEvents).toHaveLength(1)
    expect(volumeEvents[0]).toMatchObject({ value: 480, date: new Date('2026-01-15') })
  })

  it('ignores sets with zero or negative reps', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 999, reps: 0 },
    ]
    expect(findPRHistory(history)).toEqual([])
  })

  it('returns events in chronological order', () => {
    const history: SetRecord[] = [
      { sessionId: 's1', date: new Date('2026-01-01'), weightKg: 80, reps: 5 },
      { sessionId: 's2', date: new Date('2026-01-08'), weightKg: 85, reps: 6 },
      { sessionId: 's3', date: new Date('2026-01-15'), weightKg: 90, reps: 7 },
    ]
    const dates = findPRHistory(history).map((e) => e.date.getTime())
    expect(dates).toEqual([...dates].sort((a, b) => a - b))
  })
})
