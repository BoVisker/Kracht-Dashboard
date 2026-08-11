import { useId, useMemo, useState } from 'react'

export interface ChartPoint {
  x: number
  y: number
  label: string
  isPR?: boolean
}

interface LineChartProps {
  title: string
  targetSeries?: ChartPoint[]
  actualSeries: ChartPoint[]
  yDomain?: [number, number]
  xAxisLabel?: (x: number) => string
  emptyMessage?: string
}

/**
 * Accessible SVG line chart, carried over from the original dashboard.html
 * prototype: every point is keyboard-reachable (tab + focus shows the
 * tooltip), there's a visible `<details>` data table as the non-visual
 * equivalent of the chart, and PR points get a distinct dot. Deliberately
 * hand-rolled instead of a charting library — this is the whole chart,
 * dependency-free, and the accessibility behavior is exactly specified.
 */
export function LineChart({ title, targetSeries = [], actualSeries, yDomain, xAxisLabel, emptyMessage }: LineChartProps) {
  const titleId = useId()
  const [activePoint, setActivePoint] = useState<{ point: ChartPoint; cx: number; cy: number } | null>(null)

  const { svgWidth, svgHeight, margin, xScale, yScale, gridLines, xTicks } = useMemo(() => {
    const W = 900
    const H = 280
    const M = { top: 16, right: 16, bottom: 28, left: 42 }
    const innerW = W - M.left - M.right
    const innerH = H - M.top - M.bottom

    const allVals = [...targetSeries, ...actualSeries].map((p) => p.y)
    const yMin = yDomain ? yDomain[0] : allVals.length ? Math.floor(Math.min(...allVals) - 3) : 0
    const yMax = yDomain ? yDomain[1] : allVals.length ? Math.ceil(Math.max(...allVals) + 3) : 10

    const allX = [...targetSeries, ...actualSeries].map((p) => p.x)
    const xMin = allX.length ? Math.floor(Math.min(...allX) - 1) : 0
    const xMax = allX.length ? Math.ceil(Math.max(...allX) + 1) : 1
    const xSpan = Math.max(1, xMax - xMin)

    const xScaleFn = (x: number) => M.left + ((x - xMin) / xSpan) * innerW
    const yScaleFn = (y: number) => M.top + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH

    const steps = 5
    const gridLines = Array.from({ length: steps + 1 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * i) / steps
      return { v, y: yScaleFn(v) }
    })

    const tickStep = xSpan > 30 ? 6 : xSpan > 12 ? 4 : Math.max(1, Math.round(xSpan / 6))
    const tickStart = Math.ceil(xMin / tickStep) * tickStep
    const xTicks: number[] = []
    for (let x = tickStart; x <= xMax; x += tickStep) xTicks.push(x)

    return { svgWidth: W, svgHeight: H, margin: M, xScale: xScaleFn, yScale: yScaleFn, gridLines, xTicks }
  }, [targetSeries, actualSeries, yDomain])

  if (!actualSeries.length && !targetSeries.length) {
    return <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">{emptyMessage ?? 'Nog geen data.'}</div>
  }

  const targetPath = targetSeries.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x)},${yScale(p.y)}`).join(' ')
  const actualPath = actualSeries.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x)},${yScale(p.y)}`).join(' ')

  return (
    <div className="relative">
      <svg
        className="block h-auto w-full overflow-visible"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{title}</title>
        {gridLines.map(({ v, y }) => (
          <g key={v}>
            <line className="stroke-gridline" strokeWidth={1} x1={margin.left} x2={svgWidth - margin.right} y1={y} y2={y} />
            <text className="fill-text-muted text-[11px]" x={margin.left - 8} y={y + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} className="fill-text-muted text-[11px]" x={xScale(x)} y={svgHeight - margin.bottom + 16} textAnchor="middle">
            {xAxisLabel ? xAxisLabel(x) : x}
          </text>
        ))}
        <line className="stroke-line-muted" strokeWidth={1} x1={margin.left} x2={svgWidth - margin.right} y1={svgHeight - margin.bottom} y2={svgHeight - margin.bottom} />

        {targetSeries.length > 0 && <path fill="none" stroke="var(--line-muted)" strokeWidth={2} strokeDasharray="5 4" d={targetPath} />}
        {actualSeries.length > 0 && <path fill="none" stroke="var(--series-1)" strokeWidth={2.5} d={actualPath} />}

        {actualSeries.map((p, i) => {
          const cx = xScale(p.x)
          const cy = yScale(p.y)
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={p.isPR ? 5.5 : 4.5}
              fill={p.isPR ? 'var(--status-good)' : 'var(--series-1)'}
              stroke="var(--card-bg)"
              strokeWidth={1.5}
              tabIndex={0}
              role="button"
              aria-label={p.label + (p.isPR ? ' · persoonlijk record' : '')}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--series-1)]"
              onMouseEnter={() => setActivePoint({ point: p, cx, cy })}
              onMouseMove={() => setActivePoint({ point: p, cx, cy })}
              onMouseLeave={() => setActivePoint(null)}
              onFocus={() => setActivePoint({ point: p, cx, cy })}
              onBlur={() => setActivePoint(null)}
            />
          )
        })}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-text-primary px-2.5 py-1.5 text-xs whitespace-nowrap text-card-bg"
          style={{
            left: `${(activePoint.cx / svgWidth) * 100}%`,
            top: `${(activePoint.cy / svgHeight) * 100}%`,
            transform: 'translate(12px, -100%)',
          }}
        >
          {activePoint.point.label}
        </div>
      )}

      {actualSeries.length > 0 && (
        <details className="mt-2.5">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-accent-text">Toon als tabel</summary>
          <table className="mt-1.5 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-gridline py-1.5 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">Punt</th>
                <th className="border-b border-gridline py-1.5 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">Waarde</th>
              </tr>
            </thead>
            <tbody>
              {actualSeries.map((p, i) => (
                <tr key={i} className={p.isPR ? 'font-semibold' : ''}>
                  <td className="border-b border-gridline py-1.5">{xAxisLabel ? xAxisLabel(p.x) : p.x}</td>
                  <td className="border-b border-gridline py-1.5">
                    {p.label}
                    {p.isPR ? ' · PR' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
