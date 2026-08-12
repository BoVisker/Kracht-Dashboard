import { useMemo, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { CLUSTER_6_REQUIREMENTS, type ClusterCategory, type ClusterRequirement } from '../lib/cluster6/requirements'
import { classifyClusterResult, DEFAULT_BUFFER_CONFIG, type RequirementStatus, type ClusterBufferConfig } from '../lib/cluster6/classify'
import { useClusterTestResults, useLogClusterTest } from '../hooks/useClusterTests'
import { useClusterRequirementOverrides, type ClusterRequirementOverride } from '../hooks/useClusterRequirementOverrides'
import { useCardioSessions } from '../hooks/useCardioSessions'
import type { CardioSession } from '../lib/types/canonical'
import { isSupabaseConfigured } from '../lib/supabase'

const STATUS_LABEL: Record<RequirementStatus, string> = {
  not_measured: 'Not measured',
  below_target: 'Below target',
  approaching: 'Approaching',
  target_achieved: 'Target achieved',
  buffer_achieved: 'Buffer achieved',
  strong_buffer_achieved: 'Strong buffer achieved',
}

const STATUS_TONE: Record<RequirementStatus, BadgeTone> = {
  not_measured: 'neutral',
  below_target: 'crit',
  approaching: 'warn',
  target_achieved: 'good',
  buffer_achieved: 'good',
  strong_buffer_achieved: 'good',
}

const CATEGORY_LABEL: Record<ClusterCategory, string> = {
  run: 'Run',
  march: 'Loaded march',
  carry: 'Ammunition carry',
  ball: 'Ball movement',
  functional: 'Functional',
  overhead: 'Overhead work',
}

const CATEGORY_ORDER: ClusterCategory[] = ['run', 'march', 'carry', 'ball', 'overhead', 'functional']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface StravaSuggestion {
  session: CardioSession
  suggestedValue: number
  /** Strava has no idea what you were carrying -- always surfaced as "confirm this yourself", never auto-logged for march tests. */
  needsWeightConfirmation: boolean
}

const RUN_SPORTS = new Set(['Run', 'TrailRun'])
const MARCH_SPORTS = new Set(['Hike', 'Walk', 'Run', 'TrailRun'])
const COOPER_TARGET_SECONDS = 12 * 60
// A 12-minute effort logged by hand rarely stops at exactly 12:00 -- treat anything
// within a minute and a half as "probably the same test", not an exact match.
const COOPER_TOLERANCE_SECONDS = 90

/**
 * Only ever a suggestion, never an auto-fill: picks the most recent synced
 * Strava activity that plausibly matches a requirement, so logging a
 * result is "confirm this" instead of "remember the exact number and
 * type it in". Only covers run-12min and the march category -- Strava
 * has literally nothing (no GPS/duration data) for carry/ball/overhead
 * tests, so those stay manual-only rather than inventing a mapping.
 */
function findStravaSuggestion(req: ClusterRequirement, sessions: CardioSession[]): StravaSuggestion | null {
  if (req.id === 'run-12min') {
    const candidates = sessions.filter(
      (s) =>
        RUN_SPORTS.has(s.sport) &&
        s.movingTimeSeconds != null &&
        s.distanceMeters != null &&
        Math.abs(s.movingTimeSeconds - COOPER_TARGET_SECONDS) <= COOPER_TOLERANCE_SECONDS,
    )
    if (!candidates.length) return null
    const best = [...candidates].sort((a, b) => b.date.localeCompare(a.date))[0]
    return { session: best, suggestedValue: Math.round(best.distanceMeters!), needsWeightConfirmation: false }
  }

  if (req.category === 'march') {
    const targetSeconds = req.targetValue * 60
    const candidates = sessions.filter((s) => MARCH_SPORTS.has(s.sport) && s.movingTimeSeconds != null && s.movingTimeSeconds >= targetSeconds * 0.8)
    if (!candidates.length) return null
    const best = [...candidates].sort((a, b) => b.date.localeCompare(a.date))[0]
    return { session: best, suggestedValue: Math.round((best.movingTimeSeconds! / 60) * 10) / 10, needsWeightConfirmation: true }
  }

  return null
}

function RequirementCard({
  req,
  result,
  suggestion,
  override,
}: {
  req: ClusterRequirement
  result: { value: number; testedAt: string } | undefined
  suggestion: StravaSuggestion | null
  override: ClusterRequirementOverride | undefined
}) {
  const logTest = useLogClusterTest()
  const [showForm, setShowForm] = useState(false)
  const [value, setValue] = useState('')

  const effectiveTarget = override?.targetValue ?? req.targetValue
  const bufferConfig: ClusterBufferConfig = {
    bufferMargin: override?.bufferMargin ?? DEFAULT_BUFFER_CONFIG.bufferMargin,
    strongBufferMargin: override?.strongBufferMargin ?? DEFAULT_BUFFER_CONFIG.strongBufferMargin,
    approachingThreshold: DEFAULT_BUFFER_CONFIG.approachingThreshold,
  }
  const status = classifyClusterResult({ ...req, targetValue: effectiveTarget }, result?.value ?? null, bufferConfig)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(value)
    if (Number.isNaN(parsed)) return
    await logTest.mutateAsync({ requirementId: req.id, value: parsed })
    setValue('')
    setShowForm(false)
  }

  function applySuggestion() {
    if (!suggestion) return
    setValue(String(suggestion.suggestedValue))
    setShowForm(true)
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold">{req.name}</h4>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <p className="mb-2 text-sm text-text-secondary">{req.detail}</p>
      <div className="text-xs text-text-muted">
        Target: {effectiveTarget} {req.unit}
        {override?.targetValue != null && ' (aangepast)'}
        {result && (
          <>
            {' · '}Laatste: {result.value} {req.unit} ({formatDate(result.testedAt)})
          </>
        )}
      </div>

      {suggestion && !showForm && (
        <div className="mt-3 rounded-md border border-series-1/30 bg-series-1-wash px-3 py-2 text-xs">
          <div className="text-text-primary">
            Gevonden in Strava: {suggestion.session.sport} op {formatDate(suggestion.session.date)} — {suggestion.suggestedValue} {req.unit}.
          </div>
          {suggestion.needsWeightConfirmation && <div className="mt-0.5 text-text-muted">Strava kent het draaggewicht niet — bevestig zelf dat dit klopt voordat je opslaat.</div>}
          <button type="button" onClick={applySuggestion} className="mt-2 min-h-11 rounded-md border border-series-1 px-3 py-1 text-xs font-semibold text-accent-text">
            Gebruik dit resultaat
          </button>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="number"
            step="0.1"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={req.unit}
            className="min-h-11 w-24 rounded-md border border-border bg-surface-1 px-2 py-1 text-sm text-text-primary"
            required
          />
          <button type="submit" disabled={logTest.isPending} className="min-h-11 flex-1 rounded-md bg-series-1 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Opslaan
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-md border border-border px-3 py-1 text-xs font-semibold">
            Annuleren
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="mt-3 min-h-11 w-full rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-accent-text">
          + Resultaat loggen
        </button>
      )}
    </Card>
  )
}

