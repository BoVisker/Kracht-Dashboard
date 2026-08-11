import { useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'

/**
 * Generic per-exercise view (brief section 32) — driven entirely by the
 * :slug param and canonical exercise_history data, never hardcoded to
 * bench press. Works the same for any exercise once Hevy sync populates
 * exercise_history; right now every field is honestly empty.
 */
export function ExercisePage() {
  const { slug } = useParams<{ slug: string }>()
  const label = (slug ?? '').replace(/-/g, ' ')

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold capitalize">{label}</h2>
      <TileGrid>
        <Tile label="All-time max" value="–" sub="nog geen data" />
        <Tile label="Estimated 1RM" value="–" sub="Epley/Brzycki" />
        <Tile label="Laatste sessie" value="–" />
        <Tile label="Frequentie" value="–" sub="per week" />
      </TileGrid>
      <Card title="Progressie">
        <InsufficientData label="Nog geen sets gevonden voor deze oefening." />
      </Card>
    </div>
  )
}
