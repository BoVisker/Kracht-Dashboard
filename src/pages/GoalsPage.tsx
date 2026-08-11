import { GoalCard } from '../components/GoalCard'
import { useGoals } from '../hooks/useGoals'
import { InsufficientData } from '../components/ui/DataQualityTag'

export function GoalsPage() {
  const { data: goals, isLoading } = useGoals()

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Goals</h2>
      {isLoading ? (
        <InsufficientData label="Laden…" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals?.map(({ goal, percent }) => (
            <GoalCard key={goal.id} goal={goal} percent={percent} />
          ))}
        </div>
      )}
    </div>
  )
}
