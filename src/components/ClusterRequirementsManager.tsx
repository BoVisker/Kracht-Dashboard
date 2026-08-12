import { useState } from 'react'
import { CLUSTER_6_REQUIREMENTS } from '../lib/cluster6/requirements'
import { DEFAULT_BUFFER_CONFIG } from '../lib/cluster6/classify'
import { useClusterRequirementOverrides, useSetClusterRequirementOverride, useResetClusterRequirementOverride } from '../hooks/useClusterRequirementOverrides'

const inputClass = 'min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary'
const labelClass = 'mb-1 block text-xs text-text-secondary'

function EditRequirementForm({
  requirementId,
  defaultTarget,
  current,
  onDone,
}: {
  requirementId: string
  defaultTarget: number
  current: { targetValue: number | null; bufferMargin: number | null; strongBufferMargin: number | null } | undefined
  onDone: () => void
}) {
  const setOverride = useSetClusterRequirementOverride()
  const [targetValue, setTargetValue] = useState(String(current?.targetValue ?? defaultTarget))
  const [bufferMargin, setBufferMargin] = useState(String((current?.bufferMargin ?? DEFAULT_BUFFER_CONFIG.bufferMargin) * 100))
  const [strongBufferMargin, setStrongBufferMargin] = useState(String((current?.strongBufferMargin ?? DEFAULT_BUFFER_CONFIG.strongBufferMargin) * 100))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await setOverride.mutateAsync({
      requirementId,
      targetValue: parseFloat(targetValue),
      bufferMargin: parseFloat(bufferMargin) / 100,
      strongBufferMargin: parseFloat(strongBufferMargin) / 100,
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-3 gap-2 border-t border-gridline pt-3">
      <div>
        <label className={labelClass}>Target</label>
        <input type="number" step="0.1" className={inputClass} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Buffer (%)</label>
        <input type="number" step="1" className={inputClass} value={bufferMargin} onChange={(e) => setBufferMargin(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Sterke buffer (%)</label>
        <input type="number" step="1" className={inputClass} value={strongBufferMargin} onChange={(e) => setStrongBufferMargin(e.target.value)} required />
      </div>
      <div className="col-span-3 flex gap-2">
        <button type="submit" disabled={setOverride.isPending} className="min-h-11 flex-1 rounded-md bg-series-1 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-md border border-border px-3 py-2 text-sm font-semibold">
          Annuleren
        </button>
      </div>
    </form>
  )
}

/**
 * Edits src/lib/cluster6/requirements.ts's per-user overrides, stored in
 * cluster_requirement_overrides (already in migration 0001, unused until
 * now). The seed array itself never changes -- only what's layered on top
 * per user, exactly what the "not hardcoded" requirement in that file's
 * own comment asks for.
 */
export function ClusterRequirementsManager() {
  const { data: overrides, isLoading } = useClusterRequirementOverrides()
  const resetOverride = useResetClusterRequirementOverride()
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm text-text-muted">Laden…</p>

  return (
    <div className="flex flex-col gap-3">
      {CLUSTER_6_REQUIREMENTS.map((req) => {
        const override = overrides?.[req.id]
        const hasOverride = !!override
        return (
          <div key={req.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{req.name}</div>
                <div className="text-xs text-text-muted">
                  Target: {override?.targetValue ?? req.targetValue} {req.unit}
                  {hasOverride && ' (aangepast)'}
                  {' · buffer '}
                  {Math.round((override?.bufferMargin ?? DEFAULT_BUFFER_CONFIG.bufferMargin) * 100)}%{' / sterk '}
                  {Math.round((override?.strongBufferMargin ?? DEFAULT_BUFFER_CONFIG.strongBufferMargin) * 100)}%
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setEditingId(editingId === req.id ? null : req.id)} className="min-h-11 rounded-md border border-border px-2.5 font-semibold">
                  Bewerken
                </button>
                {hasOverride && (
                  <button
                    type="button"
                    onClick={() => resetOverride.mutate(req.id)}
                    className="min-h-11 rounded-md border border-border px-2.5 font-semibold text-text-muted hover:text-status-crit"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            {editingId === req.id && (
              <EditRequirementForm requirementId={req.id} defaultTarget={req.targetValue} current={override} onDone={() => setEditingId(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
