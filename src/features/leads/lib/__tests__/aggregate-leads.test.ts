import { describe, it, expect } from 'vitest'
import { aggregateLeads, type AggregateConfig } from '../aggregate-leads'

const mockLeads = [
  { id: 1, actual_value: 1000, estimated_value: 1500, pax_count: 50, lead_source: 'Phone', category: 'Hot Lead', pic_sales_id: 'u1', pic_sales_profile: { full_name: 'Alice' }, client_company: { name: 'Acme' }, client_company_id: 'c1' },
  { id: 2, actual_value: 2000, estimated_value: 2500, pax_count: 100, lead_source: 'Email', category: 'Hot Lead', pic_sales_id: 'u1', pic_sales_profile: { full_name: 'Alice' }, client_company: { name: 'Beta' }, client_company_id: 'c2' },
  { id: 3, actual_value: 500, estimated_value: 800, pax_count: 30, lead_source: 'Phone', category: 'Cold Lead', pic_sales_id: 'u2', pic_sales_profile: { full_name: 'Bob' }, client_company: { name: 'Acme' }, client_company_id: 'c1' },
  { id: 4, actual_value: null, estimated_value: 1200, pax_count: null, lead_source: null, category: 'Warm Lead', pic_sales_id: 'u2', pic_sales_profile: { full_name: 'Bob' }, client_company: null, client_company_id: null },
]

describe('aggregateLeads', () => {
  describe('no group-by (KPI mode)', () => {
    it('counts all leads', () => {
      const result = aggregateLeads(mockLeads, { metricField: '_count', aggregation: 'count', groupBy: null })
      expect(result.total).toBe(4)
      expect(result.groups).toEqual([])
    })

    it('sums actual_value', () => {
      const result = aggregateLeads(mockLeads, { metricField: 'actual_value', aggregation: 'sum', groupBy: null })
      expect(result.total).toBe(3500) // 1000 + 2000 + 500 + 0
    })

    it('averages estimated_value', () => {
      const result = aggregateLeads(mockLeads, { metricField: 'estimated_value', aggregation: 'avg', groupBy: null })
      expect(result.total).toBe(1500) // (1500+2500+800+1200)/4
    })
  })

  describe('with group-by', () => {
    it('groups by lead_source with count', () => {
      const result = aggregateLeads(mockLeads, { metricField: '_count', aggregation: 'count', groupBy: 'lead_source' })
      expect(result.groups).toHaveLength(3) // Phone, Email, (empty)
      const phone = result.groups.find(g => g.label === 'Phone')
      expect(phone?.value).toBe(2)
      const email = result.groups.find(g => g.label === 'Email')
      expect(email?.value).toBe(1)
    })

    it('groups by category with sum revenue', () => {
      const result = aggregateLeads(mockLeads, { metricField: 'actual_value', aggregation: 'sum', groupBy: 'category' })
      const hot = result.groups.find(g => g.label === 'Hot Lead')
      expect(hot?.value).toBe(3000) // 1000 + 2000
      const cold = result.groups.find(g => g.label === 'Cold Lead')
      expect(cold?.value).toBe(500)
    })

    it('resolves FK fields to joined names', () => {
      const result = aggregateLeads(mockLeads, { metricField: 'actual_value', aggregation: 'sum', groupBy: 'pic_sales_id' })
      const alice = result.groups.find(g => g.label === 'Alice')
      expect(alice?.value).toBe(3000)
      const bob = result.groups.find(g => g.label === 'Bob')
      expect(bob?.value).toBe(500)
    })

    it('sorts descending and applies limit', () => {
      const result = aggregateLeads(mockLeads, { metricField: '_count', aggregation: 'count', groupBy: 'lead_source', limit: 2 })
      expect(result.groups).toHaveLength(2)
      expect(result.groups[0].label).toBe('Phone') // 2 leads
      // Second could be Email or (empty), both have 1
    })

    it('handles null group-by values as (empty)', () => {
      const result = aggregateLeads(mockLeads, { metricField: '_count', aggregation: 'count', groupBy: 'client_company_id' })
      const empty = result.groups.find(g => g.label === '(empty)')
      expect(empty?.value).toBe(1)
    })
  })
})
