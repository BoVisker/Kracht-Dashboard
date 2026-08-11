import type { DataQuality } from '../../lib/types/canonical'

const LABEL: Record<DataQuality, string> = {
  verified: 'Verified',
  imported: 'Imported',
  estimated: 'Estimated',
  missing: 'Missing',
  conflicting: 'Conflicting',
}

/**
 * The brief is explicit (section 53): never let a number look more certain
 * than it is. Any estimated/uncertain value in the UI should sit next to
 * one of these, not stand alone.
 */
export function DataQualityTag({ quality }: { quality: DataQuality }) {
  return <span className="text-[11px] font-medium tracking-wide text-text-muted uppercase">{LABEL[quality]}</span>
}

export function InsufficientData({ label = 'Insufficient data' }: { label?: string }) {
  return <span className="text-sm text-text-muted italic">{label}</span>
}