export function Cluster6Page() {
  const { data: results, isLoading } = useClusterTestResults()
  const { data: cardioSessions } = useCardioSessions()
  const { data: overrides } = useClusterRequirementOverrides()

  const suggestions = useMemo(() => {
    const map: Record<string, StravaSuggestion | null> = {}
    if (!cardioSessions?.length) return map
    for (const req of CLUSTER_6_REQUIREMENTS) {
      const effectiveTarget = overrides?.[req.id]?.targetValue ?? req.targetValue
      map[req.id] = findStravaSuggestion({ ...req, targetValue: effectiveTarget }, cardioSessions)
    }
    return map
  }, [cardioSessions, overrides])

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Marine / Cluster 6 Readiness</h2>
        <p className="text-sm text-text-secondary">
          Functiecluster 6 — Korps Mariniers. Bron: {CLUSTER_6_REQUIREMENTS[0].source}, laatst gecontroleerd{' '}
          {CLUSTER_6_REQUIREMENTS[0].sourceVerifiedAt}. Geen "% fit voor Defensie" — alleen requirement-status per onderdeel.
        </p>
        {!isSupabaseConfigured() && (
          <p className="mt-2 text-xs text-status-warn">Vereist een gekoppeld Supabase-project om resultaten op te slaan — zie README.md.</p>
        )}
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = CLUSTER_6_REQUIREMENTS.filter((r) => r.category === category)
        if (!items.length) return null
        return (
          <section key={category} className="mb-6">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">{CATEGORY_LABEL[category]}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((req) => (
                <RequirementCard
                  key={req.id}
                  req={req}
                  result={isLoading ? undefined : results?.[req.id]}
                  suggestion={suggestions[req.id] ?? null}
                  override={overrides?.[req.id]}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
