import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { CLUSTER_6_REQUIREMENTS, type ClusterCategory, type ClusterRequirement } from '../lib/cluster6/requirements'
import { classifyClusterResult, type RequirementStatus } from '../lib/cluster6/classify'
import { useClusterTestResults, useLogClusterTest } from '../hooks/useClusterTests'
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

function RequirementCard({ req, result }: { req: ClusterRequirement; result: { value: number; testedAt: string } | undefined }) {
  const logTest = useLogClusterTest()
  const [showForm, setShowForm] = useState(false)
  const [value, setValue] = useState('')

  const status = classifyClusterResult(req, result?.value ?? null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(value)
    if (Number.isNaN(parsed)) return
    await logTest.mutateAsync({ requirementId: req.id, value: parsed })
    setValue('')
    setShowForm(false)
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold">{req.name}</h4>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <p className="mb-2 text-sm text-text-secondary">{req.detail}</p>
      <div className="text-xs text-text-muted">
        Target: {req.targetValue} {req.unit}
        {result && (
          <>
            {' · '}Laatste: {result.value} {req.unit} ({formatDate(result.testedAt)})
          </>
        )}
      </div>

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
                <RequirementCard key={req.id} req={req} result={isLoading ? undefined : results?.[req.id]} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
