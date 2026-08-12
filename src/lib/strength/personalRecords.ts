import { estimate1RM } from './estimate1RM'

export interface SetRecord {
  sessionId: string
  date: Date
  weightKg: number
  reps: number
}

export type PersonalRecordKind = 'weight' | 'reps' | 'estimated_1rm' | 'volume'

export interface PersonalRecord {
  kind: PersonalRecordKind
  value: number
  date: Date
  /** The set (or session, for volume) that produced this PR, e.g. "82.5kg x 5". */
  detail: string
}

/**
 * Generic over any exercise's raw set history -- nothing here is
 * bench-specific (brief section 27/32). Returns null for a PR kind when
 * there's no data to support it, never a fabricated 0.
 */
export function detectPersonalRecords(history: SetRecord[]): Partial<Record<PersonalRecordKind, PersonalRecord>> {
  if (!history.length) return {}

  const records: Partial<Record<PersonalRecordKind, PersonalRecord>> = {}

  for (const set of history) {
    if (set.reps <= 0) continue

    if (!records.weight || set.weightKg > records.weight.value) {
      records.weight = { kind: 'weight', value: set.weightKg, date: set.date, detail: `${set.weightKg}kg × ${set.reps}` }
    }
    if (!records.reps || set.reps > records.reps.value) {
      records.reps = { kind: 'reps', value: set.reps, date: set.date, detail: `${set.weightKg}kg × ${set.reps}` }
    }
    const e1rm = estimate1RM(set.weightKg, set.reps).blended
    if (!records.estimated_1rm || e1rm > records.estimated_1rm.value) {
      records.estimated_1rm = { kind: 'estimated_1rm', value: Math.round(e1rm * 10) / 10, date: set.date, detail: `${set.weightKg}kg × ${set.reps}` }
    }
  }

  const volumeBySession = new Map<string, { total: number; date: Date; setCount: number }>()
  for (const set of history) {
    if (set.reps <= 0) continue
    const existing = volumeBySession.get(set.sessionId)
    const addition = set.weightKg * set.reps
    if (existing) {
      existing.total += addition
      existing.setCount += 1
    } else {
      volumeBySession.set(set.sessionId, { total: addition, date: set.date, setCount: 1 })
    }
  }
  let bestVolume: { total: number; date: Date; setCount: number } | null = null
  for (const session of volumeBySession.values()) {
    if (!bestVolume || session.total > bestVolume.total) bestVolume = session
  }
  if (bestVolume) {
    records.volume = {
      kind: 'volume',
      value: Math.round(bestVolume.total * 10) / 10,
      date: bestVolume.date,
      detail: `${bestVolume.setCount} sets`,
    }
  }

  return records
}
