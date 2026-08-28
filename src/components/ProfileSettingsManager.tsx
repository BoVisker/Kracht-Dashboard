import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile, useUpdateProfile } from '../hooks/useProfile'
import { useExportUserData, downloadJson, useDeleteAllUserData } from '../hooks/useDataPrivacy'

const inputClass = 'min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary'
const labelClass = 'mb-1 block text-xs text-text-secondary'

const KG_PER_LB = 0.45359237
const DELETE_CONFIRM_PHRASE = 'VERWIJDER'

function UnitsAndBodyweightForm() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const [units, setUnits] = useState<'metric' | 'imperial'>(profile?.units ?? 'metric')
  const [bodyweightInput, setBodyweightInput] = useState('')
  const [saved, setSaved] = useState(false)

  if (isLoading || !profile) return <p className="text-sm text-text-muted">Laden…</p>

  const displayUnits = units
  const currentDisplayWeight =
    profile.bodyweightKg == null ? '' : displayUnits === 'imperial' ? (profile.bodyweightKg / KG_PER_LB).toFixed(1) : profile.bodyweightKg.toFixed(1)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = bodyweightInput.trim() === '' ? null : parseFloat(bodyweightInput)
    const bodyweightKg = raw == null || Number.isNaN(raw) ? undefined : displayUnits === 'imperial' ? raw * KG_PER_LB : raw
    await updateProfile.mutateAsync({ units, ...(bodyweightKg !== undefined ? { bodyweightKg } : {}) })
    setBodyweightInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Eenheden</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUnits('metric')}
            className={`min-h-11 flex-1 rounded-md border px-3 text-sm font-semibold ${units === 'metric' ? 'border-series-1 bg-series-1/10 text-series-1' : 'border-border text-text-secondary'}`}
          >
            kg / km
          </button>
          <button
            type="button"
            onClick={() => setUnits('imperial')}
            className={`min-h-11 flex-1 rounded-md border px-3 text-sm font-semibold ${units === 'imperial' ? 'border-series-1 bg-series-1/10 text-series-1' : 'border-border text-text-secondary'}`}
          >
            lbs / mi
          </button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Lichaamsgewicht ({displayUnits === 'imperial' ? 'lbs' : 'kg'})</label>
        <input
          type="number"
          step="0.1"
          className={inputClass}
          placeholder={currentDisplayWeight || 'nog niet ingevuld'}
          value={bodyweightInput}
          onChange={(e) => setBodyweightInput(e.target.value)}
        />
        <p className="mt-1 text-xs text-text-muted">Los van het 7-daags gemiddelde uit de Recovery-pagina — dit is het handmatig ingestelde uitgangspunt voor relatieve-krachtberekeningen.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={updateProfile.isPending} className="min-h-11 rounded-md bg-series-1 px-4 text-sm font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
        {saved && <span className="text-xs text-status-good">Opgeslagen.</span>}
      </div>
    </form>
  )
}

function DataExportSection() {
  const exportData = useExportUserData()

  async function handleExport() {
    const data = await exportData.mutateAsync()
    downloadJson(data, `kracht-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`)
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">Data exporteren</h3>
      <p className="mb-2 text-xs text-text-muted">
        Download al je gegevens (trainingen, cardio, doelen, PR's, Cluster 6-resultaten, recovery, trainingsplan) als één JSON-bestand. OAuth-tokens en sync-logs zitten hier niet in — dat zijn geen
        persoonlijke trainingsdata.
      </p>
      <button type="button" onClick={handleExport} disabled={exportData.isPending} className="min-h-11 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50">
        {exportData.isPending ? 'Bezig…' : 'Exporteer mijn data'}
      </button>
      {exportData.isError && <p className="mt-2 text-xs text-status-crit">Export mislukt: {(exportData.error as Error).message}</p>}
    </div>
  )
}

function DataDeleteSection() {
  const deleteAll = useDeleteAllUserData()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function handleDelete() {
    await deleteAll.mutateAsync()
    navigate('/')
  }

  return (
    <div className="rounded-md border border-status-crit/40 p-3">
      <h3 className="mb-1 text-sm font-semibold text-status-crit">Alle data verwijderen</h3>
      <p className="mb-2 text-xs text-text-muted">
        Verwijdert permanent al je trainingen, cardio, doelen, PR's, Cluster 6-resultaten, recovery-data en trainingsplan uit Supabase. Niet te herstellen. Je Hevy/Strava-koppeling zelf koppel je
        los op de Sync-pagina — dat gebeurt hier niet automatisch mee.
      </p>
      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)} className="min-h-11 rounded-md border border-status-crit/60 px-4 text-sm font-semibold text-status-crit">
          Verwijder al mijn data
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Typ "{DELETE_CONFIRM_PHRASE}" om te bevestigen</label>
          <input className={inputClass} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== DELETE_CONFIRM_PHRASE || deleteAll.isPending}
              className="min-h-11 flex-1 rounded-md bg-status-crit px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleteAll.isPending ? 'Bezig…' : 'Definitief verwijderen'}
            </button>
            <button type="button" onClick={() => setExpanded(false)} className="min-h-11 flex-1 rounded-md border border-border px-3 text-sm font-semibold">
              Annuleren
            </button>
          </div>
          {deleteAll.isError && <p className="text-xs text-status-crit">Verwijderen mislukt: {(deleteAll.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}

export function ProfileSettingsManager() {
  return (
    <div className="flex flex-col gap-6">
      <UnitsAndBodyweightForm />
      <DataExportSection />
      <DataDeleteSection />
    </div>
  )
}
