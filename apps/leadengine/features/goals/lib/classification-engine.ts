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
  // Per value: which mapping entries it came from, and under which names.
  //
  // Entries rather than occurrences, because the two are not the same thing. A
  // value listed twice inside one entry is a typo in that entry, not a clash
  // between segments — counting raw occurrences reported it as an overlap whose
  // segment list named a single segment conflicting with itself.
  //
  // Entries rather than distinct names, because two separate entries that share
  // a name and a value are still a real configuration duplicate worth flagging.
  const valueEntries = new Map<string, { indices: Set<number>; names: string[] }>()

  mappings.forEach((mapping, index) => {
    if (!Array.isArray(mapping.match_values)) return
    for (const val of mapping.match_values) {
      const entry = valueEntries.get(val) ?? { indices: new Set<number>(), names: [] }
      entry.indices.add(index)
      entry.names.push(mapping.segment_name)
      valueEntries.set(val, entry)
    }
  })

  const warnings: OverlapWarning[] = []
  for (const [value, entry] of valueEntries) {
    if (entry.indices.size > 1) {
      warnings.push({ value, segments: [...new Set(entry.names)] })
    }
  }

  return warnings
}
