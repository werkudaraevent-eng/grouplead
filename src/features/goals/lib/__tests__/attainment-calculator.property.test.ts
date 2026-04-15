// Feature: goal-system-redesign, Property 9: Attainment includes only Closed Won actual_value

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateAttainmentV2 } from '../attainment-calculator'
import type { LeadAttainmentInput } from '@/types/goals'

const leadArb: fc.Arbitrary<LeadAttainmentInput> = fc.record({
  id: fc.nat(),
  actual_value: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 1_000_000_000, noNaN: true })),
  is_closed_won: fc.boolean(),
})

describe('calculateAttainmentV2 — Property 9', () => {
  it('returns zero total and zero count for empty array', () => {
    const result = calculateAttainmentV2([])
    expect(result.total).toBe(0)
    expect(result.lead_count).toBe(0)
  })

  it('total equals sum of actual_value for Closed Won leads only', () => {
    fc.assert(
      fc.property(
        fc.array(leadArb, { minLength: 0, maxLength: 20 }),
        (leads) => {
          const result = calculateAttainmentV2(leads)

          const expectedTotal = leads
            .filter((l) => l.is_closed_won)
            .reduce((sum, l) => sum + (l.actual_value ?? 0), 0)

          expect(result.total).toBeCloseTo(expectedTotal, 5)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('lead_count equals number of Closed Won leads', () => {
    fc.assert(
      fc.property(
        fc.array(leadArb, { minLength: 0, maxLength: 20 }),
        (leads) => {
          const result = calculateAttainmentV2(leads)
          const expectedCount = leads.filter((l) => l.is_closed_won).length
          expect(result.lead_count).toBe(expectedCount)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('non-Closed-Won leads contribute zero regardless of actual_value', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.nat(),
            actual_value: fc.float({ min: 1, max: 1_000_000, noNaN: true }),
            is_closed_won: fc.constant(false),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (leads) => {
          const result = calculateAttainmentV2(leads)
          expect(result.total).toBe(0)
          expect(result.lead_count).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('null actual_value on Closed Won lead counts as 0 but increments lead_count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (n) => {
          const leads: LeadAttainmentInput[] = Array.from({ length: n }, (_, i) => ({
            id: i,
            actual_value: null,
            is_closed_won: true,
          }))
          const result = calculateAttainmentV2(leads)
          expect(result.total).toBe(0)
          expect(result.lead_count).toBe(n)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('total is non-negative for any mix of leads', () => {
    fc.assert(
      fc.property(
        fc.array(leadArb, { minLength: 0, maxLength: 20 }),
        (leads) => {
          const result = calculateAttainmentV2(leads)
          expect(result.total).toBeGreaterThanOrEqual(0)
          expect(result.lead_count).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})
