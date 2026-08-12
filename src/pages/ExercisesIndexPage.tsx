import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { useExercisesList } from '../hooks/useExercisesList'
import { isSupabaseConfigured } from '../lib/supabase'

export function ExercisesIndexPage() {
  const { data: exercises, isLoading } = useExercisesList()
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
            <Link
              key={ex.id}
              to={`/exercises/${ex.id}`}
              className="block rounded-xl border border-border bg-card-bg p-4 hover:border-series-1"
            >
              <div className="text-sm font-semibold text-text-primary">{ex.canonicalName}</div>
              <div className="mt-1 text-xs text-text-muted">{ex.setCount} sets gelogd</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
