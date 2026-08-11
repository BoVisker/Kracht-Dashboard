/**
 * Weighted dips/pull-ups need two numbers shown side by side, never
 * collapsed into one (brief section 12): the plate/added load, and the
 * total mass actually moved through the rep (bodyweight + added load).
 */
export interface SystemWeight {
  addedLoadKg: number
  bodyweightKg: number | null
  systemWeightKg: number | null
}

export function systemWeight(addedLoadKg: number, bodyweightKg: number | null): SystemWeight {
  return {
    addedLoadKg,
    bodyweightKg,
    systemWeightKg: bodyweightKg == null ? null : bodyweightKg + addedLoadKg,
  }
}

/** Relative strength: load moved per kg of bodyweight. Null when bodyweight is unknown — never guessed. */
export function relativeStrength(loadKg: number, bodyweightKg: number | null): number | null {
  if (bodyweightKg == null || bodyweightKg <= 0) return null
  return loadKg / bodyweightKg
}
