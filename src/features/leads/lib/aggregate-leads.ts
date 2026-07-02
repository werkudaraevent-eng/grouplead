/**
 * Generic lead aggregation engine for custom dashboard widgets.
 * Takes a list of leads and a config, returns grouped/aggregated results.
 */

export interface AggregateConfig {
  metricField: '_count' | '_won_count' | '_lost_count' | '_active_count' | 'actual_value' | 'estimated_value' | '_pipeline_value' | '_lost_revenue' | '_win_rate' | '_avg_deal_size' | '_sales_cycle_days' | '_conversion_rate' | 'pax_count' | string
  aggregation: 'count' | 'sum' | 'avg'
  groupBy: string | null
  limit?: number
}

export interface AggregateGroup {
  key: string
  label: string
  value: number
}

export interface AggregateResult {
  total: number
  groups: AggregateGroup[]
  /** Independently-computed value for an optional KPI footer metric.
   *  Set by the dashboard when a widget has config.footer configured. */
  footerValue?: number
}

import { resolveLeadField } from '@/lib/resolve-lead-field'
import type { Lead } from '@/types'

// Resolve a field value from a lead, handling joined relations + 2nd level fallback
export function resolveField(lead: Record<string, any>, field: string): string | null {
  // FK fields: resolve to joined relation name
  if (field === 'pic_sales_id' && lead.pic_sales_profile?.full_name) {
    return lead.pic_sales_profile.full_name
  }
  if (field === 'account_manager_id' && lead.account_manager_profile?.full_name) {
    return lead.account_manager_profile.full_name
  }
  if (field === 'client_company_id' && lead.client_company?.name) {
    return lead.client_company.name
  }
  if (field === 'company_id' && lead.company?.name) {
    return lead.company.name
  }
  if (field === 'pipeline_stage_id' && lead.pipeline_stage?.name) {
    return lead.pipeline_stage.name
  }

  // For all other fields: use shared resolver with 2nd level fallback
  return resolveLeadField(lead as Lead, field)
}

// Helper: check if a lead is closed won
function isWon(lead: Record<string, any>): boolean {
  const stage = lead.pipeline_stage;
  if (stage?.closed_status === 'won') return true;
  const name = (stage?.name || '').toLowerCase();
  return name.includes('won') || name === 'closed won';
}

// Helper: check if a lead is closed lost
function isLost(lead: Record<string, any>): boolean {
  const stage = lead.pipeline_stage;
  if (stage?.closed_status === 'lost') return true;
  const name = (stage?.name || '').toLowerCase();
  return name.includes('lost') || name.includes('turndown') || name.includes('postpone');
}

// Helper: check if a lead is still active (not closed)
function isActive(lead: Record<string, any>): boolean {
  return !isWon(lead) && !isLost(lead);
}

// Helper: calculate days between two dates
function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

function getMetricValue(lead: Record<string, any>, metricField: string): number {
  if (metricField === '_count') return 1;
  if (metricField === '_won_count') return isWon(lead) ? 1 : 0;
  if (metricField === '_lost_count') return isLost(lead) ? 1 : 0;
  if (metricField === '_active_count') return isActive(lead) ? 1 : 0;
  if (metricField === '_pipeline_value') return isActive(lead) ? (lead.estimated_value || 0) : 0;
  if (metricField === '_lost_revenue') return isLost(lead) ? (lead.estimated_value || lead.actual_value || 0) : 0;
  // "Won Revenue (Actual)": only closed-won leads count, and fall back to
  // estimated_value when actual_value is unset. Mirrors the main dashboard
  // Won Revenue KPI (analytics-dashboard.tsx) so the two never disagree —
  // many won leads carry their value in estimated_value, not actual_value.
  if (metricField === 'actual_value') return isWon(lead) ? (lead.actual_value ?? lead.estimated_value ?? 0) : 0;
  const val = lead[metricField];
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val) || 0;
}

// Compute rate/calculated metrics that need the full set of leads
function computeRateMetric(leads: Record<string, any>[], metricField: string): number {
  if (metricField === '_win_rate') {
    const closed = leads.filter(l => isWon(l) || isLost(l));
    if (closed.length === 0) return 0;
    const won = closed.filter(l => isWon(l)).length;
    return (won / closed.length) * 100;
  }
  if (metricField === '_avg_deal_size') {
    const wonLeads = leads.filter(l => isWon(l));
    if (wonLeads.length === 0) return 0;
    const totalRev = wonLeads.reduce((s, l) => s + (l.actual_value || l.estimated_value || 0), 0);
    return totalRev / wonLeads.length;
  }
  if (metricField === '_sales_cycle_days') {
    const wonLeads = leads.filter(l => isWon(l));
    const cycles: number[] = [];
    for (const lead of wonLeads) {
      const created = lead.created_at || lead.inquiry_date;
      const closed = lead.closed_won_date || lead.updated_at;
      const days = daysBetween(created, closed);
      if (days !== null && days > 0) cycles.push(days);
    }
    if (cycles.length === 0) return 0;
    return cycles.reduce((s, d) => s + d, 0) / cycles.length;
  }
  if (metricField === '_conversion_rate') {
    if (leads.length === 0) return 0;
    const won = leads.filter(l => isWon(l)).length;
    return (won / leads.length) * 100;
  }
  return 0;
}

export function aggregateLeads(
  leads: Record<string, any>[],
  config: AggregateConfig
): AggregateResult {
  const { metricField, aggregation, groupBy, limit = 10 } = config

  // Handle special computed metrics that need full-set calculation
  const isComputedRate = ['_win_rate', '_avg_deal_size', '_sales_cycle_days', '_conversion_rate'].includes(metricField);

  // No group-by: return single total
  if (!groupBy) {
    if (isComputedRate) {
      const result = computeRateMetric(leads, metricField);
      return { total: result, groups: [] };
    }
    let total = 0
    let count = 0
    for (const lead of leads) {
      const val = getMetricValue(lead, metricField)
      total += val
      count++
    }
    if (aggregation === 'avg' && count > 0) {
      total = total / count
    }
    if (aggregation === 'count' || metricField === '_count') {
      total = count
    }
    return { total, groups: [] }
  }

  // Group-by: bucket leads by dimension
  const bucketLeads = new Map<string, { label: string; leads: Record<string, any>[] }>()

  for (const lead of leads) {
    const rawKey = resolveField(lead, groupBy)
    const key = rawKey || '(empty)'
    const label = rawKey || '(empty)'

    if (!bucketLeads.has(key)) {
      bucketLeads.set(key, { label, leads: [] })
    }
    bucketLeads.get(key)!.leads.push(lead)
  }

  // Compute final value per group
  const groups: AggregateGroup[] = []
  let grandTotal = 0

  for (const [key, bucket] of bucketLeads) {
    let value: number
    if (isComputedRate) {
      value = computeRateMetric(bucket.leads, metricField);
    } else {
      let sum = 0;
      for (const lead of bucket.leads) {
        sum += getMetricValue(lead, metricField);
      }
      if (aggregation === 'count' || metricField === '_count') {
        value = bucket.leads.length;
      } else if (aggregation === 'avg') {
        value = bucket.leads.length > 0 ? sum / bucket.leads.length : 0;
      } else {
        value = sum;
      }
    }
    grandTotal += value
    groups.push({ key, label: bucket.label, value })
  }

  // Sort descending by value, apply limit
  groups.sort((a, b) => b.value - a.value)
  const limited = groups.slice(0, limit)

  return { total: grandTotal, groups: limited }
}
