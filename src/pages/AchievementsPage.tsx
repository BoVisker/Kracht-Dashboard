import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useAchievements, type AchievementEvent } from '../hooks/useAchievements'
import type { PersonalRecordKind } from '../lib/strength/personalRecords'
import { isSupabaseConfigured } from '../lib/supabase'

const KIND_LABEL: Record<PersonalRecordKind, string> = {
  weight: 'Zwaarste gewicht',
  reps: 'Meeste reps',
  estimated_1rm: 'Geschat 1RM',
  volume: 'Sessievolume',
}

const KIND_TONE: Record<PersonalRecordKind, BadgeTone> = {
  weight: 'good',
  reps: 'good',
  estimated_1rm: 'good',
  volume: 'good',
}

const THIRTY_DAYS_MS = 30 * 86_400_000

function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function valueLabel(event: AchievementEvent): string {
  if (event.kind === 'reps') return `${event.value} reps`
  return `${event.value}kg`
}

export function AchievementsPage() {
  const { data: events, isLoading } = useAchievements()
  const showEmptyState = !isSupabaseConfigured() || (!isLoading && !events?.length)

  const recentCount = events?.filter((e) => Date.now() - e.date.getTime() <= THIRTY_DAYS_MS).length ?? 0

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Achievements</h2>

      {showEmptyState ? (
        <Card subtitle="Elke keer dat een set een eerder record verbetert (gewicht, reps, geschat 1RM, of sessievolume) verschijnt die hier -- de allereerste keer dat je een oefening doet telt niet mee, want dan is er nog niets om te verslaan.">
          <InsufficientData label="Nog geen PR's gevonden. Koppel Hevy via de Sync-pagina, of train verder -- records verschijnen automatisch zodra je een eerder record verbetert." />
        </Card>
      ) : (
        <>
          <TileGrid>
            <Tile label="PR's totaal" value={isLoading ? '…' : String(events?.length ?? 0)} />
            <Tile label="Laatste 30 dagen" value={isLoading ? '…' : String(recentCount)} />
          </TileGrid>

          <Card subtitle="Nieuwste eerst. Alleen echte verbeteringen t.o.v. een eerder record -- de eerste keer dat je een oefening doet is nog geen PR.">
            <div className="flex flex-col divide-y divide-gridline">
              {events?.map((event, i) => (
                <div key={`${event.exerciseId}-${event.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link to={`/exercises/${event.exerciseId}`} className="text-sm font-semibold text-accent-text hover:underline">
                      {event.exerciseName}
                    </Link>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {event.detail} · {formatDate(event.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={KIND_TONE[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
                    <span className="text-sm font-semibold">{valueLabel(event)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
