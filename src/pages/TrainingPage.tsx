import { Fragment, useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useTrainingSessions } from '../hooks/useTrainingSessions'
import {
  useSessionClassificationOverrides,
  useSetSessionClassificationOverride,
  useResetSessionClassificationOverride,
  type SessionClassificationOverride,
} from '../hooks/useSessionClassificationOverrides'
import { isSupabaseConfigured } from '../lib/supabase'
import { classifySessionType, type SessionMovementType, type SessionSubtype, type SessionClassification } from '../lib/training/classifySession'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_LABEL: Record<SessionMovementType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' }
const SUBTYPE_LABEL: Record<'heavy' | 'volume', string> = { heavy: 'Heavy', volume: 'Volume' }
const ALL_TYPES: SessionMovementType[] = ['push', 'pull', 'legs']

function ClassificationEditForm({ sessionId, current, onDone }: { sessionId: string; current: SessionClassification; onDone: () => void }) {
  const setOverride = useSetSessionClassificationOverride()
  const [types, setTypes] = useState<SessionMovementType[]>(current.types)
  const [subtype, setSubtype] = useState<SessionSubtype>(current.subtype)

  function toggleType(t: SessionMovementType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const override: SessionClassificationOverride = { sessionId, types, subtype }
    await setOverride.mutateAsync(override)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 py-2">
      <div className="flex gap-2">
        {ALL_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
            {TYPE_LABEL[t]}
          </label>
        ))}
      </div>
      <select
        className="min-h-11 rounded-md border border-border bg-surface-1 px-2 text-xs"
        value={subtype ?? ''}
        onChange={(e) => setSubtype(e.target.value === '' ? null : (e.target.value as 'heavy' | 'volume'))}
      >
        <option value="">Geen subtype</option>
        <option value="heavy">Heavy</option>
        <option value="volume">Volume</option>
      </select>
      <button type="submit" disabled={setOverride.isPending} className="min-h-11 rounded-md bg-series-1 px-3 text-xs font-semibold text-white disabled:opacity-50">
        Opslaan
      </button>
      <button type="button" onClick={onDone} className="min-h-11 rounded-md border border-border px-3 text-xs font-semibold">
        Annuleren
      </button>
    </form>
  )
}

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
  const { data: overrides } = useSessionClassificationOverrides()
  const resetOverride = useResetSessionClassificationOverride()
  const [typeFilter, setTypeFilter] = useState<SessionMovementType | 'all'>('all')
  const [subtypeFilter, setSubtypeFilter] = useState<SessionSubtype | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalSessions = sessions?.length ?? 0
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && totalSessions === 0)

  const classified = useMemo(
    () =>
      (sessions ?? []).map((s) => {
        const override = overrides?.[s.id]
        return {
          session: s,
          classification: override ? { types: override.types, subtype: override.subtype } : classifySessionType(s.notes),
          hasOverride: !!override,
        }
      }),
    [sessions, overrides],
  )

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
                    {['Datum', 'Titel', 'Type', 'Bron', 'Sets', ''].map((h) => (
                      <th key={h} className="border-b border-gridline py-2 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ session: s, classification, hasOverride }) => (
                    <Fragment key={s.id}>
                      <tr>
                        <td className="border-b border-gridline py-2">{formatDate(s.date)}</td>
                        <td className="border-b border-gridline py-2">{s.notes ?? '–'}</td>
                        <td className="border-b border-gridline py-2">
                          {classification.types.length ? classification.types.map((t) => TYPE_LABEL[t]).join(' + ') : '–'}
                          {classification.subtype && ` · ${SUBTYPE_LABEL[classification.subtype]}`}
                          {hasOverride && <span className="ml-1 text-[10px] text-text-muted">(handmatig)</span>}
                        </td>
                        <td className="border-b border-gridline py-2 capitalize">{s.source}</td>
                        <td className="border-b border-gridline py-2">{s.setCount}</td>
                        <td className="border-b border-gridline py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                            className="min-h-11 rounded-md border border-border px-2 text-xs font-semibold"
                          >
                            Bewerken
                          </button>
                          {hasOverride && (
                            <button
                              type="button"
                              onClick={() => resetOverride.mutate(s.id)}
                              className="ml-1 min-h-11 rounded-md border border-border px-2 text-xs font-semibold text-text-muted hover:text-status-crit"
                            >
                              Reset
                            </button>
                          )}
                        </td>
                      </tr>
                      {editingId === s.id && (
                        <tr>
                          <td colSpan={6} className="border-b border-gridline bg-surface-1 px-2">
                            <ClassificationEditForm sessionId={s.id} current={classification} onDone={() => setEditingId(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
