import { describe, expect, it } from 'vitest'
import { parseRecoveryCsv } from './parseRecoveryImport'

describe('parseRecoveryCsv', () => {
  it('errors on an empty file or header-only file rather than returning fabricated rows', () => {
    expect(parseRecoveryCsv('')).toEqual({ error: expect.stringContaining('geen datarijen') })
    expect(parseRecoveryCsv('Date,Resting Heart Rate')).toEqual({ error: expect.stringContaining('geen datarijen') })
  })

  it('errors when no date column can be found, listing the actual headers', () => {
    const result = parseRecoveryCsv('Foo,Bar\n1,2')
    expect(result).toEqual({ error: expect.stringContaining('Foo, Bar') })
  })

  it('parses a typical Garmin-style resting heart rate export', () => {
    const csv = ['Date,Resting Heart Rate (bpm)', '2026-08-10,52', '2026-08-11,54'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows).toEqual([
      { date: '2026-08-10', restingHeartRate: 52, hrvMs: null, sleepDurationMinutes: null, sleepScore: null, bodyBattery: null, stressAverage: null },
      { date: '2026-08-11', restingHeartRate: 54, hrvMs: null, sleepDurationMinutes: null, sleepScore: null, bodyBattery: null, stressAverage: null },
    ])
    expect(result.matchedColumns.restingHeartRate).toBe('Resting Heart Rate (bpm)')
    expect(result.skippedRows).toBe(0)
  })

  it('matches HRV, sleep score, body battery, and stress columns regardless of exact header wording', () => {
    const csv = ['day,hrv (ms),sleep score,body battery,avg stress', '2026-08-10,65,78,45,22'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows[0]).toMatchObject({ hrvMs: 65, sleepScore: 78, bodyBattery: 45, stressAverage: 22 })
  })

  it('parses sleep duration in h:mm format', () => {
    const csv = ['Date,Sleep Duration', '2026-08-10,7:32'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows[0].sleepDurationMinutes).toBe(452)
  })

  it('parses sleep duration given in decimal hours when the header says "hours"', () => {
    const csv = ['Date,Sleep Hours', '2026-08-10,7.5'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows[0].sleepDurationMinutes).toBe(450)
  })

  it('skips rows with an unparseable date rather than defaulting to today', () => {
    const csv = ['Date,Resting Heart Rate', '2026-08-10,52', 'not-a-date,60', '2026-08-12,50'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows).toHaveLength(2)
    expect(result.skippedRows).toBe(1)
  })

  it('treats blank, "--", and "n/a" cells as null rather than 0', () => {
    const csv = ['Date,Resting Heart Rate', '2026-08-10,', '2026-08-11,--', '2026-08-12,n/a'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows.every((r) => r.restingHeartRate === null)).toBe(true)
  })

  it('handles quoted fields containing commas', () => {
    const csv = ['Date,Notes,Resting Heart Rate', '2026-08-10,"felt tired, slept late",55'].join('\n')
    const result = parseRecoveryCsv(csv)
    if ('error' in result) throw new Error('expected success')
    expect(result.rows[0].restingHeartRate).toBe(55)
  })
})
