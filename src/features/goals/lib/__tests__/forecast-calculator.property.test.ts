// Feature: goal-system-redesign, Property 10: Forecast excludes Closed Won and Lost leads

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateForecastV2 } from '../forecast-calculator'
import type { LeadForecastInput, StageWeightsMap } from '@/types/goals'

// ── Arbitraries ──

const stageIdArb = fc.uuid()
const weightArb = fc.integer({ min: 0, max: 100 })

const stageWeightsMapArb: fc.Arbitrary<StageWeightsMap> = fc.dictionary(
  fc.uuid(),
  fc.dictionary(stageIdArb, weightArb, { minKeys: 1, maxKeys: 5 }),
  { minKeys: 0, maxKeys: 3 }
)

const openLeadArb = (stageId: string): fc.Arbitrary<LeadForecastInput> =>
  fc.record({
    id: fc.nat(),
    estimated_value: fc.oneof(
      fc.constant(null),
      fc.float({ min: 0, max: 1_000_000_000, noNaN: true })
    ),
    actual_value: fc.oneof(
      fc.constant(null),
      fc.float({ min: 0, max: 1_000_000_000, noNaN: true })
    ),
    stage_id: fc.constant(stageId),
    is_closed_won: fc.constant(false),
    is_lost: fc.constant(false),
  })

const closedWonLeadArb: fc.Arbitrary<LeadForecastInput> = fc.record({
  id: fc.nat(),
  estimated_value: fc.float({ min: 1, max: 1_000_000, noNaN: true }),
  actual_value: fc.float({ min: 1, max: 1_000_000, noNaN: true }),
  stage_id: fc.uuid(),
  is_closed_won: fc.constant(true),
  is_lost: fc.constant(false),
})

const lostLeadArb: fc.Arbitrary<LeadForecastInput> = fc.record({
  id: fc.nat(),
  estimated_value: fc.float({ min: 1, max: 1_000_000, noNaN: true }),
  actual_value: fc.float({ min: 1, max: 1_000_000, noNaN: true }),
  stage_id: fc.uuid(),
  is_closed_won: fc.constant(false),
  is_lost: fc.constant(true),
})

// ── Property 10: Forecast excludes Closed Won and Lost leads ──

describe('calculateForecastV2 — Property 10', () => {
  it('returns zeros for empty leads array', () => {
    const result = calculateForecastV2([], {}, true)
    expect(result.total_raw).toBe(0)
    expect(result.total_weighted).toBe(0)
    expect(result.lead_count).toBe(0)
  })

  it('Closed Won leads contribute zero to forecast', () => {
    fc.assert(
      fc.property(
        fc.array(closedWonLeadArb, { minLength: 1, maxLength: 10 }),
        stageWeightsMapArb,
        fc.boolean(),
        (leads, stageWeights, weightedEnabled) => {
          const result = calculateForecastV2(leads, stageWeights, weightedEnabled)
          expect(result.total_raw).toBe(0)
          expect(result.total_weighted).toBe(0)
          expect(result.lead_count).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Lost leads contribute zero to forecast', () => {
    fc.assert(
      fc.property(
        fc.array(lostLeadArb, { minLength: 1, maxLength: 10 }),
        stageWeightsMapArb,
        fc.boolean(),
        (leads, stageWeights, weightedEnabled) => {
          const result = calculateForecastV2(leads, stageWeights, weightedEnabled)
          expect(result.total_raw).toBe(0)
          expect(result.total_weighted).toBe(0)
          expect(result.lead_count).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('total_raw equals sum of estimated_value for open leads', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }).chain((stageIds) =>
          fc.array(
            fc.oneof(...stageIds.map((id) => openLeadArb(id))),
            { minLength: 0, maxLength: 15 }
          )
        ),
        stageWeightsMapArb,
        fc.boolean(),
        (leads, stageWeights, weightedEnabled) => {
          const result = calculateForecastV2(leads, stageWeights, weightedEnabled)

          const expectedRaw = leads
            .filter((l) => !l.is_closed_won && !l.is_lost)
            .reduce((sum, l) => sum + (l.estimated_value ?? l.actual_value ?? 0), 0)

          expect(result.total_raw).toBeCloseTo(expectedRaw, 4)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('lead_count equals number of open leads', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            openLeadArb('stage-1'),
            closedWonLeadArb,
            lostLeadArb
          ),
          { minLength: 0, maxLength: 20 }
        ),
        stageWeightsMapArb,
        fc.boolean(),
        (leads, stageWeights, weightedEnabled) => {
          const result = calculateForecastV2(leads, stageWeights, weightedEnabled)
          const expectedCount = leads.filter((l) => !l.is_closed_won && !l.is_lost).length
          expect(result.lead_count).toBe(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('weighted total uses stage weight / 100 multiplier when weightedEnabled=true', () => {
    // Single open lead with known stage weight
    const stageId = 'stage-abc'
    const weight = 60
    const estimatedValue = 1_000_000
    const stageWeights: StageWeightsMap = { 'pipeline-1': { [stageId]: weight } }

    const lead: LeadForecastInput = {
      id: 1,
      estimated_value: estimatedValue,
      actual_value: null,
      stage_id: stageId,
      is_closed_won: false,
      is_lost: false,
    }

    const result = calculateForecastV2([lead], stageWeights, true)
    expect(result.total_raw).toBeCloseTo(estimatedValue, 5)
    expect(result.total_weighted).toBeCloseTo(estimatedValue * (weight / 100), 5)
  })

  it('when weightedEnabled=false, total_weighted equals total_raw', () => {
    fc.assert(
      fc.property(
        fc.array(openLeadArb('stage-1'), { minLength: 0, maxLength: 10 }),
        stageWeightsMapArb,
        (leads, stageWeights) => {
          const result = calculateForecastV2(leads, stageWeights, false)
          expect(result.total_weighted).toBeCloseTo(result.total_raw, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('missing stage weight defaults to 0 weighted value when weightedEnabled=true', () => {
    const lead: LeadForecastInput = {
      id: 1,
      estimated_value: 500_000,
      actual_value: null,
      stage_id: 'unknown-stage',
      is_closed_won: false,
      is_lost: false,
    }

    const result = calculateForecastV2([lead], {}, true)
    expect(result.total_raw).toBeCloseTo(500_000, 5)
    expect(result.total_weighted).toBe(0)
  })
})
