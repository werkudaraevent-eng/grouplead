"use client"

import { useState, useMemo } from "react"
import { X, BarChart3, PieChart, List, Hash } from "lucide-react"
import { aggregateLeads, resolveField, type AggregateConfig } from "@/features/leads/lib/aggregate-leads"
import { CustomWidgetRenderer } from "./custom-widget-renderer"
import type { CustomWidgetInput } from "@/types/custom-widget"

// ─── Constants ──────────────────────────────────────────────────────────────

const WIDGET_TYPES = [
  { value: 'kpi' as const, label: 'KPI Card', icon: Hash, desc: 'Single number' },
  { value: 'bar' as const, label: 'Bar Chart', icon: BarChart3, desc: 'Horizontal bars' },
  { value: 'pie' as const, label: 'Pie Chart', icon: PieChart, desc: 'Donut chart' },
  { value: 'list' as const, label: 'Ranked List', icon: List, desc: 'Top-N list' },
]

const METRICS = [
  // Core counts
  { value: '_count' as const, label: 'Count of Leads', defaultAgg: 'count' as const },
  { value: '_won_count' as const, label: 'Won Deals Count', defaultAgg: 'count' as const },
  { value: '_lost_count' as const, label: 'Lost Deals Count', defaultAgg: 'count' as const },
  { value: '_active_count' as const, label: 'Active Pipeline Count', defaultAgg: 'count' as const },
  // Revenue metrics
  { value: 'actual_value' as const, label: 'Won Revenue (Actual)', defaultAgg: 'sum' as const },
  { value: 'estimated_value' as const, label: 'Estimated Value', defaultAgg: 'sum' as const },
  { value: '_pipeline_value' as const, label: 'Active Pipeline Value', defaultAgg: 'sum' as const },
  { value: '_lost_revenue' as const, label: 'Lost Revenue', defaultAgg: 'sum' as const },
  // Calculated metrics
  { value: '_win_rate' as const, label: 'Win Rate (%)', defaultAgg: 'avg' as const },
  { value: '_avg_deal_size' as const, label: 'Avg Deal Size (Won)', defaultAgg: 'avg' as const },
  { value: '_sales_cycle_days' as const, label: 'Avg Sales Cycle (Days)', defaultAgg: 'avg' as const },
  { value: '_conversion_rate' as const, label: 'Conversion Rate (%)', defaultAgg: 'avg' as const },
  // Other fields
  { value: 'pax_count' as const, label: 'Pax Count', defaultAgg: 'sum' as const },
]

const AGGREGATIONS = [
  { value: 'count' as const, label: 'Count' },
  { value: 'sum' as const, label: 'Sum' },
  { value: 'avg' as const, label: 'Average' },
]

// Common group-by dimensions (static list; covers most use cases)
const GROUP_BY_OPTIONS = [
  { value: '', label: 'None (single value)' },
  { value: 'lead_source', label: 'Lead Source' },
  { value: 'category', label: 'Category' },
  { value: 'grade_lead', label: 'Grade' },
  { value: 'main_stream', label: 'Main Stream' },
  { value: 'business_purpose', label: 'Business Purpose' },
  { value: 'sector', label: 'Sector' },
  { value: 'segment_tier', label: 'Segment Tier' },
  { value: 'segment', label: 'Segment' },
  { value: 'line_industry', label: 'Line Industry' },
  { value: 'area', label: 'Area' },
  { value: 'nationality', label: 'Nationality' },
  { value: 'event_format', label: 'Event Format' },
  { value: 'pic_sales_id', label: 'Sales Owner' },
  { value: 'client_company_id', label: 'Client Company' },
  { value: 'company_id', label: 'Subsidiary' },
  { value: 'pipeline_stage_id', label: 'Pipeline Stage' },
]

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1.5px solid #e2e8f0', borderRadius: 6,
  fontFamily: 'inherit', color: '#1e293b',
  outline: 'none', background: '#fff',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#475569',
  marginBottom: 4, display: 'block',
}

// ─── Component ──────────────────────────────────────────────────────────────

interface WidgetConfiguratorModalProps {
  leads: Record<string, any>[]
  companyId: string | null
  onSave: (widget: CustomWidgetInput) => void
  onClose: () => void
  editWidget?: CustomWidgetInput & { id?: string } | null
}

