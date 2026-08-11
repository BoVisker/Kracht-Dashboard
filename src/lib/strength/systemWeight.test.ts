import { describe, expect, it } from 'vitest'
import { relativeStrength, systemWeight } from './systemWeight'

describe('systemWeight', () => {
  it('adds bodyweight and added load when bodyweight is known', () => {
    const result = systemWeight(20, 80)
    expect(result.systemWeightKg).toBe(100)
    expect(result.addedLoadKg).toBe(20)
  })

  it('never guesses a system weight when bodyweight is missing', () => {
    const result = systemWeight(20, null)
    expect(result.systemWeightKg).toBeNull()
  })
})

describe('relativeStrength', () => {
  it('divides load by bodyweight', () => {
    expect(relativeStrength(100, 80)).toBeCloseTo(1.25, 5)
  })

  it('returns null instead of Infinity/NaN when bodyweight is missing or zero', () => {
    expect(relativeStrength(100, null)).toBeNull()
    expect(relativeStrength(100, 0)).toBeNull()
  })
})
