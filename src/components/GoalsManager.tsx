import { useState } from 'react'
import { useGoals } from '../hooks/useGoals'
import { useGoalMutations, type GoalInput } from '../hooks/useGoalsManagement'
import { useExercisesList } from '../hooks/useExercisesList'
import type { GoalCategory } from '../lib/types/canonical'

const CATEGORY_OPTIONS: { value: GoalCategory; label: string }[] = [
  { value: 'strength', label: 'Kracht' },
  { value: 'reps', label: 'Reps' },
  { value: 'bodyweight_calisthenics', label: 'Lichaamsgewicht-oefening' },
  { value: 'cardio_distance', label: 'Cardio (afstand)' },
  { value: 'cardio_time', label: 'Cardio (tijd)' },
  { value: 'cluster6', label: 'Cluster 6' },
  { value: 'bodyweight', label: 'Lichaamsgewicht' },
  { value: 'consistency', label: 'Consistentie' },
  { value: 'training_volume', label: 'Trainingsvolume' },
]

const inputClass = 'min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary'
const labelClass = 'mb-1 block text-xs text-text-secondary'

function EditGoalForm({ goalId, initial, onDone }: { goalId: string; initial: { name: string; targetValue: number; deadline: string | null; priority: number }; onDone: () => void }) {
  const { update } = useGoalMutations()
  const [name, setName] = useState(initial.name)
  const [targetValue, setTargetValue] = useState(String(initial.targetValue))
  const [deadline, setDeadline] = useState(initial.deadline ?? '')
  const [priority, setPriority] = useState(String(initial.priority))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await update.mutateAsync({
      id: goalId,
      input: { name, targetValue: parseFloat(targetValue), deadline: deadline || null, priority: parseInt(priority, 10) },
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-2 border-t border-gridline pt-3">
      <div className="col-span-2">
        <label className={labelClass}>Naam</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Target</label>
        <input type="number" step="0.1" className={inputClass} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Prioriteit</label>
        <input type="number" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)} required />
      </div>
      <div className="col-span-2">
        <label className={labelClass}>Deadline (optioneel)</label>
        <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div className="col-span-2 flex gap-2">
        <button type="submit" disabled={update.isPending} className="min-h-11 flex-1 rounded-md bg-series-1 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-md border border-border px-3 py-2 text-sm font-semibold">
          Annuleren
        </button>
      </div>
    </form>
  )
}

function NewGoalForm({ onDone }: { onDone: () => void }) {
  const { create } = useGoalMutations()
  const { data: exercises } = useExercisesList()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<GoalCategory>('strength')
  const [unit, setUnit] = useState('kg')
  const [targetValue, setTargetValue] = useState('')
  const [startValue, setStartValue] = useState('')
  const [deadline, setDeadline] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const input: GoalInput = {
      name,
      category,
      unit,
      targetValue: parseFloat(targetValue),
      startValue: startValue ? parseFloat(startValue) : null,
      deadline: deadline || null,
      exerciseId: exerciseId || null,
      priority: 100,
    }
    try {
      await create.mutateAsync(input)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-2 border-t border-gridline pt-3">
      <div className="col-span-2">
        <label className={labelClass}>Naam</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="bijv. Squat" required />
      </div>
      <div>
        <label className={labelClass}>Categorie</label>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)}>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Eenheid</label>
        <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, reps, km..." required />
      </div>
      <div>
        <label className={labelClass}>Startwaarde (optioneel)</label>
        <input type="number" step="0.1" className={inputClass} value={startValue} onChange={(e) => setStartValue(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Target</label>
        <input type="number" step="0.1" className={inputClass} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} required />
      </div>
      <div className="col-span-2">
        <label className={labelClass}>Gekoppelde oefening (optioneel — voor automatische voortgang)</label>
        <select className={inputClass} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="">Geen</option>
          {exercises?.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.canonicalName}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className={labelClass}>Deadline (optioneel)</label>
        <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      {error && <p className="col-span-2 text-xs text-status-crit">{error}</p>}
      <div className="col-span-2 flex gap-2">
        <button type="submit" disabled={create.isPending} className="min-h-11 flex-1 rounded-md bg-series-1 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {create.isPending ? 'Bezig…' : 'Doel toevoegen'}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-md border border-border px-3 py-2 text-sm font-semibold">
          Annuleren
        </button>
      </div>
    </form>
  )
}

export function GoalsManager() {
  const { data: goals, isLoading } = useGoals()
  const { remove } = useGoalMutations()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  if (isLoading) return <p className="text-sm text-text-muted">Laden…</p>

  return (
    <div>
      <div className="flex flex-col gap-3">
        {goals?.map(({ goal }) => (
          <div key={goal.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{goal.name}</div>
                <div className="text-xs text-text-muted">
                  {goal.targetValue} {goal.unit}
                  {goal.deadline ? ` · deadline ${new Date(goal.deadline).toLocaleDateString('nl-NL')}` : ''}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setEditingId(editingId === goal.id ? null : goal.id)} className="min-h-11 rounded-md border border-border px-2.5 font-semibold">
                  Bewerken
                </button>
                {confirmDeleteId === goal.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      remove.mutate(goal.id)
                      setConfirmDeleteId(null)
                    }}
                    className="min-h-11 rounded-md border border-status-crit bg-status-crit/10 px-2.5 font-semibold text-status-crit"
                  >
                    Bevestig
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(goal.id)} className="min-h-11 rounded-md border border-border px-2.5 font-semibold text-text-muted hover:text-status-crit">
                    Verwijderen
                  </button>
                )}
              </div>
            </div>
            {editingId === goal.id && (
              <EditGoalForm
                goalId={goal.id}
                initial={{ name: goal.name, targetValue: goal.targetValue, deadline: goal.deadline, priority: goal.priority }}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        ))}
      </div>

      {showNewForm ? (
        <NewGoalForm onDone={() => setShowNewForm(false)} />
      ) : (
        <button type="button" onClick={() => setShowNewForm(true)} className="mt-3 min-h-11 w-full rounded-md border border-dashed border-border px-3 py-2 text-sm font-semibold text-accent-text">
          + Nieuw doel toevoegen
        </button>
      )}
    </div>
  )
}
