import { describe, it, expect } from 'vitest'
import { calculateForecastV2 } from '../forecast-calculator'
import type { LeadForecastInput, StageWeightsMap } from '@/types/goals'

function makeLead(overrides: Partial<LeadForecastInput> = {}): LeadForecastInput {
  return {
    id: 1,
    estimated_value: 1000,
    actual_value: null,
    stage_id: 'stage-1',
    is_closed_won: false,
    is_lost: false,
    ...overrides,
  }
}

const emptyWeights: StageWeightsMap = {}
const weights: StageWeightsMap = {
  'pipeline-1': {
    'stage-1': 50,
    'stage-2': 80,
  },
}

describe('calculateForecastV2', () => {
  it('sums estimated_value from open-stage leads (raw)', () => {
    const leads = [
      makeLead({ id: 1, estimated_value: 500 }),
      makeLead({ id: 2, estimated_value: 300 }),
    ]
    const result = calculateForecastV2(leads, emptyWeights, false)
    expect(result.total_raw).toBe(800)
    expect(result.lead_count).toBe(2)
  })

  it('excludes closed won leads', () => {
    const leads = [
      makeLead({ id: 1, estimated_value: 500 }),
      makeLead({ id: 2, estimated_value: 300, is_closed_won: true }),
    ]
    const result = calculateForecastV2(leads, emptyWeights, false)
    expect(result.total_raw).toBe(500)
    expect(result.lead_count).toBe(1)
  })

  it('excludes lost leads', () => {
    const leads = [
      makeLead({ id: 1, estimated_value: 500 }),
      makeLead({ id: 2, estimated_value: 300, is_lost: true }),
    ]
    const result = calculateForecastV2(leads, emptyWeights, false)
    expect(result.total_raw).toBe(500)
    expect(result.lead_count).toBe(1)
  })

  it('falls back to actual_value when estimated_value is null', () => {
    const leads = [makeLead({ id: 1, estimated_value: null, actual_value: 700 })]
    const result = calculateForecastV2(leads, emptyWeights, false)
    expect(result.total_raw).toBe(700)
  })

  it('calculates weighted forecast using StageWeightsMap', () => {
    const leads = [
      makeLead({ id: 1, estimated_value: 1000, stage_id: 'stage-1' }),
      makeLead({ id: 2, estimated_value: 2000, stage_id: 'stage-2' }),
    ]
    const result = calculateForecastV2(leads, weights, true)
    expect(result.total_raw).toBe(3000)
    expect(result.total_weighted).toBe(1000 * 0.5 + 2000 * 0.8) // 500 + 1600 = 2100
  })

  it('uses weight 0 for stages without configured weight', () => {
    const leads = [makeLead({ id: 1, estimated_value: 1000, stage_id: 'unknown-stage' })]
    const result = calculateForecastV2(leads, emptyWeights, true)
    expect(result.total_raw).toBe(1000)
    expect(result.total_weighted).toBe(0)
  })

  it('when weighted disabled, total_weighted equals total_raw', () => {
    const leads = [makeLead({ id: 1, estimated_value: 1000 })]
    const result = calculateForecastV2(leads, emptyWeights, false)
    expect(result.total_weighted).toBe(result.total_raw)
  })

  it('returns zero totals for empty lead list', () => {
    const result = calculateForecastV2([], emptyWeights, false)
    expect(result.total_raw).toBe(0)
    expect(result.total_weighted).toBe(0)
    expect(result.lead_count).toBe(0)
  })
})
