export function ProgressBar({ percent }: { percent: number | null }) {
  if (percent == null) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-gridline">
        <div className="h-full w-full bg-[repeating-linear-gradient(45deg,var(--gridline),var(--gridline)_6px,var(--baseline)_6px,var(--baseline)_12px)] opacity-60" />
      </div>
    )
  }
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gridline" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-series-1 transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  )
}
