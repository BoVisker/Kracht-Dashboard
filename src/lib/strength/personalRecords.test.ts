import { describe, expect, it } from 'vitest'
import { detectPersonalRecords, type SetRecord } from './personalRecords'

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
