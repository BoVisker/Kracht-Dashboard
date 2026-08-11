import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useCardioSessions } from '../hooks/useCardioSessions'
import { isSupabaseConfigured } from '../lib/supabase'
import type { CardioSession } from '../lib/types/canonical'

function formatDistance(meters: number | null): string {
  if (meters == null) return '–'
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Pace only means something for on-foot sports moving forward over distance -- silently null for e.g. swims/rides where speed reads more naturally. */
function formatPace(session: CardioSession): string {
  if (!session.distanceMeters || !session.movingTimeSeconds) return '–'
  const paceSecPerKm = session.movingTimeSeconds / (session.distanceMeters / 1000)
  const min = Math.floor(paceSecPerKm / 60)
  const sec = Math.round(paceSecPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')} /km`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CardioPage() {
  const { data: sessions, isLoading } = useCardioSessions()

  const totalDistance = sessions?.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0) ?? 0
  const totalSessions = sessions?.length ?? 0
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && totalSessions === 0)

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Cardio</h2>

      {showEmptyState ? (
        <Card subtitle="Afstand, pace, hartslag-zones, elevation en training load zodra Strava is gekoppeld.">
          <InsufficientData label="Nog geen cardio-sessies gesynchroniseerd. Koppel Strava via de Sync-pagina." />
        </Card>
      ) : (
        <>
          <TileGrid>
            <Tile label="Sessies" value={isLoading ? '…' : String(totalSessions)} />
            <Tile label="Totale afstand" value={isLoading ? '…' : formatDistance(totalDistance)} />
          </TileGrid>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Datum', 'Sport', 'Afstand', 'Duur', 'Pace', 'Gem. hartslag'].map((h) => (
                      <th key={h} className="border-b border-gridline py-2 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions?.map((s) => (
                    <tr key={s.id}>
                      <td className="border-b border-gridline py-2">{formatDate(s.date)}</td>
                      <td className="border-b border-gridline py-2">{s.sport}</td>
                      <td className="border-b border-gridline py-2">{formatDistance(s.distanceMeters)}</td>
                      <td className="border-b border-gridline py-2">{formatDuration(s.movingTimeSeconds)}</td>
                      <td className="border-b border-gridline py-2">{formatPace(s)}</td>
                      <td className="border-b border-gridline py-2">{s.averageHeartRate != null ? `${Math.round(s.averageHeartRate)} bpm` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
