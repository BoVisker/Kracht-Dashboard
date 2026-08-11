import { Card } from '../components/ui/Card'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { CLUSTER_6_REQUIREMENTS, type ClusterCategory } from '../lib/cluster6/requirements'
import { classifyClusterResult, type RequirementStatus } from '../lib/cluster6/classify'

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

export function Cluster6Page() {
  // No cluster_tests data source is wired up yet (needs Supabase + manual
  // entry form, phase 7 in the roadmap) — every requirement is honestly
  // 'not_measured' rather than showing a fabricated result.
  const measuredValue: number | null = null

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Marine / Cluster 6 Readiness</h2>
        <p className="text-sm text-text-secondary">
          Functiecluster 6 — Korps Mariniers. Bron: {CLUSTER_6_REQUIREMENTS[0].source}, laatst gecontroleerd{' '}
          {CLUSTER_6_REQUIREMENTS[0].sourceVerifiedAt}. Geen "% fit voor Defensie" — alleen requirement-status per onderdeel.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = CLUSTER_6_REQUIREMENTS.filter((r) => r.category === category)
        if (!items.length) return null
        return (
          <section key={category} className="mb-6">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">{CATEGORY_LABEL[category]}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((req) => {
                const status = classifyClusterResult(req, measuredValue)
                return (
                  <Card key={req.id}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold">{req.name}</h4>
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                    </div>
                    <p className="mb-2 text-sm text-text-secondary">{req.detail}</p>
                    <div className="text-xs text-text-muted">
                      Target: {req.targetValue} {req.unit}
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
