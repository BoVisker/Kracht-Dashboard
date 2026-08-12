export interface ParsedRecoveryRow {
  date: string // ISO date, YYYY-MM-DD
  restingHeartRate: number | null
  hrvMs: number | null
  sleepDurationMinutes: number | null
  sleepScore: number | null
  bodyBattery: number | null
  stressAverage: number | null
}

export type RecoveryField = Exclude<keyof ParsedRecoveryRow, 'date'>

export interface ParseRecoveryResult {
  rows: ParsedRecoveryRow[]
  /** Which source column got matched to which field, so the UI can show the user exactly what was read -- no silent guessing. */
  matchedColumns: Partial<Record<RecoveryField | 'date', string>>
  /** Rows with no parseable date were dropped rather than guessed at -- this count says how many. */
  skippedRows: number
}

const HEADER_PATTERNS: Record<RecoveryField | 'date', (h: string) => boolean> = {
  date: (h) => h.includes('date') || h === 'day',
  restingHeartRate: (h) => (h.includes('resting') && h.includes('heart')) || h === 'rhr',
  hrvMs: (h) => h.includes('hrv'),
  sleepDurationMinutes: (h) => h.includes('sleep') && (h.includes('duration') || h.includes('hours') || h.includes('time') || h.includes('length')) && !h.includes('score'),
  sleepScore: (h) => h.includes('sleep') && h.includes('score'),
  bodyBattery: (h) => h.includes('battery'),
  stressAverage: (h) => h.includes('stress'),
}

/** Lowercase + strip everything but letters, so "Resting Heart Rate (bpm)" and "resting_heart_rate" both match the same pattern. */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, '')
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '--' || trimmed.toLowerCase() === 'n/a') return null
  const value = parseFloat(trimmed.replace(',', '.'))
  return Number.isNaN(value) ? null : value
}

/** Garmin sleep duration shows up as "7:32" (h:mm), a decimal-hours column, or a plain minutes column depending on export -- handle all three rather than guessing one and silently misreading the others. */
function parseSleepDuration(raw: string | undefined, headerHint: string): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [h, m] = trimmed.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const value = parseNumber(trimmed)
  if (value === null) return null
  return headerHint.includes('hour') ? Math.round(value * 60) : Math.round(value)
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Splits a CSV line respecting simple double-quoted fields -- good enough for the flat, no-embedded-newline exports Garmin Connect's "Download CSV" buttons produce. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * Best-effort parser for a Garmin Connect CSV export (Health Stats page's
 * "Download CSV" button, or similar). There's no fixed spec for this --
 * Garmin's export columns vary by which stats page it came from -- so this
 * matches on flexible header keywords instead of a fixed schema, and never
 * guesses a value it can't confidently parse. Rows with no readable date
 * are dropped, not defaulted to "today" or silently misfiled.
 */
export function parseRecoveryCsv(csvText: string): ParseRecoveryResult | { error: string } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { error: 'Bestand bevat geen datarijen (alleen een header, of leeg).' }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const normalized = headers.map(normalizeHeader)

  const columnIndex: Partial<Record<RecoveryField | 'date', number>> = {}
  const matchedColumns: Partial<Record<RecoveryField | 'date', string>> = {}
  for (const field of Object.keys(HEADER_PATTERNS) as (RecoveryField | 'date')[]) {
    const idx = normalized.findIndex((h) => HEADER_PATTERNS[field](h))
    if (idx >= 0) {
      columnIndex[field] = idx
      matchedColumns[field] = headers[idx]
    }
  }

  if (columnIndex.date === undefined) {
    return { error: `Kon geen datumkolom vinden. Kolommen in het bestand: ${headers.join(', ')}` }
  }

  const rows: ParsedRecoveryRow[] = []
  let skippedRows = 0
  const sleepHeaderHint = matchedColumns.sleepDurationMinutes ? normalizeHeader(matchedColumns.sleepDurationMinutes) : ''

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const date = parseDate(cells[columnIndex.date])
    if (!date) {
      skippedRows++
      continue
    }
    rows.push({
      date,
      restingHeartRate: columnIndex.restingHeartRate !== undefined ? parseNumber(cells[columnIndex.restingHeartRate]) : null,
      hrvMs: columnIndex.hrvMs !== undefined ? parseNumber(cells[columnIndex.hrvMs]) : null,
      sleepDurationMinutes: columnIndex.sleepDurationMinutes !== undefined ? parseSleepDuration(cells[columnIndex.sleepDurationMinutes], sleepHeaderHint) : null,
      sleepScore: columnIndex.sleepScore !== undefined ? parseNumber(cells[columnIndex.sleepScore]) : null,
      bodyBattery: columnIndex.bodyBattery !== undefined ? parseNumber(cells[columnIndex.bodyBattery]) : null,
      stressAverage: columnIndex.stressAverage !== undefined ? parseNumber(cells[columnIndex.stressAverage]) : null,
    })
  }

  return { rows, matchedColumns, skippedRows }
}
