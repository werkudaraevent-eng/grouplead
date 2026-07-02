"use client"

import { useState, useMemo } from "react"
import { X, BarChart3, PieChart, List, Hash } from "lucide-react"
import { aggregateLeads, resolveField, computeFormula, type AggregateConfig } from "@/features/leads/lib/aggregate-leads"
import { CustomWidgetRenderer } from "./custom-widget-renderer"
import type { CustomWidgetInput, FormulaMeasure, FormulaCondition } from "@/types/custom-widget"

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
  { value: '_win_rate' as const, label: 'Win Rate (by count %)', defaultAgg: 'avg' as const },
  { value: '_win_rate_value' as const, label: 'Win Rate (by revenue %)', defaultAgg: 'avg' as const },
  { value: '_avg_deal_size' as const, label: 'Avg Deal Size (Won)', defaultAgg: 'avg' as const },
  { value: '_sales_cycle_days' as const, label: 'Avg Sales Cycle (Days)', defaultAgg: 'avg' as const },
  { value: '_conversion_rate' as const, label: 'Conversion Rate (%)', defaultAgg: 'avg' as const },
  // Other fields
  { value: 'pax_count' as const, label: 'Pax Count', defaultAgg: 'sum' as const },
  // User-built ratio (KPI only) — handled by the formula builder below
  { value: '_formula' as const, label: '⚙ Custom Formula…', defaultAgg: 'sum' as const },
]

// ─── Formula builder option lists ─────────────────────────────────────────
const FORMULA_AGGS = [
  { value: 'count' as const, label: 'Count of leads' },
  { value: 'sum' as const, label: 'Sum of value' },
]

const FORMULA_FIELDS = [
  { value: '_deal_value' as const, label: 'Deal Value (auto)' },
  { value: 'actual_value' as const, label: 'Actual Value' },
  { value: 'estimated_value' as const, label: 'Estimated Value' },
  { value: 'pax_count' as const, label: 'Pax Count' },
]

const FORMULA_CONDITIONS = [
  { value: 'all' as const, label: 'All leads' },
  { value: 'won' as const, label: 'Won only' },
  { value: 'lost' as const, label: 'Lost only' },
  { value: 'active' as const, label: 'Active (open) only' },
  { value: 'closed' as const, label: 'Closed (won + lost)' },
]

