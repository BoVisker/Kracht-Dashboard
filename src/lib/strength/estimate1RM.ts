/**
 * Estimated 1RM. Every caller must label this "estimated" in the UI —
 * see brief section 11/53: never present an e1RM as a measured value.
 *
 * Epley is the primary formula (matches the original dashboard.html so
 * historical numbers stay comparable). Brzycki is offered as a second
 * opinion since no single formula is reliable across all rep ranges —
 * they diverge more the higher the rep count goes, which is exactly
 * where a single-formula estimate is least trustworthy.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function brzycki1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  if (reps >= 37) return weightKg // formula breaks down/goes negative past this point
  return weightKg * (36 / (37 - reps))
}

export interface Estimated1RM {
  epley: number
  brzycki: number
  /** Average of the two — a slightly more stable single number for charts. */
  blended: number
  /** Epley on ≤5 reps is well-validated; both formulas get shakier above that. */
  reliability: 'good' | 'rough'
}

export function estimate1RM(weightKg: number, reps: number): Estimated1RM {
  const epley = epley1RM(weightKg, reps)
  const brzycki = brzycki1RM(weightKg, reps)
  return {
    epley,
    brzycki,
    blended: (epley + brzycki) / 2,
    reliability: reps <= 5 ? 'good' : 'rough',
  }
}
