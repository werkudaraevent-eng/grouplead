// Feature: goal-system-redesign, Property 3: Segment classification first-match with fallback
// Feature: goal-system-redesign, Property 4: Segment overlap detection completeness

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { classifyLeadBySegment, detectSegmentOverlapsV2 } from '../classification-engine'
import type { GoalSegment, SegmentMappingEntry } from '@/types/goals'

// ── Arbitraries ──

const segmentNameArb = fc.string({ minLength: 1, maxLength: 20 })
const matchValueArb = fc.string({ minLength: 1, maxLength: 20 })

const mappingEntryArb: fc.Arbitrary<SegmentMappingEntry> = fc.record({
  segment_name: segmentNameArb,
  match_values: fc.array(matchValueArb, { minLength: 1, maxLength: 5 }),
})

const goalSegmentArb = (mappings: SegmentMappingEntry[]): GoalSegment => ({
  id: 'test-id',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  company_id: 'company-id',
  name: 'Test Segment',
  source_field: 'line_industry',
  fallback_name: 'Other',
  mappings,
})

// ── Property 3: Segment classification first-match with fallback ──

describe('classifyLeadBySegment — Property 3', () => {
  it('returns fallback_name when rawValue is null', () => {
    fc.assert(
      fc.property(
        fc.array(mappingEntryArb, { minLength: 0, maxLength: 5 }),
        (mappings) => {
          const segment = goalSegmentArb(mappings)
          const result = classifyLeadBySegment(null, segment)
          expect(result).toBe(segment.fallback_name)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns fallback_name when rawValue is empty string', () => {
    fc.assert(
      fc.property(
        fc.array(mappingEntryArb, { minLength: 0, maxLength: 5 }),
        (mappings) => {
          const segment = goalSegmentArb(mappings)
          const result = classifyLeadBySegment('', segment)
          expect(result).toBe(segment.fallback_name)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns fallback_name when no mapping matches', () => {
    fc.assert(
      fc.property(
        fc.array(mappingEntryArb, { minLength: 0, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (mappings, rawValue) => {
          // Ensure rawValue is not in any mapping
          const allValues = mappings.flatMap((m) => m.match_values)
          fc.pre(!allValues.includes(rawValue))

          const segment = goalSegmentArb(mappings)
          const result = classifyLeadBySegment(rawValue, segment)
          expect(result).toBe(segment.fallback_name)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns first matching segment_name (first-match semantics)', () => {
    fc.assert(
      fc.property(
        fc.array(mappingEntryArb, { minLength: 1, maxLength: 5 }),
        fc.nat({ max: 4 }),
        (mappings, targetIndex) => {
          const idx = targetIndex % mappings.length
          const targetMapping = mappings[idx]
          fc.pre(targetMapping.match_values.length > 0)

          const rawValue = targetMapping.match_values[0]
          const segment = goalSegmentArb(mappings)

          // Find the first mapping that contains rawValue
          const firstMatchIndex = mappings.findIndex((m) =>
            m.match_values.includes(rawValue)
          )
          fc.pre(firstMatchIndex >= 0)

          const result = classifyLeadBySegment(rawValue, segment)
          expect(result).toBe(mappings[firstMatchIndex].segment_name)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('value in first mapping wins over same value in later mapping', () => {
    fc.assert(
      fc.property(
        segmentNameArb,
        segmentNameArb,
        matchValueArb,
        (seg1, seg2, value) => {
          fc.pre(seg1 !== seg2)
          const mappings: SegmentMappingEntry[] = [
            { segment_name: seg1, match_values: [value] },
            { segment_name: seg2, match_values: [value] },
          ]
          const segment = goalSegmentArb(mappings)
          const result = classifyLeadBySegment(value, segment)
          expect(result).toBe(seg1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 4: Segment overlap detection completeness ──

describe('detectSegmentOverlapsV2 — Property 4', () => {
  it('returns empty array for empty mappings', () => {
    expect(detectSegmentOverlapsV2([])).toEqual([])
  })

  it('returns empty array when no values overlap', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            segment_name: segmentNameArb,
            match_values: fc.array(matchValueArb, { minLength: 1, maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (mappings) => {
          // Build non-overlapping mappings by ensuring unique values per entry
          const seen = new Set<string>()
          const nonOverlapping: SegmentMappingEntry[] = []
          for (const m of mappings) {
            const uniqueValues = m.match_values.filter((v) => !seen.has(v))
            uniqueValues.forEach((v) => seen.add(v))
            if (uniqueValues.length > 0) {
              nonOverlapping.push({ ...m, match_values: uniqueValues })
            }
          }

          const warnings = detectSegmentOverlapsV2(nonOverlapping)
          expect(warnings).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns a warning for every value appearing in multiple mappings', () => {
    fc.assert(
      fc.property(
        segmentNameArb,
        segmentNameArb,
        fc.array(matchValueArb, { minLength: 1, maxLength: 5 }),
        (seg1, seg2, sharedValues) => {
          fc.pre(seg1 !== seg2)
          fc.pre(sharedValues.length > 0)

          const mappings: SegmentMappingEntry[] = [
            { segment_name: seg1, match_values: sharedValues },
            { segment_name: seg2, match_values: sharedValues },
          ]

          const warnings = detectSegmentOverlapsV2(mappings)
          const warnedValues = new Set(warnings.map((w) => w.value))

          // Every shared value must appear in warnings
          for (const v of sharedValues) {
            expect(warnedValues.has(v)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('warning includes all segment names that contain the overlapping value', () => {
    fc.assert(
      fc.property(
        segmentNameArb,
        segmentNameArb,
        matchValueArb,
        (seg1, seg2, value) => {
          fc.pre(seg1 !== seg2)
          const mappings: SegmentMappingEntry[] = [
            { segment_name: seg1, match_values: [value] },
            { segment_name: seg2, match_values: [value] },
          ]

          const warnings = detectSegmentOverlapsV2(mappings)
          const warning = warnings.find((w) => w.value === value)
          expect(warning).toBeDefined()
          expect(warning!.segments).toContain(seg1)
          expect(warning!.segments).toContain(seg2)
        }
      ),
      { numRuns: 100 }
    )
  })
})
