import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { LineChart, type ChartPoint } from '../components/ui/LineChart'
import { useExerciseDetail, type ExerciseSetHistoryEntry } from '../hooks/useExerciseDetail'
import { estimate1RM } from '../lib/strength/estimate1RM'
import { detectPersonalRecords } from '../lib/strength/personalRecords'

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Short form for axis ticks -- the full date (with year) is still in each point's tooltip/table label. */
function formatDateShort(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/** Best (highest e1RM) set per session, in chronological order -- the same "top set of the day" idea the original prototype used, generalized to any exercise. */
function bestSetPerSession(history: ExerciseSetHistoryEntry[]): { sessionId: string; date: Date; weightKg: number; reps: number; e1rm: number }[] {
  const bySession = new Map<string, { date: Date; weightKg: number; reps: number; e1rm: number }>()
  for (const set of history) {
    const e1rm = estimate1RM(set.weightKg, set.reps).blended
    const existing = bySession.get(set.sessionId)
    if (!existing || e1rm > existing.e1rm) {
      bySession.set(set.sessionId, { date: set.date, weightKg: set.weightKg, reps: set.reps, e1rm })
    }
  }
  return Array.from(bySession.entries())
    .map(([sessionId, v]) => ({ sessionId, ...v }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function ExercisePage() {
  const { id } = useParams<{ id: string }>()
  const { data: detail, isLoading } = useExerciseDetail(id)

  const sessionSeries = useMemo(() => bestSetPerSession(detail?.history ?? []), [detail])
  const records = useMemo(() => detectPersonalRecords(detail?.history ?? []), [detail])

  const label = detail?.canonicalName ?? (isLoading ? '…' : 'Onbekende oefening')

  if (!isLoading && !detail) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Oefening niet gevonden</h2>
        <Card>
          <InsufficientData label="Deze oefening bestaat niet (meer) of hoort niet bij jouw account." />
        </Card>
      </div>
    )
  }

  // Weeks-since-first-session, not raw days: LineChart's tick-spacing logic
  // assumes the x-domain's span is roughly "number of ticks worth" of
  // units. With real multi-month history that's 200+ raw days, which
  // packed dozens of illegible overlapping date labels along the bottom
  // axis -- confirmed live. Weeks keeps the same chart readable whether
  // the history spans one month or two years.
  const startDate = sessionSeries[0]?.date
  const MS_PER_WEEK = 7 * 86_400_000
  const chartPoints: ChartPoint[] = sessionSeries.map((s) => {
    const x = startDate ? (s.date.getTime() - startDate.getTime()) / MS_PER_WEEK : 0
    const isPR = records.estimated_1rm != null && Math.abs(s.e1rm - records.estimated_1rm.value) < 0.05
    return {
      x,
      y: Math.round(s.e1rm * 10) / 10,
      label: `${formatDate(s.date)} · ${s.weightKg}kg × ${s.reps} (e1RM ${Math.round(s.e1rm * 10) / 10}kg)`,
      isPR,
    }
  })

  const latest = sessionSeries[sessionSeries.length - 1]
  const latestEstimate = latest ? estimate1RM(latest.weightKg, latest.reps) : null

  const frequency = (() => {
    if (sessionSeries.length < 2) return null
    const spanDays = (sessionSeries[sessionSeries.length - 1].date.getTime() - sessionSeries[0].date.getTime()) / 86_400_000
    if (spanDays < 7) return null
    return (sessionSeries.length / (spanDays / 7)).toFixed(1)
  })()

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{label}</h2>
      <TileGrid>
        <Tile label="All-time max (weight PR)" value={records.weight ? `${records.weight.value}kg` : '–'} sub={records.weight ? formatDate(records.weight.date) : 'nog geen data'} />
        <Tile
          label="Estimated 1RM (laatste sessie)"
          value={latestEstimate ? `${Math.round(latestEstimate.blended * 10) / 10}kg` : '–'}
          sub={latestEstimate ? `Epley/Brzycki · ${latestEstimate.reliability === 'good' ? 'betrouwbaar' : 'ruwe schatting (hoge reps)'}` : '–'}
        />
        <Tile label="Laatste sessie" value={latest ? formatDate(latest.date) : '–'} />
        <Tile label="Frequentie" value={frequency ?? '–'} sub="sessies / week" />
      </TileGrid>

      <Card title="Progressie" subtitle="Geschat 1RM (Epley/Brzycki-gemiddelde) per sessie, gebaseerd op de beste set van die dag.">
        <LineChart
          title={`Geschat 1RM voor ${label} over tijd`}
          actualSeries={chartPoints}
          xAxisLabel={(x) => (startDate ? formatDateShort(new Date(startDate.getTime() + x * MS_PER_WEEK)) : String(x))}
          emptyMessage="Nog geen sets gevonden voor deze oefening."
        />
      </Card>

      {(records.weight || records.reps || records.volume) && (
        <Card title="Personal Records" className="mt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {records.weight && (
              <div>
                <div className="text-xs text-text-muted">Zwaarste gewicht</div>
                <div className="text-lg font-semibold">{records.weight.detail}</div>
                <div className="text-xs text-text-secondary">{formatDate(records.weight.date)}</div>
              </div>
            )}
            {records.reps && (
              <div>
                <div className="text-xs text-text-muted">Meeste reps</div>
                <div className="text-lg font-semibold">{records.reps.detail}</div>
                <div className="text-xs text-text-secondary">{formatDate(records.reps.date)}</div>
              </div>
            )}
            {records.volume && (
              <div>
                <div className="text-xs text-text-muted">Hoogste sessievolume</div>
                <div className="text-lg font-semibold">{records.volume.value}kg</div>
                <div className="text-xs text-text-secondary">
                  {formatDate(records.volume.date)} · {records.volume.detail}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
