export function Tile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card-bg px-4 py-3.5">
      <div className="mb-1.5 text-xs text-text-muted">{label}</div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-secondary">{sub}</div>}
    </div>
  )
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
}
