import { useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useTrainingSessions } from '../hooks/useTrainingSessions'
import { isSupabaseConfigured } from '../lib/supabase'
import { classifySessionType, type SessionMovementType, type SessionSubtype } from '../lib/training/classifySession'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_LABEL: Record<SessionMovementType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }
const SUBTYPE_LABEL: Record<'heavy' | 'volume', string> = { heavy: 'Heavy', volume: 'Volume' }

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md border px-3 py-1.5 text-xs font-semibold ${
        active ? 'border-series-1 bg-series-1-wash text-accent-text' : 'border-border text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function TrainingPage() {
  const { data: sessions, isLoading } = useTrainingSessions()
  const [typeFilter, setTypeFilter] = useState<SessionMovementType | 'all'>('all')
  const [subtypeFilter, setSubtypeFilter] = useState<SessionSubtype | 'all'>('all')

  const totalSessions = sessions?.length ?? 0
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && totalSessions === 0)

  const classified = useMemo(() => (sessions ?? []).map((s) => ({ session: s, classification: classifySessionType(s.notes) })), [sessions])

  const filtered = classified.filter(({ classification }) => {
    if (typeFilter !== 'all' && !classification.types.includes(typeFilter)) return false
    if (subtypeFilter !== 'all' && classification.subtype !== subtypeFilter) return false
    return true
  })

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
          <Card
            subtitle="Push/Pull/Legs- en Heavy/Volume-classificatie komt uit de Hevy-workouttitel (bijv. 'donderdag push + benen'). Ongeveer 40% van de titels is een generieke Hevy-standaardnaam zonder herkenbaar schema -- die blijven bewust ongeclassificeerd."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterButton active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
                Alle types
              </FilterButton>
              {(['push', 'pull', 'legs'] as const).map((t) => (
                <FilterButton key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {TYPE_LABEL[t]}
                </FilterButton>
              ))}
              <span className="mx-1 self-center text-text-muted">|</span>
              <FilterButton active={subtypeFilter === 'all'} onClick={() => setSubtypeFilter('all')}>
                Alle
              </FilterButton>
              {(['heavy', 'volume'] as const).map((st) => (
                <FilterButton key={st} active={subtypeFilter === st} onClick={() => setSubtypeFilter(st)}>
                  {SUBTYPE_LABEL[st]}
                </FilterButton>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Datum', 'Titel', 'Type', 'Bron', 'Sets'].map((h) => (
                      <th key={h} className="border-b border-gridline py-2 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ session: s, classification }) => (
                    <tr key={s.id}>
                      <td className="border-b border-gridline py-2">{formatDate(s.date)}</td>
                      <td className="border-b border-gridline py-2">{s.notes ?? '–'}</td>
                      <td className="border-b border-gridline py-2">
                        {classification.types.length ? classification.types.map((t) => TYPE_LABEL[t]).join(' + ') : '–'}
                        {classification.subtype && ` · ${SUBTYPE_LABEL[classification.subtype]}`}
                      </td>
                      <td className="border-b border-gridline py-2 capitalize">{s.source}</td>
                      <td className="border-b border-gridline py-2">{s.setCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="py-4 text-center text-sm text-text-muted">Geen sessies met dit filter.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
