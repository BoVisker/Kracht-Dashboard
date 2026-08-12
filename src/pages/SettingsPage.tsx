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
        <Card title="Trainingsplan" subtitle="Push/Pull/Legs-schema en heavy/volume-indeling.">
          <p className="text-sm text-text-muted">Nog te bouwen — komt met Trainingsplan-analyse (fase 9).</p>
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
