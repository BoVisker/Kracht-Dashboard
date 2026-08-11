import { describe, expect, it } from 'vitest'
import { epley1RM, brzycki1RM, estimate1RM } from './estimate1RM'

describe('epley1RM', () => {
  it('returns the weight unchanged for a 1-rep set', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })

  it('matches the known example from the dashboard: 85kg x 5 reps', () => {
    // 85 * (1 + 5/30) = 99.166...
    expect(epley1RM(85, 5)).toBeCloseTo(99.17, 1)
  })

  it('returns the weight for 0 reps rather than dividing into nonsense', () => {
    expect(epley1RM(80, 0)).toBe(80)
  })
})

describe('brzycki1RM', () => {
  it('returns the weight unchanged for a 1-rep set', () => {
    expect(brzycki1RM(100, 1)).toBe(100)
  })

  it('does not go negative or blow up near the formula boundary', () => {
    expect(brzycki1RM(50, 40)).toBe(50)
  })
})

describe('estimate1RM', () => {
  it('flags low-rep sets as good reliability and high-rep sets as rough', () => {
    expect(estimate1RM(100, 3).reliability).toBe('good')
    expect(estimate1RM(100, 12).reliability).toBe('rough')
  })

  it('blends the two formulas', () => {
    const result = estimate1RM(85, 5)
    expect(result.blended).toBeCloseTo((result.epley + result.brzycki) / 2, 5)
  })
})
