import { describe, expect, it } from 'vitest'
import { classifySessionType } from './classifySession'

describe('classifySessionType', () => {
  it('returns an empty classification for null (no title logged)', () => {
    expect(classifySessionType(null)).toEqual({ types: [], subtype: null })
  })

  it("honestly returns unclassified for Hevy's generic default titles rather than guessing", () => {
    // ~40% of this user's real sessions are titled exactly like this.
    expect(classifySessionType('Afternoon workout 💪').types).toEqual([])
    expect(classifySessionType('Late night workout 🌙').types).toEqual([])
    expect(classifySessionType('Morning workout ☀️').types).toEqual([])
  })

  it('returns unclassified for a bare day name or nonsense title', () => {
    expect(classifySessionType('maandag').types).toEqual([])
    expect(classifySessionType('w').types).toEqual([])
  })

  it('detects a single explicit type', () => {
    expect(classifySessionType('donderdag push').types).toEqual(['push'])
    expect(classifySessionType('Vrijdag pull').types).toEqual(['pull'])
  })

  it('detects both types in a combined session, in order of mention', () => {
    expect(classifySessionType('donderdag push + benen').types).toEqual(['push', 'legs'])
    expect(classifySessionType('dinsdag pull + benen').types).toEqual(['pull', 'legs'])
  })

  it('ignores unrelated words like "cardio" that share no keyword', () => {
    expect(classifySessionType('dinsdag/vrijdag pull + cardio').types).toEqual(['pull'])
  })

  it('detects heavy and volume subtypes', () => {
    expect(classifySessionType('Pull (HEAVY)')).toEqual({ types: ['pull'], subtype: 'heavy' })
    expect(classifySessionType('maandag (PUSH) heavy')).toEqual({ types: ['push'], subtype: 'heavy' })
    expect(classifySessionType('Legs volume')).toEqual({ types: ['legs'], subtype: 'volume' })
  })

  it('falls back to muscle-group keywords when push/pull/legs are never mentioned outright', () => {
    // Real titles from this user's account.
    expect(classifySessionType('Borst, tricep').types).toEqual(['push'])
    expect(classifySessionType('Rug, bicep, schouders 2.0').types).toEqual(['pull'])
  })

  it('does not guess a type from "schouders" (shoulders) alone -- genuinely ambiguous between push and pull', () => {
    expect(classifySessionType('Woensdag upper - core').types).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(classifySessionType('PUSH DAY').types).toEqual(['push'])
  })
})