const FORMULA_FORMATS = [
  { value: 'percent' as const, label: 'Percentage (%)' },
  { value: 'number' as const, label: 'Number' },
  { value: 'currency' as const, label: 'Currency (IDR)' },
  { value: 'multiplier' as const, label: 'Multiplier (×)' },
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

// ─── Measure editor (formula builder sub-form) ───────────────────────────────
// Edits one FormulaMeasure: aggregation(field) over a lead `condition`, plus an
// optional dimension filter revealed behind a "+ filter" toggle. `leads` powers
// the value dropdown so users pick real values instead of typing.
function MeasureEditor({
  label, measure, onChange, leads,
}: {
  label: string
  measure: FormulaMeasure
  onChange: (m: FormulaMeasure) => void
  leads: Record<string, any>[]
}) {
  const set = (patch: Partial<FormulaMeasure>) => onChange({ ...measure, ...patch })
  const filterOptions = useMemo(() => {
    const field = measure.filter?.field
    if (!field) return [] as string[]
    const seen = new Set<string>()
    for (const l of leads) {
      const v = resolveField(l, field)
      if (v) seen.add(v)
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [leads, measure.filter?.field])

  const miniSelect: React.CSSProperties = { ...inputStyle, padding: '6px 8px', fontSize: 11.5 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ ...labelStyle, marginBottom: 0, color: '#334155' }}>{label}</label>
      <select
        value={measure.aggregation}
        onChange={(e) => set({ aggregation: e.target.value as 'count' | 'sum' })}
        style={miniSelect}
      >
        {FORMULA_AGGS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
      {measure.aggregation === 'sum' && (
        <select
          value={measure.field || '_deal_value'}
          onChange={(e) => set({ field: e.target.value as FormulaMeasure['field'] })}
          style={miniSelect}
        >
          {FORMULA_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      )}
      <select
        value={measure.condition}
        onChange={(e) => set({ condition: e.target.value as FormulaCondition })}
        style={miniSelect}
      >
        {FORMULA_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      {/* Optional dimension filter (hidden by default to avoid clutter). */}
      {!measure.filter ? (
        <button
          type="button"
          onClick={() => set({ filter: { field: 'lead_source', value: '' } })}
          style={{
            alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 600,
            color: '#6366f1', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit',
          }}
        >
          + add filter
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 8, borderLeft: '2px solid #e2e8f0' }}>
          <select
            value={measure.filter.field}
            onChange={(e) => set({ filter: { field: e.target.value, value: '' } })}
            style={miniSelect}
          >
            {GROUP_BY_OPTIONS.filter(g => g.value).map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
          <select
            value={measure.filter.value}
            onChange={(e) => set({ filter: { field: measure.filter!.field, value: e.target.value } })}
            style={miniSelect}
          >
            <option value="">Select value…</option>
            {filterOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            type="button"
            onClick={() => set({ filter: undefined })}
            style={{
              alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 600,
              color: '#ef4444', background: 'none', border: 'none',
              cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit',
            }}
          >
            remove filter
          </button>
        </div>
      )}
    </div>
  )
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

  // Optional secondary footer metric (KPI cards only). Computed independently
  // from the headline metric so a card can pair e.g. a Win Rate % on top with
  // a raw project count below. "" = no footer metric.
  const [footerField, setFooterField] = useState(editWidget?.config?.footer?.metric_field || '')
  const [footerAgg, setFooterAgg] = useState<'count' | 'sum' | 'avg'>(editWidget?.config?.footer?.aggregation || 'count')
  const [footerLabel, setFooterLabel] = useState(editWidget?.config?.footer?.label || '')

  // Custom formula builder state (KPI only, active when metric === '_formula').
  // numerator ÷ denominator, each an aggregation(field) over a condition.
  const DEFAULT_MEASURE: FormulaMeasure = { aggregation: 'count', field: '_deal_value', condition: 'won' }
  const [numMeasure, setNumMeasure] = useState<FormulaMeasure>(
    editWidget?.config?.formula?.numerator ?? DEFAULT_MEASURE
  )
  const [denEnabled, setDenEnabled] = useState<boolean>(
    !!editWidget?.config?.formula?.denominator
  )
  const [denMeasure, setDenMeasure] = useState<FormulaMeasure>(
    editWidget?.config?.formula?.denominator ?? { aggregation: 'count', field: '_deal_value', condition: 'closed' }
  )
  const [formulaFormat, setFormulaFormat] = useState<'percent' | 'number' | 'currency' | 'multiplier'>(
    editWidget?.config?.formula?.format ?? 'percent'
  )

  // Auto-generate title
  const autoTitle = useMemo(() => {
    if (metricField === '_formula') return 'Custom Metric'
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

  // Footer metric config (KPI only). undefined when no footer field chosen.
  const footerConfig = useMemo(() => {
    if (widgetType !== 'kpi' || !footerField) return undefined
    return { metric_field: footerField, aggregation: footerAgg, label: footerLabel || undefined }
  }, [widgetType, footerField, footerAgg, footerLabel])

  // Formula config (KPI only, when metric === '_formula').
  const isFormula = widgetType === 'kpi' && metricField === '_formula'
  const formulaConfig = useMemo(() => {
    if (!isFormula) return undefined
    return {
      numerator: numMeasure,
      denominator: denEnabled ? denMeasure : null,
      format: formulaFormat,
    }
  }, [isFormula, numMeasure, denEnabled, denMeasure, formulaFormat])

  // Live preview data. When an interactive filter is set we don't pre-filter
  // in the preview (default = "All"), so the builder sees the full dataset.
  const previewData = useMemo(() => {
    // Formula metric: compute the ratio directly, bypass the preset engine.
    if (isFormula && formulaConfig) {
      const total = computeFormula(leads, formulaConfig)
      const result: any = { total, groups: [] }
      if (footerConfig?.metric_field) {
        const footerResult = aggregateLeads(leads, {
          metricField: footerConfig.metric_field as any,
          aggregation: footerConfig.aggregation as any,
          groupBy: null,
        })
        result.footerValue = footerResult.total
      }
      return result
    }
    const config: AggregateConfig = {
      metricField: metricField as any,
      aggregation: aggregation as any,
      groupBy: groupBy || null,
      limit,
    }
    const result = aggregateLeads(leads, config)
    if (footerConfig?.metric_field) {
      const footerResult = aggregateLeads(leads, {
        metricField: footerConfig.metric_field as any,
        aggregation: footerConfig.aggregation as any,
        groupBy: null,
      })
      ;(result as any).footerValue = footerResult.total
    }
    return result
  }, [leads, isFormula, formulaConfig, metricField, aggregation, groupBy, limit, footerConfig])

  // Preview widget config
  const previewWidget = useMemo(() => ({
    id: editWidget?.id || 'preview',
    title: displayTitle,
    widget_type: widgetType,
    metric_field: metricField as any,
    aggregation: aggregation as any,
    group_by: groupBy || null,
    config: { limit, filter: filterConfig, footer: footerConfig, formula: formulaConfig },
  }), [displayTitle, widgetType, metricField, aggregation, groupBy, limit, filterConfig, footerConfig, formulaConfig, editWidget])

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
      config: { limit, filter: filterConfig, footer: footerConfig, formula: formulaConfig },
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
                {METRICS.filter(m => m.value !== '_formula' || widgetType === 'kpi').map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Custom Formula builder (KPI only). Replaces Aggregation +
                Group By: the metric is numerator ÷ denominator, each a
                measure = aggregation(field) over a lead condition. */}
            {isFormula && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '12px', borderRadius: 8,
                border: '1.5px dashed #cbd5e1', background: '#f8fafc',
              }}>
                <MeasureEditor label="Numerator (top)" measure={numMeasure} onChange={setNumMeasure} leads={leads} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>÷</span>
                  <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={denEnabled}
                      onChange={(e) => setDenEnabled(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Divide by a denominator
                  </label>
                </div>

                {denEnabled && (
                  <MeasureEditor label="Denominator (bottom)" measure={denMeasure} onChange={setDenMeasure} leads={leads} />
                )}

                <div>
                  <label style={labelStyle}>Output Format</label>
                  <select
                    value={formulaFormat}
                    onChange={(e) => setFormulaFormat(e.target.value as any)}
                    style={inputStyle}
                  >
                    {FORMULA_FORMATS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 9.5, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                  Result = numerator ÷ denominator. If the denominator is 0 the
                  card shows 0. Give the card a Title above to name this metric.
                </p>
              </div>
            )}

            {/* Aggregation (hidden for _count and for formula) */}
            {!isFormula && metricField !== '_count' && (
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

            {/* Group By (hidden for formula — formula is single-value KPI) */}
            {!isFormula && (
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
            )}

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

            {/* Footer Metric (KPI only, optional) — a second number shown under
                the headline value, computed independently. e.g. Win Rate % on
                top, project count below. */}
            {widgetType === 'kpi' && (
              <div>
                <label style={labelStyle}>Footer Metric</label>
                <select
                  value={footerField}
                  onChange={(e) => {
                    const val = e.target.value
                    setFooterField(val)
                    const m = METRICS.find(m => m.value === val)
                    if (m) setFooterAgg(m.defaultAgg)
                  }}
                  style={inputStyle}
                >
                  <option value="">None (single metric)</option>
                  {METRICS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {footerField && (
                  <>
                    {footerField !== '_count' && (
                      <select
                        value={footerAgg}
                        onChange={(e) => setFooterAgg(e.target.value as any)}
                        style={{ ...inputStyle, marginTop: 6 }}
                      >
                        {AGGREGATIONS.filter(a => a.value !== 'count').map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={footerLabel}
                      onChange={(e) => setFooterLabel(e.target.value)}
                      placeholder="Footer label (optional)"
                      style={{ ...inputStyle, marginTop: 6 }}
                    />
                  </>
                )}
                <p style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>
                  Shows a second number in the card footer, computed on its own.
                  Independent from the headline metric above.
                </p>
              </div>
            )}

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
