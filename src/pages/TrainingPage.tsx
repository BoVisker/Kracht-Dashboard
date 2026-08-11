import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'

export function TrainingPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Training History</h2>
      <Card subtitle="Filters: Push · Pull · Legs · Heavy · Volume · Exercise · Bron — beschikbaar zodra Hevy-sync is aangesloten.">
        <InsufficientData label="Nog geen trainingssessies gesynchroniseerd. Koppel Hevy via de Sync-pagina." />
      </Card>
    </div>
  )
}
