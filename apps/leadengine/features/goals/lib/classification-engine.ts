import type { GoalSegment, SegmentMappingEntry, OverlapWarning } from '@/types/goals'

// ── Segment Classification (V2) ──

/**
 * Classifies a lead's raw field value against a GoalSegment's mappings array.
 * Iterates mappings in order and returns the first matching segment_name.
 * Returns fallback_name if no mapping matches or rawValue is null/empty.
 */
export function classifyLeadBySegment(
  rawValue: string | null,
  segment: GoalSegment
): string {
  if (rawValue == null || rawValue === '') {
    return segment.fallback_name
  }

  for (const mapping of segment.mappings) {
    if (mapping.match_values.includes(rawValue)) {
      return mapping.segment_name
    }
  }

  return segment.fallback_name
}

/**
 * Detects values that appear in multiple SegmentMappingEntry objects within
 * the same mappings array. Returns a warning for each overlapping value.
 * Non-overlapping arrays return an empty array.
 */
export function detectSegmentOverlapsV2(
  mappings: SegmentMappingEntry[]
): OverlapWarning[] {
  const valueSegments = new Map<string, string[]>()

  for (const mapping of mappings) {
    if (!Array.isArray(mapping.match_values)) continue
    for (const val of mapping.match_values) {
      const segments = valueSegments.get(val) ?? []
      segments.push(mapping.segment_name)
      valueSegments.set(val, segments)
    }
  }

  const warnings: OverlapWarning[] = []
  for (const [value, segments] of valueSegments) {
    if (segments.length > 1) {
      warnings.push({ value, segments: [...new Set(segments)] })
    }
  }

  return warnings
}
