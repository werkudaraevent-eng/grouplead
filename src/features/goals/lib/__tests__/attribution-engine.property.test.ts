// Feature: goal-system-redesign, Property 8: Attribution engine period placement

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { attributeLeadToPeriodV2, clampCutoff, getEffectiveCutoff } from '../attribution-engine'
import type { LeadAttributionInput, GoalV2 } from '@/types/goals'

// ── Helpers ──

function makeGoal(
  attribution_basis: 'event_date' | 'closed_won_date',
  monthly_cutoff_day: number,
  per_month_cutoffs: Record<string, number> | null = null
): Pick<GoalV2, 'attribution_basis' | 'monthly_cutoff_day' | 'per_month_cutoffs'> {
  return { attribution_basis, monthly_cutoff_day, per_month_cutoffs }
}

function makeLead(
  event_date_end: string | null,
  event_date_start: string | null = null,
  closed_won_date: string | null = null
): LeadAttributionInput {
  return { id: 1, event_date_start, event_date_end, closed_won_date }
}

/** Returns YYYY-MM-DD for a given year, month (1-12), day */
function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Returns the first day of the next month */
function firstOfNextMonth(year: number, month: number): string {
  if (month === 12) return dateStr(year + 1, 1, 1)
  return dateStr(year, month + 1, 1)
}

/** Returns the last day of a month */
function lastOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0) // day 0 of next month = last day of this month
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// ── Property 8: Attribution engine period placement ──

describe('attributeLeadToPeriodV2 — Property 8', () => {
  it('returns false when attributed date is null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        (cutoff) => {
          const goal = makeGoal('event_date', cutoff)
          const lead = makeLead(null, null, null)
          expect(attributeLeadToPeriodV2(lead, goal, '2026-01-01', '2026-01-31')).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('day <= cutoff: lead stays in current month period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),  // cutoff
        fc.integer({ min: 2026, max: 2030 }),  // year
        fc.integer({ min: 1, max: 12 }),  // month
        (cutoff, year, month) => {
          // day <= cutoff means lead stays in current month
          const day = Math.min(cutoff, 28)
          fc.pre(day >= 1)

          const dateString = dateStr(year, month, day)
          const lead = makeLead(dateString)
          const goal = makeGoal('event_date', cutoff)

          // Period covers the entire current month
          const periodStart = dateStr(year, month, 1)
          const periodEnd = lastOfMonth(year, month)

          const result = attributeLeadToPeriodV2(lead, goal, periodStart, periodEnd)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('day > cutoff: lead shifts to next month period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 27 }),  // cutoff (max 27 so day can be cutoff+1)
        fc.integer({ min: 2026, max: 2030 }),  // year
        fc.integer({ min: 1, max: 12 }),  // month
        (cutoff, year, month) => {
          // day > cutoff means lead shifts to next month
          const day = cutoff + 1
          fc.pre(day <= 28) // keep within valid days

          const dateString = dateStr(year, month, day)
          const lead = makeLead(dateString)
          const goal = makeGoal('event_date', cutoff)

          // Period covers the next month
          const nextMonthStart = firstOfNextMonth(year, month)
          const nextYear = month === 12 ? year + 1 : year
          const nextMonth = month === 12 ? 1 : month + 1
          const nextMonthEnd = lastOfMonth(nextYear, nextMonth)

          const result = attributeLeadToPeriodV2(lead, goal, nextMonthStart, nextMonthEnd)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('day > cutoff: lead does NOT fall in current month period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 27 }),
        fc.integer({ min: 2026, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (cutoff, year, month) => {
          const day = cutoff + 1
          fc.pre(day <= 28)

          const dateString = dateStr(year, month, day)
          const lead = makeLead(dateString)
          const goal = makeGoal('event_date', cutoff)

          // Period covers only the current month
          const periodStart = dateStr(year, month, 1)
          const periodEnd = lastOfMonth(year, month)

          const result = attributeLeadToPeriodV2(lead, goal, periodStart, periodEnd)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('uses closed_won_date when attribution_basis is closed_won_date', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 2026, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (cutoff, year, month) => {
          const day = Math.min(cutoff, 28)
          const closedDate = dateStr(year, month, day)
          // event_date is in a different month — should be ignored
          const eventDate = dateStr(year === 2030 ? 2029 : year + 1, month, day)

          const lead: LeadAttributionInput = {
            id: 1,
            event_date_start: eventDate,
            event_date_end: eventDate,
            closed_won_date: closedDate,
          }
          const goal = makeGoal('closed_won_date', cutoff)

          const periodStart = dateStr(year, month, 1)
          const periodEnd = lastOfMonth(year, month)

          const result = attributeLeadToPeriodV2(lead, goal, periodStart, periodEnd)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('per_month_cutoffs override takes precedence over global cutoff', () => {
    // Month 3 (March) has override cutoff of 10, global is 25
    // A lead on March 15 should shift to April (15 > 10) not stay in March (15 <= 25)
    const goal = makeGoal('event_date', 25, { '3': 10 })
    const lead = makeLead('2026-03-15')

    // Should NOT be in March period
    expect(attributeLeadToPeriodV2(lead, goal, '2026-03-01', '2026-03-31')).toBe(false)
    // Should be in April period
    expect(attributeLeadToPeriodV2(lead, goal, '2026-04-01', '2026-04-30')).toBe(true)
  })
})

// ── clampCutoff helper tests ──

describe('clampCutoff', () => {
  it('clamps values below 1 to 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 0 }), (n) => {
        expect(clampCutoff(n)).toBe(1)
      }),
      { numRuns: 50 }
    )
  })

  it('clamps values above 28 to 28', () => {
    fc.assert(
      fc.property(fc.integer({ min: 29, max: 200 }), (n) => {
        expect(clampCutoff(n)).toBe(28)
      }),
      { numRuns: 50 }
    )
  })

  it('passes through values in [1, 28]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 28 }), (n) => {
        expect(clampCutoff(n)).toBe(n)
      }),
      { numRuns: 28 }
    )
  })
})
