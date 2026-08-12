import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useReport } from '../hooks/useReports'
import { isSupabaseConfigured } from '../lib/supabase'
import type { ReportPeriod } from '../lib/reports/periodReport'

const PERIOD_LABEL: Record<ReportPeriod, string> = { week: 'week', month: 'maand' }
const PERIOD_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30 }

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

function PeriodButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md border px-4 py-1.5 text-sm font-semibold ${
        active ? 'border-series-1 bg-series-1-wash text-accent-text' : 'border-border text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const { report, isLoading } = useReport(period)
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && !report)
  const periodLabel = PERIOD_LABEL[period]
  const priorLabel = `vorige ${periodLabel}`

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rapportage</h2>
        <div className="flex gap-2">
          <PeriodButton active={period === 'week'} onClick={() => setPeriod('week')}>
            Laatste 7 dagen
          </PeriodButton>
          <PeriodButton active={period === 'month'} onClick={() => setPeriod('month')}>
            Laatste 30 dagen
          </PeriodButton>
        </div>
      </div>

      {showEmptyState ? (
        <Card subtitle="Vergelijkt de laatste periode met de periode ervoor, op basis van je gesynchroniseerde training-, cardio- en PR-data.">
          <InsufficientData label="Nog geen data gesynchroniseerd. Koppel Hevy en/of Strava via de Sync-pagina." />
        </Card>
      ) : isLoading || !report ? (
        <Card>
          <InsufficientData label="Laden…" />
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Rollend venster van {PERIOD_DAYS[period]} dagen, vergeleken met de {PERIOD_DAYS[period]} dagen ervoor -- niet kalender{period === 'week' ? 'week' : 'maand'}, om altijd twee even lange periodes te vergelijken.
          </p>

          <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Kracht</h3>
          <TileGrid>
            <Tile label="Sessies" value={String(report.trainingSessions.current)} sub={`${priorLabel}: ${report.trainingSessions.previous}`} />
            <Tile label="Sets" value={String(report.sets.current)} sub={`${priorLabel}: ${report.sets.previous}`} />
          </TileGrid>

          <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Cardio</h3>
          <TileGrid>
            <Tile label="Sessies" value={String(report.cardioSessions.current)} sub={`${priorLabel}: ${report.cardioSessions.previous}`} />
            <Tile
              label="Afstand"
              value={formatDistance(report.cardioDistanceMeters.current)}
              sub={`${priorLabel}: ${formatDistance(report.cardioDistanceMeters.previous)}`}
            />
            <Tile
              label="Tijd"
              value={formatDuration(report.cardioMovingTimeSeconds.current)}
              sub={`${priorLabel}: ${formatDuration(report.cardioMovingTimeSeconds.previous)}`}
            />
          </TileGrid>

          <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Achievements</h3>
          <TileGrid>
            <Tile label="PR's" value={String(report.personalRecords.current)} sub={`${priorLabel}: ${report.personalRecords.previous}`} />
          </TileGrid>
        </>
      )}
    </div>
  )
}
