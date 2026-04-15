import { describe, it, expect } from 'vitest'
import { calculateAttainmentV2 } from '../attainment-calculator'
import type { LeadAttainmentInput } from '@/types/goals'

function makeLead(overrides: Partial<LeadAttainmentInput> = {}): LeadAttainmentInput {
  return { id: 1, actual_value: 1000, is_closed_won: true, ...overrides }
}

describe('calculateAttainmentV2', () => {
  it('sums actual_value from closed won leads', () => {
    const leads = [
      makeLead({ id: 1, actual_value: 500 }),
      makeLead({ id: 2, actual_value: 300 }),
    ]
    const result = calculateAttainmentV2(leads)
    expect(result.total).toBe(800)
    expect(result.lead_count).toBe(2)
  })

  it('excludes non-won leads', () => {
    const leads = [
      makeLead({ id: 1, actual_value: 500, is_closed_won: true }),
      makeLead({ id: 2, actual_value: 300, is_closed_won: false }),
    ]
    const result = calculateAttainmentV2(leads)
    expect(result.total).toBe(500)
    expect(result.lead_count).toBe(1)
  })

  it('treats null actual_value as 0', () => {
    const leads = [makeLead({ id: 1, actual_value: null })]
    const result = calculateAttainmentV2(leads)
    expect(result.total).toBe(0)
    expect(result.lead_count).toBe(1)
  })

  it('returns zero totals for empty lead list', () => {
    const result = calculateAttainmentV2([])
    expect(result.total).toBe(0)
    expect(result.lead_count).toBe(0)
  })

  it('handles all non-won leads', () => {
    const leads = [
      makeLead({ id: 1, actual_value: 500, is_closed_won: false }),
      makeLead({ id: 2, actual_value: 300, is_closed_won: false }),
    ]
    const result = calculateAttainmentV2(leads)
    expect(result.total).toBe(0)
    expect(result.lead_count).toBe(0)
  })
})
