import { describe, it, expect } from 'vitest'
import { rollUpFromBreakdownConfig } from '../rollup-engine'
import type { BreakdownLevelConfig, BreakdownTargets, GoalSegment } from '@/types/goals'
import type { LeadRow } from '../breakdown-utils'

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 1,
    actual_value: 500,
    estimated_value: 1000,
    pipeline_stage: { stage_type: 'open', closed_status: 'won' },
    client_company_id: null,
    client_company: null,
    pic_sales_id: null,
    pic_sales_profile: null,
    category: null,
    lead_source: null,
    main_stream: null,
    grade_lead: null,
    stream_type: null,
    business_purpose: null,
    tipe: null,
    nationality: null,
    sector: null,
    area: null,
    referral_source: null,
    event_format: null,
    company_id: 'company-a',
    ...overrides,
  }
}

const noSegments: GoalSegment[] = []
const emptyTargets: BreakdownTargets = {}
const emptyValueMaps = new Map<string, Map<string, string>>()

describe('rollUpFromBreakdownConfig', () => {
  it('returns root node with totals when no breakdown config', () => {
    const leads = [makeLead({ actual_value: 500 }), makeLead({ id: 2, actual_value: 300 })]
    const result = rollUpFromBreakdownConfig(leads, [], noSegments, emptyTargets, emptyValueMaps)
    expect(result.id).toBe('root')
    expect(result.wonRevenue).toBe(800)
    expect(result.children).toHaveLength(0)
  })

  it('builds single-level breakdown by company_id', () => {
    const levels: BreakdownLevelConfig[] = [{ field: 'company_id', label: 'Subsidiary' }]
    const leads = [
      makeLead({ id: 1, actual_value: 500, company_id: 'company-a' }),
      makeLead({ id: 2, actual_value: 300, company_id: 'company-b' }),
    ]
    const valueMaps = new Map([
      ['company_id', new Map([['company-a', 'Company A'], ['company-b', 'Company B']])],
    ])
    const result = rollUpFromBreakdownConfig(leads, levels, noSegments, emptyTargets, valueMaps)
    expect(result.children).not.toBeNull()
    const children = result.children!
    const companyA = children.find((c) => c.id === 'company-a')
    const companyB = children.find((c) => c.id === 'company-b')
    expect(companyA?.wonRevenue).toBe(500)
    expect(companyB?.wonRevenue).toBe(300)
  })

  it('parent wonRevenue equals sum of children', () => {
    const levels: BreakdownLevelConfig[] = [{ field: 'company_id', label: 'Subsidiary' }]
    const leads = [
      makeLead({ id: 1, actual_value: 500, company_id: 'company-a' }),
      makeLead({ id: 2, actual_value: 300, company_id: 'company-b' }),
    ]
    const valueMaps = new Map([
      ['company_id', new Map([['company-a', 'Company A'], ['company-b', 'Company B']])],
    ])
    const result = rollUpFromBreakdownConfig(leads, levels, noSegments, emptyTargets, valueMaps)
    const childSum = result.children!.reduce((sum, c) => sum + c.wonRevenue, 0)
    expect(result.wonRevenue).toBe(childSum)
  })

  it('returns empty root for empty leads', () => {
    const levels: BreakdownLevelConfig[] = [{ field: 'company_id', label: 'Subsidiary' }]
    const result = rollUpFromBreakdownConfig([], levels, noSegments, emptyTargets, emptyValueMaps)
    expect(result.wonRevenue).toBe(0)
    expect(result.pipelineValue).toBe(0)
  })
})
