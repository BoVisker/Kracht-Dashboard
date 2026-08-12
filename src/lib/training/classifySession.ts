export type SessionMovementType = 'push' | 'pull' | 'legs'
export type SessionSubtype = 'heavy' | 'volume' | null

export interface SessionClassification {
  /** In order of first mention -- a combined session ("push + benen") keeps both rather than picking one and losing information. */
  types: SessionMovementType[]
  subtype: SessionSubtype
}

// Muscle-group words (Dutch, matching this user's actual Hevy titles) fill
// in for sessions that never say "push"/"pull" outright, e.g. "Borst,
// tricep" or "Rug, bicep, schouders" -- confirmed against the real data
// these titles show up in. "schouders" (shoulders) is deliberately left
// out of both: overhead work is push, rear-delt/lateral work is pull, and
// guessing either way would be exactly the kind of false precision this
// project avoids elsewhere.
const PUSH_KEYWORDS = ['push', 'borst', 'tricep']
const PULL_KEYWORDS = ['pull', 'rug', 'bicep']
// 'been'/'benen' listed separately -- Dutch pluralizes "been" (leg) to
// "benen" irregularly, so "been" is not a substring of "benen" (confirmed
// by a failing test on the real title "donderdag push + benen").
const LEGS_KEYWORDS = ['been', 'benen', 'leg', 'quad', 'hamstring', 'kuit', 'squat']
const HEAVY_KEYWORDS = ['heavy', 'zwaar']
const VOLUME_KEYWORDS = ['volume']

function firstMatchIndex(text: string, keywords: string[]): number {
  let best = -1
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword)
    if (idx >= 0 && (best === -1 || idx < best)) best = idx
  }
  return best
}

/**
 * Parses a Hevy workout title (training_sessions.notes) for Push/Pull/Legs
 * and Heavy/Volume signals. Purely a keyword heuristic on text that's
 * already fetched client-side -- no exercise-level muscle-group data
 * involved, no sync/migration needed. Roughly 40% of this user's real
 * session titles are Hevy's generic defaults ("Afternoon workout 💪")
 * with zero classification signal; those honestly come back with an
 * empty types array rather than a guessed one.
 */
export function classifySessionType(title: string | null): SessionClassification {
  if (!title) return { types: [], subtype: null }
  const t = title.toLowerCase()

  const matches: { type: SessionMovementType; pos: number }[] = []
  const pushPos = firstMatchIndex(t, PUSH_KEYWORDS)
  const pullPos = firstMatchIndex(t, PULL_KEYWORDS)
  const legsPos = firstMatchIndex(t, LEGS_KEYWORDS)
  if (pushPos >= 0) matches.push({ type: 'push', pos: pushPos })
  if (pullPos >= 0) matches.push({ type: 'pull', pos: pullPos })
  if (legsPos >= 0) matches.push({ type: 'legs', pos: legsPos })
  matches.sort((a, b) => a.pos - b.pos)

  const subtype: SessionSubtype = HEAVY_KEYWORDS.some((k) => t.includes(k)) ? 'heavy' : VOLUME_KEYWORDS.some((k) => t.includes(k)) ? 'volume' : null

  return { types: matches.map((m) => m.type), subtype }
}
