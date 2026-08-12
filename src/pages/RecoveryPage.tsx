import { useRef, useState } from 'react'
import { Card } from '../components/ui/Card'
import { InsufficientData } from '../components/ui/DataQualityTag'
import { TileGrid, Tile } from '../components/ui/Tile'
import { useRecoveryMetrics, useLogRecoveryMetric, useImportRecoveryMetrics, type LogRecoveryMetricInput } from '../hooks/useRecoveryMetrics'
import { parseRecoveryCsv, type ParseRecoveryResult } from '../lib/recovery/parseRecoveryImport'
import { isSupabaseConfigured } from '../lib/supabase'
import type { RecoverySource } from '../lib/types/canonical'

const SOURCE_LABEL: Record<RecoverySource, string> = { manual: 'Handmatig', garmin_csv: 'Garmin CSV', garmin_export: 'Garmin export' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSleepDuration(minutes: number | null): string {
  if (minutes == null) return '–'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}u ${m}m`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM: LogRecoveryMetricInput = {
  date: todayIso(),
  restingHeartRate: null,
  hrvMs: null,
  sleepDurationMinutes: null,
  sleepScore: null,
  bodyBattery: null,
  stressAverage: null,
  notes: null,
}

function NumberField({ label, value, onChange, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-secondary">{label}</span>
      <input
        type="number"
        step="0.1"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder={hint}
        className="min-h-11 w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-text-primary"
      />
    </label>
  )
}

function ManualEntryForm() {
  const logMetric = useLogRecoveryMetric()
  const [form, setForm] = useState<LogRecoveryMetricInput>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await logMetric.mutateAsync(form)
    setSaved(true)
    setForm({ ...EMPTY_FORM, date: form.date })
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-text-secondary">Datum</span>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
          className="min-h-11 rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField label="Rustpols (bpm)" value={form.restingHeartRate} onChange={(v) => setForm((f) => ({ ...f, restingHeartRate: v }))} />
        <NumberField label="HRV (ms)" value={form.hrvMs} onChange={(v) => setForm((f) => ({ ...f, hrvMs: v }))} />
        <NumberField label="Slaap (minuten)" value={form.sleepDurationMinutes} onChange={(v) => setForm((f) => ({ ...f, sleepDurationMinutes: v }))} hint="bijv. 450" />
        <NumberField label="Sleep score (0-100)" value={form.sleepScore} onChange={(v) => setForm((f) => ({ ...f, sleepScore: v }))} />
        <NumberField label="Body Battery (0-100)" value={form.bodyBattery} onChange={(v) => setForm((f) => ({ ...f, bodyBattery: v }))} />
        <NumberField label="Stress (0-100)" value={form.stressAverage} onChange={(v) => setForm((f) => ({ ...f, stressAverage: v }))} />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-text-secondary">Notities</span>
        <input
          type="text"
          value={form.notes ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
          className="min-h-11 w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={logMetric.isPending} className="min-h-11 rounded-md bg-series-1 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
        {saved && <span className="text-xs text-status-good">Opgeslagen.</span>}
        {logMetric.isError && <span className="text-xs text-status-crit">Opslaan mislukt -- probeer opnieuw.</span>}
      </div>
    </form>
  )
}

function CsvImportForm() {
  const importMetrics = useImportRecoveryMetrics()
  const [parsed, setParsed] = useState<ParseRecoveryResult | { error: string } | null>(null)
  const [imported, setImported] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImported(false)
    const reader = new FileReader()
    reader.onload = () => setParsed(parseRecoveryCsv(String(reader.result ?? '')))
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!parsed || 'error' in parsed) return
    await importMetrics.mutateAsync(parsed.rows)
    setImported(true)
    setParsed(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm text-text-secondary" />

      {parsed && 'error' in parsed && <p className="text-sm text-status-crit">{parsed.error}</p>}

      {parsed && !('error' in parsed) && (
        <div className="rounded-md border border-border bg-surface-1 p-3 text-sm">
          <p className="text-text-primary">
            {parsed.rows.length} {parsed.rows.length === 1 ? 'dag' : 'dagen'} gevonden{parsed.skippedRows > 0 && `, ${parsed.skippedRows} rij(en) overgeslagen (geen leesbare datum)`}.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Herkende kolommen:{' '}
            {Object.entries(parsed.matchedColumns)
              .map(([field, header]) => `${field} ← "${header}"`)
              .join(', ') || 'geen'}
          </p>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importMetrics.isPending || parsed.rows.length === 0}
            className="mt-3 min-h-11 rounded-md bg-series-1 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Importeer {parsed.rows.length} {parsed.rows.length === 1 ? 'dag' : 'dagen'}
          </button>
        </div>
      )}

      {imported && <p className="text-xs text-status-good">Geïmporteerd.</p>}
      {importMetrics.isError && <p className="text-xs text-status-crit">Importeren mislukt -- probeer opnieuw.</p>}
    </div>
  )
}

export function RecoveryPage() {
  const { data: metrics, isLoading } = useRecoveryMetrics()
  const showEmptyState = !isSupabaseConfigured()
  const latest = metrics?.[0]

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Herstel</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Geen live Garmin-koppeling (zie README) -- data komt hier via handmatige invoer, of via een CSV die je zelf exporteert vanuit Garmin Connect (Health Stats → bijv. Heart Rate → "Download CSV").
      </p>

      {showEmptyState ? (
        <Card>
          <InsufficientData label="Nog niet gekoppeld aan een database -- zie Sync-pagina." />
        </Card>
      ) : (
        <>
          <TileGrid>
            <Tile label="Rustpols" value={latest?.restingHeartRate != null ? `${latest.restingHeartRate} bpm` : '–'} sub={latest ? formatDate(latest.date) : isLoading ? 'Laden…' : 'Geen data'} />
            <Tile label="HRV" value={latest?.hrvMs != null ? `${latest.hrvMs} ms` : '–'} sub={latest ? formatDate(latest.date) : isLoading ? 'Laden…' : 'Geen data'} />
            <Tile label="Slaap" value={latest ? formatSleepDuration(latest.sleepDurationMinutes) : '–'} sub={latest?.sleepScore != null ? `Score ${latest.sleepScore}` : undefined} />
            <Tile label="Body Battery" value={latest?.bodyBattery != null ? String(latest.bodyBattery) : '–'} sub={latest?.stressAverage != null ? `Stress ${latest.stressAverage}` : undefined} />
          </TileGrid>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Handmatig invoeren" subtitle="Eén rij per dag -- opnieuw invoeren voor dezelfde datum overschrijft de vorige waarde.">
              <ManualEntryForm />
            </Card>
            <Card
              title="Importeer Garmin CSV"
              subtitle='Best-effort: herkent kolommen op naam (bijv. "Resting Heart Rate", "HRV", "Sleep Score"). Klopt de herkenning niet, laat het weten -- dan pas ik de parser aan.'
            >
              <CsvImportForm />
            </Card>
          </div>

          <Card title="Geschiedenis" className="mt-5">
            {!metrics?.length ? (
              <InsufficientData label={isLoading ? 'Laden…' : 'Nog geen herstel-data ingevoerd.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Datum', 'Bron', 'Rustpols', 'HRV', 'Slaap', 'Body Battery', 'Stress'].map((h) => (
                        <th key={h} className="border-b border-gridline py-2 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.id}>
                        <td className="border-b border-gridline py-2">{formatDate(m.date)}</td>
                        <td className="border-b border-gridline py-2">{SOURCE_LABEL[m.source]}</td>
                        <td className="border-b border-gridline py-2">{m.restingHeartRate != null ? `${m.restingHeartRate} bpm` : '–'}</td>
                        <td className="border-b border-gridline py-2">{m.hrvMs != null ? `${m.hrvMs} ms` : '–'}</td>
                        <td className="border-b border-gridline py-2">
                          {formatSleepDuration(m.sleepDurationMinutes)}
                          {m.sleepScore != null && ` (${m.sleepScore})`}
                        </td>
                        <td className="border-b border-gridline py-2">{m.bodyBattery ?? '–'}</td>
                        <td className="border-b border-gridline py-2">{m.stressAverage ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
