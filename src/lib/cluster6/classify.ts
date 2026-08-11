import type { ClusterRequirement } from './requirements'

/**
 * Deliberately not a percentage-toward-Defensie-fitness — section 22
 * explicitly rules out a misleading "87% fit" number. This is a discrete
 * requirement-status classification instead.
 */
export type RequirementStatus =
  | 'not_measured'
  | 'below_target'
  | 'approaching'
  | 'target_achieved'
  | 'buffer_achieved'
  | 'strong_buffer_achieved'

export interface ClusterBufferConfig {
  /** Fractional margin above target counted as a comfortable buffer, e.g. 0.05 = 5%. Configurable per section 23. */
  bufferMargin: number
  /** Fractional margin counted as a strong buffer, e.g. 0.15 = 15%. */
  strongBufferMargin: number
  /** How close to target counts as "approaching" rather than "below target", e.g. 0.9 = within 90% of the way there. */
  approachingThreshold: number
}

export const DEFAULT_BUFFER_CONFIG: ClusterBufferConfig = {
  bufferMargin: 0.05,
  strongBufferMargin: 0.15,
  approachingThreshold: 0.85,
}

export function classifyClusterResult(
  requirement: ClusterRequirement,
  value: number | null,
  config: ClusterBufferConfig = DEFAULT_BUFFER_CONFIG,
): RequirementStatus {
  if (value == null) return 'not_measured'

  const { targetValue, direction } = requirement
  const sign = direction === 'higher_better' ? 1 : -1
  // Normalize so "better" is always a bigger normalized number regardless of direction.
  const normalizedValue = value * sign
  const normalizedTarget = targetValue * sign

  const bufferTarget = normalizedTarget * (1 + config.bufferMargin)
  const strongBufferTarget = normalizedTarget * (1 + config.strongBufferMargin)
  const approachingTarget = normalizedTarget * config.approachingThreshold

  if (normalizedValue >= strongBufferTarget) return 'strong_buffer_achieved'
  if (normalizedValue >= bufferTarget) return 'buffer_achieved'
  if (normalizedValue >= normalizedTarget) return 'target_achieved'
  if (normalizedValue >= approachingTarget) return 'approaching'
  return 'below_target'
}