export function WidgetConfiguratorModal({
  leads,
  companyId,
  onSave,
  onClose,
  editWidget,
}: WidgetConfiguratorModalProps) {
  const [widgetType, setWidgetType] = useState<'kpi' | 'bar' | 'pie' | 'list'>(
    editWidget?.widget_type || 'bar'
  )
  const [metricField, setMetricField] = useState(editWidget?.metric_field || '_count')
  const [aggregation, setAggregation] = useState(editWidget?.aggregation || 'count')
  const [groupBy, setGroupBy] = useState(editWidget?.group_by || '')
  const [title, setTitle] = useState(editWidget?.title || '')
  const [limit, setLimit] = useState(editWidget?.config?.limit || 10)

  // Interactive filter (optional): a dropdown shown on the finished widget so
  // viewers can narrow the data to one value of `filterField` before it's
  // aggregated. "" = no interactive filter.
  const [filterField, setFilterField] = useState(editWidget?.config?.filter?.field || '')

  // Auto-generate title
  const autoTitle = useMemo(() => {
    const metric = METRICS.find(m => m.value === metricField)?.label || metricField
    const group = GROUP_BY_OPTIONS.find(g => g.value === groupBy)?.label || ''
    if (!groupBy) return `${metric}`
    return `${metric} by ${group}`
  }, [metricField, groupBy])

  const displayTitle = title || autoTitle

  // Filter config object built from the selected filter field (or undefined).
  const filterConfig = useMemo(() => {
    if (!filterField) return undefined
    const label = GROUP_BY_OPTIONS.find(g => g.value === filterField)?.label || filterField
    return { field: filterField, label }
  }, [filterField])

  // Live preview data. When an interactive filter is set we don't pre-filter
  // in the preview (default = "All"), so the builder sees the full dataset.
  const previewData = useMemo(() => {
    const config: AggregateConfig = {
      metricField: metricField as any,
      aggregation: aggregation as any,
      groupBy: groupBy || null,
      limit,
    }
    return aggregateLeads(leads, config)
  }, [leads, metricField, aggregation, groupBy, limit])

  // Preview widget config
  const previewWidget = useMemo(() => ({
    id: editWidget?.id || 'preview',
    title: displayTitle,
    widget_type: widgetType,
    metric_field: metricField as any,
    aggregation: aggregation as any,
    group_by: groupBy || null,
    config: { limit, filter: filterConfig },
  }), [displayTitle, widgetType, metricField, aggregation, groupBy, limit, filterConfig, editWidget])

  // Distinct values for the interactive-filter preview dropdown.
  const previewFilterOptions = useMemo(() => {
    if (!filterField) return []
    const seen = new Set<string>()
    for (const l of leads) {
      const v = resolveField(l as Record<string, any>, filterField)
      if (v) seen.add(v)
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [leads, filterField])

  const handleSave = () => {
    onSave({
      company_id: companyId,
      title: displayTitle,
      widget_type: widgetType,
      metric_field: metricField as any,
      aggregation: aggregation as any,
      group_by: groupBy || null,
      config: { limit, filter: filterConfig },
    })
  }

  // When metric changes, auto-set aggregation
  const handleMetricChange = (val: string) => {
    setMetricField(val as typeof metricField)
    const metric = METRICS.find(m => m.value === val)
    if (metric) setAggregation(metric.defaultAgg)
    if (val === '_count') setGroupBy(groupBy) // keep group-by
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12,
          width: 'min(820px, 92vw)', maxHeight: '85vh',
          boxShadow: '0 20px 60px rgba(0,0,0,.2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e8ed',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            {editWidget ? 'Edit Widget' : 'Create Custom Widget'}
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, background: '#f4f5f7',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            <X style={{ width: 14, height: 14, color: '#64748b' }} />
          </button>
        </div>

        {/* Body: Form + Preview */}
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden',
        }}>
          {/* Form */}
          <div style={{
            width: 320, padding: '16px 20px', overflowY: 'auto',
            borderRight: '1px solid #e5e8ed',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* Chart Type */}
            <div>
              <label style={labelStyle}>Chart Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {WIDGET_TYPES.map(wt => {
                  const Icon = wt.icon
                  const isActive = widgetType === wt.value
                  return (
                    <button
                      key={wt.value}
                      onClick={() => setWidgetType(wt.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 10px',
                        border: isActive ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                        borderRadius: 8, cursor: 'pointer',
                        background: isActive ? '#eef2ff' : '#fff',
                        fontFamily: 'inherit',
                        transition: 'all .15s',
                      }}
                    >
                      <Icon style={{
                        width: 14, height: 14,
                        color: isActive ? '#6366f1' : '#94a3b8',
                      }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#4338ca' : '#374151' }}>
                          {wt.label}
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8' }}>{wt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={autoTitle}
                style={inputStyle}
              />
            </div>

            {/* Metric */}
            <div>
              <label style={labelStyle}>Metric</label>
              <select
                value={metricField}
                onChange={(e) => handleMetricChange(e.target.value)}
                style={inputStyle}
              >
                {METRICS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Aggregation (hidden for _count) */}
            {metricField !== '_count' && (
              <div>
                <label style={labelStyle}>Aggregation</label>
                <select
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value as any)}
                  style={inputStyle}
                >
                  {AGGREGATIONS.filter(a => a.value !== 'count').map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Group By */}
            <div>
              <label style={labelStyle}>Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                style={inputStyle}
              >
                {GROUP_BY_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            {/* Interactive Filter (optional) — adds a dropdown on the finished
                widget so viewers can narrow the data without editing it. */}
            <div>
              <label style={labelStyle}>Interactive Filter</label>
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                style={inputStyle}
              >
                <option value="">None (no viewer filter)</option>
                {GROUP_BY_OPTIONS.filter(g => g.value).map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>
                Adds a dropdown on the widget so viewers can switch which
                {' '}{filterField ? (GROUP_BY_OPTIONS.find(g => g.value === filterField)?.label || 'value') : 'value'}
                {' '}is shown. Resets to All on reload.
              </p>
            </div>

            {/* Limit (only for grouped) */}
            {groupBy && widgetType !== 'kpi' && (
              <div>
                <label style={labelStyle}>Show Top</label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                  min={1}
                  max={50}
                  style={{ ...inputStyle, width: 80 }}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div style={{
            flex: 1, padding: 20, background: '#f8fafc',
            display: 'flex', flexDirection: 'column',
            overflow: 'auto',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Preview
            </div>
            <div style={{
              flex: 1, background: '#fff', borderRadius: 8,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}>
              <CustomWidgetRenderer
                widget={previewWidget}
                data={previewData}
                filterOptions={previewFilterOptions}
                filterValue={null}
                onFilterChange={() => { /* preview only — selection is non-interactive here */ }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid #e5e8ed',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', fontSize: 12, fontWeight: 600,
              border: '1px solid #e2e8f0', borderRadius: 7,
              background: '#fff', color: '#64748b', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '7px 16px', fontSize: 12, fontWeight: 600,
              border: '1px solid #6366f1', borderRadius: 7,
              background: '#6366f1', color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(99,102,241,.25)',
            }}
          >
            {editWidget ? 'Save Changes' : 'Add to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
