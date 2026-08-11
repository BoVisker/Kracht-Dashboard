import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useTrainingSessions } from '../hooks/useTrainingSessions'
import { isSupabaseConfigured } from '../lib/supabase'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TrainingPage() {
  const { data: sessions, isLoading } = useTrainingSessions()
  const totalSessions = sessions?.length ?? 0
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && totalSessions === 0)

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Training History</h2>

      {showEmptyState ? (
        <Card subtitle="Filters: Push · Pull · Legs · Heavy · Volume · Exercise · Bron — beschikbaar zodra Hevy-sync is aangesloten.">
          <InsufficientData label="Nog geen trainingssessies gesynchroniseerd. Koppel Hevy via de Sync-pagina." />
        </Card>
      ) : (
        <>
          <TileGrid>
            <Tile label="Sessies" value={isLoading ? '…' : String(totalSessions)} />
            <Tile label="Sets (totaal)" value={isLoading ? '…' : String(sessions?.reduce((sum, s) => sum + s.setCount, 0) ?? 0)} />
          </TileGrid>
          <Card subtitle="Push/Pull/Legs- en Heavy/Volume-filters komen met trainingsplan-analyse (fase 9) -- dat vereist het schema te herkennen aan de sessie, wat nog niet gebeurt.">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Datum', 'Titel', 'Bron', 'Sets'].map((h) => (
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
                      <td className="border-b border-gridline py-2">{s.notes ?? '–'}</td>
                      <td className="border-b border-gridline py-2 capitalize">{s.source}</td>
                      <td className="border-b border-gridline py-2">{s.setCount}</td>
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
