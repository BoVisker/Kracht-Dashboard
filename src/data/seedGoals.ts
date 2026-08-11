import type { Goal } from '../lib/types/canonical'

/**
 * Seed data, not hardcoded goal logic (brief section 37) — this is what
 * gets inserted into the `goals` table on first setup. The goal engine in
 * lib/goals/goalEngine.ts works the same for any goal shape; these three
 * rows are just the athlete's current starting point and can be edited or
 * replaced from the Goals page without touching code.
 *
 * currentValue/forecastDate/status are intentionally left at their
 * "no data yet" values here — those get computed from real Hevy sets once
 * synced, never seeded with a guess.
 */
export const SEED_GOALS: Omit<Goal, 'id'>[] = [
  {
    name: 'Bench Press',
    category: 'strength',
    exerciseId: 'bench-press',
    unit: 'kg',
    startValue: 70,
    currentValue: null,
    targetValue: 100,
    startDate: '2026-07-20',
    deadline: '2027-01-01',
    status: 'insufficient_data',
    forecastDate: null,
    confidence: null,
    priority: 1,
  },
  {
    name: 'Weighted Dips',
    category: 'strength',
    exerciseId: 'weighted-dip',
    unit: 'kg extra',
    startValue: null,
    currentValue: null,
    targetValue: 40, // open-ended goal per brief — highest achievable is the point; this is a placeholder next-step target
    startDate: '2026-07-20',
    deadline: null,
    status: 'insufficient_data',
    forecastDate: null,
    confidence: null,
    priority: 2,
  },
  {
    name: 'Weighted Pull-ups',
    category: 'strength',
    exerciseId: 'weighted-pullup',
    unit: 'kg extra',
    startValue: null,
    currentValue: null,
    targetValue: 30,
    startDate: '2026-07-20',
    deadline: null,
    status: 'insufficient_data',
    forecastDate: null,
    confidence: null,
    priority: 3,
  },
]
