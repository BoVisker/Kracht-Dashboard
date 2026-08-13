import { Card } from '../components/ui/Card'
import { HevyKeyForm } from '../components/HevyKeyForm'
import { GoalsManager } from '../components/GoalsManager'
import { ClusterRequirementsManager } from '../components/ClusterRequirementsManager'
import { isSupabaseConfigured } from '../lib/supabase'

export function SettingsPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Settings</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Hevy" subtitle="API-sleutel koppelen voor krachttraining-sync.">
          {isSupabaseConfigured() ? (
            <HevyKeyForm />
          ) : (
            <p className="text-sm text-text-muted">Vereist een gekoppeld Supabase-project — zie README.md.</p>
          )}
        </Card>
        <Card title="Doelen" subtitle="Deadlines, targets en prioriteit per doel bewerken of nieuwe doelen toevoegen." className="md:col-span-2">
          {isSupabaseConfigured() ? <GoalsManager /> : <p className="text-sm text-text-muted">Vereist een gekoppeld Supabase-project — zie README.md.</p>}
        </Card>
        <Card title="Trainingsplan" subtitle="Van tevoren een weekschema plannen (welke dag push/pull/legs) en sessies daaraan koppelen.">
          <p className="text-sm text-text-muted">
            Nog te bouwen. De classificatie zelf (Push/Pull/Legs + Heavy/Volume, afgeleid uit je Hevy-titels) werkt al — zie de Training-pagina. Dit zou een losstaande planning-editor zijn, geen kleine aanvulling daarop.
          </p>
        </Card>
        <Card title="Cluster 6 configuratie" subtitle="Target-waarden en buffer-marges per vereiste aanpassen, zonder redeploy." className="md:col-span-2">
          {isSupabaseConfigured() ? <ClusterRequirementsManager /> : <p className="text-sm text-text-muted">Vereist een gekoppeld Supabase-project — zie README.md.</p>}
        </Card>
        <Card title="Units & privacy" subtitle="kg/lbs, km/mi, data-export en verwijderen.">
          <p className="text-sm text-text-muted">Nog te bouwen.</p>
        </Card>
      </div>
    </div>
  )
}
