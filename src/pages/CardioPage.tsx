import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'

export function CardioPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Cardio</h2>
      <Card subtitle="Afstand, pace, hartslag-zones, elevation en training load zodra Strava is gekoppeld.">
        <InsufficientData label="Nog geen cardio-sessies gesynchroniseerd. Koppel Strava via de Sync-pagina." />
      </Card>
    </div>
  )
}
