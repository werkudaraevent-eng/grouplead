// Feature: goal-system-redesign
// Property 2: Goal validation rejects invalid configs
// Property 5: User target validation
// Property 6: Stage weight validation range
// Property 7: Protected critical fields invariant

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateBreakdownConfig,
  validateMonthlyCutoff,
  validateUserTarget,
  validateStageWeights,
} from '../goal-validation'
import { validateCriticalFieldUpdate, MANDATORY_MINIMUM_FIELDS } from '../goal-settings-validation'
import type { BreakdownLevelConfig, StageWeightsMap } from '@/types/goals'

const levelArb = fc.record({
  field: fc.string({ minLength: 1 }),
  label: fc.string({ minLength: 1 }),
}) satisfies fc.Arbitrary<BreakdownLevelConfig>

// ── Property 2: Goal validation rejects invalid configs ──

describe('Property 2: validateBreakdownConfig', () => {
  it('rejects arrays with length > 10', () => {
    fc.assert(
      fc.property(fc.array(levelArb, { minLength: 11, maxLength: 30 }), (config) => {
        expect(validateBreakdownConfig(config).valid).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('accepts arrays with length <= 10', () => {
    fc.assert(
      fc.property(fc.array(levelArb, { minLength: 0, maxLength: 10 }), (config) => {
        expect(validateBreakdownConfig(config).valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('rejects monthly_cutoff_day outside [1, 28]', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 0 }),
          fc.integer({ min: 29 })
        ),
        (day) => {
          expect(validateMonthlyCutoff(day).valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('accepts monthly_cutoff_day within [1, 28]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 28 }), (day) => {
        expect(validateMonthlyCutoff(day).valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 5: User target validation ──

describe('Property 5: validateUserTarget', () => {
  it('accepts when period_start < period_end and target_amount >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }).chain((year) =>
          fc.record({
            start: fc.constant(`${year}-01-01`),
            end: fc.constant(`${year}-12-31`),
            amount: fc.double({ min: 0, max: 1e12, noNaN: true }),
          })
        ),
        ({ start, end, amount }) => {
          expect(validateUserTarget(start, end, amount).valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects when period_start >= period_end', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }).chain((year) =>
          fc.record({
            start: fc.constant(`${year}-12-31`),
            end: fc.constant(`${year}-01-01`),
            amount: fc.double({ min: 0, max: 1e12, noNaN: true }),
          })
        ),
        ({ start, end, amount }) => {
          expect(validateUserTarget(start, end, amount).valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects when target_amount < 0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: -0.001, noNaN: true }),
        (amount) => {
          expect(validateUserTarget('2025-01-01', '2025-12-31', amount).valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 6: Stage weight validation range ──

describe('Property 6: validateStageWeights', () => {
  it('accepts StageWeightsMap where all weights are integers in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.uuid(),
          fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 100 }))
        ),
        (weights) => {
          expect(validateStageWeights(weights as StageWeightsMap).valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects StageWeightsMap with any weight outside [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.uuid().chain((pipelineId) =>
          fc.uuid().chain((stageId) =>
            fc.oneof(
              fc.integer({ max: -1 }),
              fc.integer({ min: 101 })
            ).map((badWeight) => ({
              [pipelineId]: { [stageId]: badWeight },
            }))
          )
        ),
        (weights) => {
          expect(validateStageWeights(weights as StageWeightsMap).valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects non-integer weights', () => {
    fc.assert(
      fc.property(
        fc.uuid().chain((pipelineId) =>
          fc.uuid().chain((stageId) =>
            fc.double({ min: 0.1, max: 99.9, noNaN: true })
              .filter((n) => !Number.isInteger(n))
              .map((badWeight) => ({
                [pipelineId]: { [stageId]: badWeight },
              }))
          )
        ),
        (weights) => {
          expect(validateStageWeights(weights as StageWeightsMap).valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 7: Protected critical fields invariant ──

describe('Property 7: validateCriticalFieldUpdate', () => {
  const mandatoryFields = [...MANDATORY_MINIMUM_FIELDS]

  it('accepts arrays that contain all mandatory fields', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 10 }),
        (extra) => {
          const fields = [...mandatoryFields, ...extra]
          expect(validateCriticalFieldUpdate(fields, fields).valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects arrays missing any mandatory field', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: mandatoryFields.length - 1 }),
        (removeIndex) => {
          const fields = mandatoryFields.filter((_, i) => i !== removeIndex)
          expect(validateCriticalFieldUpdate(mandatoryFields, fields).valid).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})
