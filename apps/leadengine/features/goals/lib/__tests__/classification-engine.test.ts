import { describe, it, expect } from 'vitest'
import { classifyLeadBySegment, detectSegmentOverlapsV2 } from '../classification-engine'
import type { GoalSegment, SegmentMappingEntry } from '@/types/goals'

function makeSegment(overrides: Partial<GoalSegment> = {}): GoalSegment {
  return {
    id: 'seg-1',
    created_at: '',
    updated_at: '',
    company_id: 'c1',
    name: 'Industry Segment',
    source_field: 'line_industry',
    fallback_name: 'Other',
    mappings: [
      { segment_name: 'BFSI', match_values: ['Banking', 'Finance', 'Insurance'] },
      { segment_name: 'Tech', match_values: ['Technology', 'IT'] },
    ],
    ...overrides,
  }
}

describe('classifyLeadBySegment', () => {
  it('returns matching segment for a known value', () => {
    const segment = makeSegment()
    expect(classifyLeadBySegment('Banking', segment)).toBe('BFSI')
    expect(classifyLeadBySegment('Technology', segment)).toBe('Tech')
  })

  it('returns fallback_name for unknown value', () => {
    const segment = makeSegment()
    expect(classifyLeadBySegment('Healthcare', segment)).toBe('Other')
  })

  it('returns fallback_name for null value', () => {
    const segment = makeSegment()
    expect(classifyLeadBySegment(null, segment)).toBe('Other')
  })

  it('returns fallback_name for empty string', () => {
    const segment = makeSegment()
    expect(classifyLeadBySegment('', segment)).toBe('Other')
  })

  it('uses first-match semantics when value appears in multiple mappings', () => {
    const segment = makeSegment({
      mappings: [
        { segment_name: 'First', match_values: ['Banking', 'Finance'] },
        { segment_name: 'Second', match_values: ['Finance', 'Insurance'] },
      ],
    })
    // 'Finance' appears in both — should return 'First'
    expect(classifyLeadBySegment('Finance', segment)).toBe('First')
  })

  it('returns fallback_name when mappings array is empty', () => {
    const segment = makeSegment({ mappings: [] })
    expect(classifyLeadBySegment('Banking', segment)).toBe('Other')
  })
})

describe('detectSegmentOverlapsV2', () => {
  it('returns empty array for non-overlapping mappings', () => {
    const mappings: SegmentMappingEntry[] = [
      { segment_name: 'BFSI', match_values: ['Banking', 'Finance'] },
      { segment_name: 'Tech', match_values: ['Technology', 'IT'] },
    ]
    expect(detectSegmentOverlapsV2(mappings)).toHaveLength(0)
  })

  it('detects overlapping values across segments', () => {
    const mappings: SegmentMappingEntry[] = [
      { segment_name: 'BFSI', match_values: ['Banking', 'Finance'] },
      { segment_name: 'Financial Services', match_values: ['Finance', 'Insurance'] },
    ]
    const warnings = detectSegmentOverlapsV2(mappings)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    const financeWarning = warnings.find((w) => w.value === 'Finance')
    expect(financeWarning).toBeDefined()
    expect(financeWarning!.segments).toContain('BFSI')
    expect(financeWarning!.segments).toContain('Financial Services')
  })

  it('returns empty array for empty mappings', () => {
    expect(detectSegmentOverlapsV2([])).toHaveLength(0)
  })

  it('deduplicates segment names in warnings', () => {
    const mappings: SegmentMappingEntry[] = [
      { segment_name: 'A', match_values: ['x', 'y'] },
      { segment_name: 'A', match_values: ['x'] },
    ]
    const warnings = detectSegmentOverlapsV2(mappings)
    const xWarning = warnings.find((w) => w.value === 'x')
    expect(xWarning).toBeDefined()
    // Deduplicated — 'A' should appear only once
    expect(xWarning!.segments.filter((s) => s === 'A')).toHaveLength(1)
  })
})
