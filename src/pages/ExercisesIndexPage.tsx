import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { useExercisesList, useTogglePinExercise } from '../hooks/useExercisesList'
import { isSupabaseConfigured } from '../lib/supabase'

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path d="M10 2.5c-2.2 0-4 1.8-4 4 0 1.9 1.3 3.4 3 3.9V15l1 2 1-2v-4.6c1.7-.5 3-2 3-3.9 0-2.2-1.8-4-4-4z" strokeLinejoin="round" />
    </svg>
  )
}

export function ExercisesIndexPage() {
  const { data: exercises, isLoading } = useExercisesList()
  const togglePin = useTogglePinExercise()
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && !exercises?.length)

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Exercises</h2>
      {showEmptyState ? (
        <Card>
          <InsufficientData label="Nog geen oefeningen gevonden. Koppel Hevy via de Sync-pagina." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises?.map((ex) => (
            <div
              key={ex.id}
              className={`relative rounded-xl border bg-card-bg p-4 ${ex.isPinned ? 'border-series-1' : 'border-border'}`}
            >
              <button
                type="button"
                onClick={() => togglePin.mutate({ id: ex.id, pinned: !ex.isPinned })}
                aria-label={ex.isPinned ? `${ex.canonicalName} losmaken` : `${ex.canonicalName} pinnen`}
                aria-pressed={ex.isPinned}
                className={`absolute top-2 right-2 flex min-h-11 min-w-11 items-center justify-center rounded-md ${ex.isPinned ? 'text-accent-text' : 'text-text-muted hover:text-text-primary'}`}
              >
                <PinIcon filled={ex.isPinned} />
              </button>
              <Link to={`/exercises/${ex.id}`} className="block pr-8 hover:opacity-90">
                <div className="text-sm font-semibold text-text-primary">{ex.canonicalName}</div>
                <div className="mt-1 text-xs text-text-muted">{ex.setCount} sets gelogd</div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
