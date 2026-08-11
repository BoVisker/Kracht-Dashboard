import { describe, expect, it } from 'vitest'
import { classifyClusterResult } from './classify'
import { CLUSTER_6_REQUIREMENTS } from './requirements'

const cooperTest = CLUSTER_6_REQUIREMENTS.find((r) => r.id === 'run-12min')!

describe('classifyClusterResult', () => {
  it('returns not_measured when there is no value yet', () => {
    expect(classifyClusterResult(cooperTest, null)).toBe('not_measured')
  })

  it('returns below_target when far short of the requirement', () => {
    expect(classifyClusterResult(cooperTest, 2000)).toBe('below_target')
  })

  it('returns approaching when close but not there', () => {
    expect(classifyClusterResult(cooperTest, 2400)).toBe('approaching')
  })

  it('returns target_achieved right at the requirement', () => {
    expect(classifyClusterResult(cooperTest, 2700)).toBe('target_achieved')
  })

  it('returns buffer_achieved comfortably above the requirement', () => {
    expect(classifyClusterResult(cooperTest, 2850)).toBe('buffer_achieved')
  })

  it('returns strong_buffer_achieved well above the requirement', () => {
    expect(classifyClusterResult(cooperTest, 3200)).toBe('strong_buffer_achieved')
  })

  it('never claims a misleading fitness percentage — the return type is a discrete status, not a number', () => {
    const result = classifyClusterResult(cooperTest, 2850)
    expect(typeof result).toBe('string')
  })
})
