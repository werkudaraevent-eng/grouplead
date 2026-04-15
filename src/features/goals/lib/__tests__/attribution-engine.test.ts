import { describe, it, expect } from 'vitest'
import { attributeLeadToPeriodV2 } from '../attribution-engine'
import type { LeadAttributionInput, GoalV2 } from '@/types/goals'

function makeLead(overrides: Partial<LeadAttributionInput> = {}): LeadAttributionInput {
  return {
    id: 1,
    event_date_start: '2025-03-15',
    event_date_end: '2025-03-20',
    closed_won_date: '2025-03-22',
    ...overrides,
  }
}

type GoalAttribution = Pick<GoalV2, 'attribution_basis' | 'monthly_cutoff_day' | 'per_month_cutoffs'>

function makeGoal(overrides: Partial<GoalAttribution> = {}): GoalAttribution {
  return {
    attribution_basis: 'event_date',
    monthly_cutoff_day: 25,
    per_month_cutoffs: null,
    ...overrides,
  }
}

describe('event_date basis with cutoff shift', () => {
  it('attributes to current month when day <= cutoff', () => {
    const lead = makeLead({ event_date_end: '2025-03-20' })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(true)
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-04-01', '2025-04-30')).toBe(false)
  })

  it('shifts to next month when day > cutoff', () => {
    const lead = makeLead({ event_date_end: '2025-03-27' })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(false)
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('stays in current month when day equals cutoff exactly', () => {
    const lead = makeLead({ event_date_end: '2025-03-25' })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(true)
  })

  it('falls back to event_date_start when event_date_end is null', () => {
    const lead = makeLead({ event_date_end: null, event_date_start: '2025-03-10' })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(true)
  })
})

describe('closed_won_date basis', () => {
  it('uses closed_won_date for attribution', () => {
    const lead = makeLead({ closed_won_date: '2025-04-10' })
    const goal = makeGoal({ attribution_basis: 'closed_won_date' })
    expect(attributeLeadToPeriodV2(lead, goal, '2025-04-01', '2025-04-30')).toBe(true)
    expect(attributeLeadToPeriodV2(lead, goal, '2025-03-01', '2025-03-31')).toBe(false)
  })

  it('applies cutoff shift on closed_won_date', () => {
    const lead = makeLead({ closed_won_date: '2025-03-28' })
    const goal = makeGoal({ attribution_basis: 'closed_won_date', monthly_cutoff_day: 25 })
    expect(attributeLeadToPeriodV2(lead, goal, '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('ignores event dates when basis is closed_won_date', () => {
    const lead = makeLead({ event_date_end: '2025-03-10', closed_won_date: '2025-04-05' })
    const goal = makeGoal({ attribution_basis: 'closed_won_date' })
    expect(attributeLeadToPeriodV2(lead, goal, '2025-04-01', '2025-04-30')).toBe(true)
    expect(attributeLeadToPeriodV2(lead, goal, '2025-03-01', '2025-03-31')).toBe(false)
  })
})

describe('per-month cutoff overrides', () => {
  it('uses per-month cutoff when available', () => {
    const lead = makeLead({ event_date_end: '2025-03-22' })
    const goal = makeGoal({ monthly_cutoff_day: 25, per_month_cutoffs: { '3': 20 } })
    // Day 22 > cutoff 20 for March → shifts to April
    expect(attributeLeadToPeriodV2(lead, goal, '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('falls back to global cutoff when no per-month override', () => {
    const lead = makeLead({ event_date_end: '2025-03-22' })
    const goal = makeGoal({ monthly_cutoff_day: 25, per_month_cutoffs: { '4': 20 } })
    // Day 22 <= global cutoff 25 → stays in March
    expect(attributeLeadToPeriodV2(lead, goal, '2025-03-01', '2025-03-31')).toBe(true)
  })

  it('clamps per-month cutoff to valid range', () => {
    const lead = makeLead({ event_date_end: '2025-03-29' })
    const goal = makeGoal({ monthly_cutoff_day: 25, per_month_cutoffs: { '3': 35 } })
    // Clamped to 28, day 29 > 28 → shifts to April
    expect(attributeLeadToPeriodV2(lead, goal, '2025-04-01', '2025-04-30')).toBe(true)
  })
})

describe('null date handling', () => {
  it('returns false when both event dates are null (event_date basis)', () => {
    const lead = makeLead({ event_date_start: null, event_date_end: null })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(false)
  })

  it('returns false when closed_won_date is null (closed_won_date basis)', () => {
    const lead = makeLead({ closed_won_date: null })
    const goal = makeGoal({ attribution_basis: 'closed_won_date' })
    expect(attributeLeadToPeriodV2(lead, goal, '2025-03-01', '2025-03-31')).toBe(false)
  })

  it('returns false when no period matches', () => {
    const lead = makeLead({ event_date_end: '2025-06-15' })
    expect(attributeLeadToPeriodV2(lead, makeGoal(), '2025-03-01', '2025-03-31')).toBe(false)
  })
})

describe('boundary cases', () => {
  it('day exactly on cutoff stays in current period', () => {
    const lead = makeLead({ event_date_end: '2025-03-25' })
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 25 }), '2025-03-01', '2025-03-31')).toBe(true)
  })

  it('day one after cutoff shifts to next period', () => {
    const lead = makeLead({ event_date_end: '2025-03-26' })
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 25 }), '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('clamps invalid cutoff below 1 to 1', () => {
    const lead = makeLead({ event_date_end: '2025-03-02' })
    // Clamped to 1, day 2 > 1 → shifts to April
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: -5 }), '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('clamps invalid cutoff above 28 to 28', () => {
    const lead = makeLead({ event_date_end: '2025-03-29' })
    // Clamped to 28, day 29 > 28 → shifts to April
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 31 }), '2025-04-01', '2025-04-30')).toBe(true)
  })

  it('first day of month with cutoff 1 stays in current period', () => {
    const lead = makeLead({ event_date_end: '2025-03-01' })
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 1 }), '2025-03-01', '2025-03-31')).toBe(true)
  })
})

describe('year boundary (December cutoff shifting to January)', () => {
  it('shifts December date past cutoff to January next year', () => {
    const lead = makeLead({ event_date_end: '2025-12-28' })
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 25 }), '2026-01-01', '2026-01-31')).toBe(true)
  })

  it('keeps December date within cutoff in December', () => {
    const lead = makeLead({ event_date_end: '2025-12-20' })
    expect(attributeLeadToPeriodV2(lead, makeGoal({ monthly_cutoff_day: 25 }), '2025-12-01', '2025-12-31')).toBe(true)
  })

  it('handles per-month cutoff override for December', () => {
    const lead = makeLead({ event_date_end: '2025-12-22' })
    const goal = makeGoal({ monthly_cutoff_day: 25, per_month_cutoffs: { '12': 20 } })
    // Day 22 > December cutoff 20 → shifts to January 2026
    expect(attributeLeadToPeriodV2(lead, goal, '2026-01-01', '2026-01-31')).toBe(true)
  })
})
