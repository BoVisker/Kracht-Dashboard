import { useState } from 'react'
import { usePlannedSessions, useSetPlannedSession, useDeletePlannedSession, WEEKDAY_ORDER } from '../hooks/usePlannedSessions'
import type { DayOfWeek, PlannedSession } from '../lib/types/canonical'

const inputClass = 'min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary'
const labelClass = 'mb-1 block text-xs text-text-secondary'

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
}

const TRAINING_TYPE_LABELS: Record<PlannedSession['trainingType'], string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  cardio: 'Cardio',
  rest: 'Rust',
  other: 'Overig',
}

function SlotForm({
  dayOfWeek,
  sortOrder,
  existing,
  onDone,
}: {
  dayOfWeek: DayOfWeek
  sortOrder: number
  existing?: PlannedSession
  onDone: () => void
}) {
  const setSession = useSetPlannedSession()
  const [label, setLabel] = useState(existing?.label ?? '')
  const [trainingType, setTrainingType] = useState<PlannedSession['trainingType']>(existing?.trainingType ?? 'other')
  const [trainingSubtype, setTrainingSubtype] = useState<PlannedSession['trainingSubtype']>(existing?.trainingSubtype ?? null)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const subtypeApplicable = trainingType === 'push' || trainingType === 'pull' || trainingType === 'legs'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await setSession.mutateAsync({
      id: existing?.id,
      dayOfWeek,
      sortOrder: existing?.sortOrder ?? sortOrder,
      trainingType,
      trainingSubtype: subtypeApplicable ? trainingSubtype : null,
      label,
      notes: notes.trim() === '' ? null : notes,
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 border-t border-gridline pt-2">
      <div>
        <label className={labelClass}>Label</label>
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="bv. Push Heavy" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={trainingType} onChange={(e) => setTrainingType(e.target.value as PlannedSession['trainingType'])}>
            {Object.entries(TRAINING_TYPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Subtype</label>
          <select
            className={inputClass}
            value={trainingSubtype ?? ''}
            onChange={(e) => setTrainingSubtype(e.target.value === '' ? null : (e.target.value as 'heavy' | 'volume'))}
            disabled={!subtypeApplicable}
          >
            <option value="">—</option>
            <option value="heavy">Heavy</option>
            <option value="volume">Volume</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Notitie (optioneel)</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="bv. rustig tempo, praat-test" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={setSession.isPending} className="min-h-11 flex-1 rounded-md bg-series-1 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-md border border-border px-3 py-2 text-sm font-semibold">
          Annuleren
        </button>
      </div>
    </form>
  )
}

/**
 * Roadmap "trainingsplan-editor": a repeating weekly template, edited here
 * and read by DashboardPage's Today card. Deliberately not a calendar --
 * see migration 0006 for why.
 */
export function PlannedSessionsManager() {
  const { data: sessions, isLoading } = usePlannedSessions()
  const deleteSession = useDeletePlannedSession()
  const [editing, setEditing] = useState<{ day: DayOfWeek; id: string | 'new' } | null>(null)

  if (isLoading || !sessions) return <p className="text-sm text-text-muted">Laden…</p>

  return (
    <div className="flex flex-col gap-4">
      {WEEKDAY_ORDER.map((day) => {
        const daySessions = sessions.filter((s) => s.dayOfWeek === day)
        return (
          <div key={day} className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{DAY_LABELS[day]}</div>
              <button
                type="button"
                onClick={() => setEditing({ day, id: 'new' })}
                className="min-h-11 rounded-md border border-border px-2.5 text-xs font-semibold"
              >
                + Sessie toevoegen
              </button>
            </div>
            {daySessions.length === 0 && editing?.day !== day && <p className="text-xs text-text-muted">Geen sessies gepland.</p>}
            <div className="flex flex-col gap-2">
              {daySessions.map((s) => (
                <div key={s.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold text-text-primary">{s.label}</span>
                      <span className="text-text-muted">
                        {' '}
                        · {TRAINING_TYPE_LABELS[s.trainingType]}
                        {s.trainingSubtype ? ` (${s.trainingSubtype})` : ''}
                      </span>
                      {s.notes && <div className="text-xs text-text-muted">{s.notes}</div>}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => setEditing({ day, id: s.id })} className="min-h-11 rounded-md border border-border px-2.5 font-semibold">
                        Bewerken
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession.mutate(s.id)}
                        className="min-h-11 rounded-md border border-border px-2.5 font-semibold text-text-muted hover:text-status-crit"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                  {editing?.day === day && editing.id === s.id && (
                    <SlotForm dayOfWeek={day} sortOrder={s.sortOrder} existing={s} onDone={() => setEditing(null)} />
                  )}
                </div>
              ))}
            </div>
            {editing?.day === day && editing.id === 'new' && (
              <SlotForm dayOfWeek={day} sortOrder={daySessions.length} onDone={() => setEditing(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
