export type BadgeTone = 'good' | 'warn' | 'crit' | 'neutral'

const DOT_COLOR: Record<BadgeTone, string> = {
  good: 'bg-status-good',
  warn: 'bg-status-warn',
  crit: 'bg-status-crit',
  neutral: 'bg-series-1',
}

/**
 * Color lives on the dot only, never on the text — text stays high-contrast
 * ink so it clears 4.5:1 in both themes regardless of tone (a colored wash
 * behind colored text often fails contrast; ink text next to a dot never does).
 */
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 py-1 pr-2.5 pl-2 text-xs font-semibold text-text-primary">
      <span className={`size-2 flex-none rounded-full ${DOT_COLOR[tone]}`} />
      {children}
    </span>
  )
}
