"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
} from "recharts"
import { useRef } from "react"
import { createPortal } from "react-dom"
import { SectionCard, SectionTitle, CHART_COLORS, EllipsisTick, StickyAxis } from "./shared"
import { SingleKPIWidget } from "./single-kpi-widget"
import { resolveKpiIcon } from "./kpi-icons"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useCurrency } from "@/contexts/currency-context"
import type { FormulaConfig } from "@/types/custom-widget"

// Types (inline to avoid circular deps)
interface AggregateGroup {
  key: string
  label: string
  value: number
}

interface AggregateResult {
  total: number
  groups: AggregateGroup[]
  /** Independently-computed value for the optional KPI footer metric. */
  footerValue?: number
}

interface CustomWidgetConfig {
  id: string
  title: string
  widget_type: 'kpi' | 'bar' | 'pie' | 'list'
  metric_field: string
  aggregation: 'count' | 'sum' | 'avg'
  group_by: string | null
  config: { limit?: number; color?: string; icon?: string; filter?: { field: string; label: string; defaultValue?: string | null }; footer?: { metric_field: string; aggregation: 'count' | 'sum' | 'avg'; label?: string }; formula?: FormulaConfig; tooltip?: string }
}

interface CustomWidgetRendererProps {
  widget: CustomWidgetConfig
  data: AggregateResult
  /** Distinct values for the interactive filter field (when configured). */
  filterOptions?: string[]
  /** Currently selected filter value (null = All). */
  filterValue?: string | null
  /** Called when the viewer changes the interactive filter. */
  onFilterChange?: (value: string | null) => void
}

// ─── Interactive filter dropdown (widget header) ────────────────────────────
// Shown only when the widget has config.filter set. Lets the viewer narrow the
// data to one value of the filter field before aggregation. Ephemeral: state
// lives in the parent and resets on reload.
function WidgetFilterDropdown({
  label, options, value, onChange,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      title={label}
      style={{
        maxWidth: 180, height: 26, padding: "0 8px", fontSize: 11, fontWeight: 600,
        color: "#334155", background: "#f8fafc", border: "1.5px solid #e2e8f0",
        borderRadius: 6, cursor: "pointer", outline: "none", fontFamily: "inherit",
        textOverflow: "ellipsis",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">All {label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

// Chart widget header: title on the left, optional interactive filter on the
// right. Used by bar/pie/list renderers so the filter dropdown sits inline
// with the title without disturbing the existing layout.
function WidgetHeader({ title, filterNode }: { title: string; filterNode?: React.ReactNode }) {
  if (!filterNode) return <SectionTitle>{title}</SectionTitle>
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <SectionTitle>{title}</SectionTitle>
      {filterNode}
    </div>
  )
}

function isCurrencyField(field: string): boolean {
  return ['actual_value', 'estimated_value', '_pipeline_value', '_lost_revenue', '_avg_deal_size'].includes(field)
}

function isPercentField(field: string): boolean {
  return ['_win_rate', '_win_rate_value', '_conversion_rate'].includes(field)
}

function isDaysField(field: string): boolean {
  return field === '_sales_cycle_days'
}

// Human-friendly caption for a footer metric when the user gives none.
function footerAutoLabel(field: string): string {
  if (field === '_count') return 'leads'
  return field.replace(/^_/, '').replace(/_/g, ' ').trim()
}

// Format a custom-formula result per its chosen output format.
function formatFormulaValue(value: number, format: FormulaConfig['format'], fmt?: (v: number) => string): string {
  switch (format) {
    case 'percent': return `${value.toFixed(1)}%`
    case 'currency': return fmt ? fmt(value) : value.toLocaleString('id-ID')
    case 'multiplier': return `${value.toFixed(2)}\u00d7`
    case 'number':
    default: return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  }
}

function formatValue(value: number, metricField: string, aggregation: string, fmt?: (v: number) => string): string {
  if (isPercentField(metricField)) {
    return `${value.toFixed(1)}%`
  }
  if (isDaysField(metricField)) {
    return `${Math.round(value)} days`
  }
  if (metricField === '_count' || metricField === '_won_count' || metricField === '_lost_count' || metricField === '_active_count' || aggregation === 'count') {
    return value.toLocaleString('id-ID')
  }
  if (isCurrencyField(metricField) && fmt) {
    return fmt(value)
  }
  return value.toLocaleString('id-ID')
}

// ─── Shared placeholder for SSR ─────────────────────────────────────────────
function ChartPlaceholder() {
  return (
    <div style={{
      height: "100%", minHeight: 80,
      borderRadius: 8,
      background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
      border: "1px solid #eef2f7",
    }} />
  )
}

// ─── KPI Renderer ───────────────────────────────────────────────────────────
// Reuses the built-in SingleKPIWidget so custom KPI cards are pixel-identical
// to the default dashboard KPI cards (radius, padding, icon tile, typography,
// footer baseline). The aggregation descriptor becomes the footer supporting
// line; the optional filter dropdown is passed as the header action.
function KPIRenderer({ widget, data, filterNode }: CustomWidgetRendererProps & { filterNode?: React.ReactNode }) {
  const { fmt } = useCurrency()
  const accentColor = widget.config.color || '#02378D'
  const IconComponent = resolveKpiIcon(widget.config.icon)

  const aggLabel =
    widget.aggregation === 'avg' ? 'Average'
      : widget.aggregation === 'sum' ? 'Total'
        : 'Count'
  const metricLabel = widget.metric_field !== '_count'
    ? widget.metric_field.replace(/_/g, ' ').trim()
    : ''

  // Footer: when a secondary metric is configured show its independently
  // computed value (e.g. project count under a win-rate headline); otherwise
  // fall back to the aggregation descriptor line.
  const footer = widget.config.footer
  const supporting = footer?.metric_field
    ? [{
        value: formatValue(data.footerValue ?? 0, footer.metric_field, footer.aggregation, fmt),
        label: footer.label || footerAutoLabel(footer.metric_field),
      }]
    : [{ value: aggLabel, label: metricLabel }]

  // Headline value: a custom formula (metric_field === '_formula') is
  // formatted by its own output format; otherwise use the preset formatter.
  const headlineValue = (widget.metric_field === '_formula' && widget.config.formula)
    ? formatFormulaValue(data.total, widget.config.formula.format, fmt)
    : formatValue(data.total, widget.metric_field, widget.aggregation, fmt)

  return (
    <SingleKPIWidget
      label={widget.title}
      value={headlineValue}
      vsTarget={null}
      vsPrev={null}
      accent={accentColor}
      icon={IconComponent}
      supporting={supporting}
      headerAction={filterNode}
      basisInfo={widget.config.tooltip ? <span>{widget.config.tooltip}</span> : undefined}
    />
  )
}

// ─── Bar Chart Renderer (Recharts) ──────────────────────────────────────────
// Renders tooltip content into document.body via a portal so it escapes the
// widget's scroll containers (overflow-y:auto / overflow-x:hidden on the chart
// scroll div AND SectionCard), which would otherwise clip it — the box looked
// "tenggelam" under the widget edge. Positioned with fixed coords from the
// chart's bounding rect + Recharts' `coordinate` (relative to the chart top,
// so it stays correct even while the bar list is scrolled).
function TooltipShell({
  coordinate, chartRef, children,
}: {
  coordinate?: { x: number; y: number }
  chartRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}) {
  if (typeof document === "undefined" || !coordinate || !chartRef.current) return null
  const rect = chartRef.current.getBoundingClientRect()
  const rawLeft = rect.left + coordinate.x + 14
  const top = rect.top + coordinate.y + 14
  // Keep the box on-screen horizontally — segment labels can be long.
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - 288))
  return createPortal(
    <div style={{ position: "fixed", left, top, zIndex: 9999, pointerEvents: "none", maxWidth: 280 }}>
      {children}
    </div>,
    document.body,
  )
}

function BarTooltip({ active, payload, coordinate, chartRef, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell coordinate={coordinate} chartRef={chartRef}>
      <div style={{
        background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
        fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
          <span>Value: {formatValue(d.value, metricField, aggregation, fmt)}</span>
        </div>
      </div>
    </TooltipShell>
  )
}

// Value label drawn at the end of each horizontal bar. Sits INSIDE the bar
// (white) when there's room, otherwise just OUTSIDE it (dark) — so the longest
// bar (which reaches the chart edge) never gets its label clipped.
function makeBarValueLabel(formatFn: (v: number) => string) {
  return function BarValueLabel(props: any) {
    const { x, y, width, height, value } = props
    if (value == null || value === 0) return null
    const text = formatFn(value)
    const approxTextWidth = text.length * 6 + 8
    const inside = width >= approxTextWidth
    const tx = inside ? x + width - 6 : x + width + 6
    const anchor = inside ? "end" : "start"
    const fill = inside ? "#fff" : "#475569"
    return (
      <text
        x={tx}
        y={y + height / 2}
        dy={3.5}
        textAnchor={anchor}
        fontSize={10}
        fontWeight={600}
        fill={fill}
      >
        {text}
      </text>
    )
  }
}

function BarRenderer({ widget, data, filterNode }: CustomWidgetRendererProps & { filterNode?: React.ReactNode }) {
  const { fmt, fmtAxis } = useCurrency()
  const hasMounted = useHasMounted()
  const chartRef = useRef<HTMLDivElement>(null)

  const chartData = data.groups.map((g, i) => ({
    ...g,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  // Explicit domain keeps top chart and plain-HTML axis below in sync. The
  // previous "axis-only BarChart" trick broke because Recharts ignores
  // `dataMax` when Bar is hidden, collapsing the scale to [0,0].
  const maxValue = chartData.reduce((m, d) => Math.max(m, d.value), 0) || 1
  const xDomain: [number, number] = [0, maxValue]

  return (
    <SectionCard>
      <WidgetHeader title={widget.title} filterNode={filterNode} />
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
        {data.groups.length} groups • Total: {formatValue(data.total, widget.metric_field, widget.aggregation, fmt)}
      </div>
      {data.groups.length === 0 ? (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
          No data
        </div>
      ) : (
        // Sticky-axis pattern: scrollable bars on top, frozen X-axis below.
        // Top chart: real Recharts BarChart with XAxis hidden.
        // Bottom axis: plain HTML/flex, positioned to align with bar area.
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="thin-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            {hasMounted ? (
              <div ref={chartRef} style={{ width: "100%", height: Math.max(chartData.length * 36, 80) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={xDomain} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={<EllipsisTick width={80} fontSize={10.5} />}
                      width={80}
                    />
                    <RechartsTooltip
                      content={<BarTooltip chartRef={chartRef} metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
                      cursor={{ fill: "rgba(0,0,0,.03)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                      <LabelList dataKey="value" content={makeBarValueLabel((v) => formatValue(v, widget.metric_field, widget.aggregation, fmtAxis))} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
          {hasMounted && (
            <StickyAxis
              maxValue={maxValue}
              paddingLeft={80}
              paddingRight={12}
              format={(v) => formatValue(v, widget.metric_field, widget.aggregation, fmtAxis)}
            />
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Pie/Donut Renderer (Recharts) ──────────────────────────────────────────
function PieTooltip({ active, payload, coordinate, chartRef, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell coordinate={coordinate} chartRef={chartRef}>
      <div style={{
        background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
        fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
          <span>Value: {formatValue(d.value, metricField, aggregation, fmt)}</span>
        </div>
        <div style={{ opacity: 0.7 }}>{d.pctLabel}</div>
      </div>
    </TooltipShell>
  )
}

function PieRenderer({ widget, data, filterNode }: CustomWidgetRendererProps & { filterNode?: React.ReactNode }) {
  const { fmt } = useCurrency()
  const hasMounted = useHasMounted()
  const chartRef = useRef<HTMLDivElement>(null)
  const total = data.groups.reduce((s, g) => s + g.value, 0) || 1

  const chartData = data.groups.map((g, i) => ({
    ...g,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    pct: (g.value / total) * 100,
    pctLabel: `${((g.value / total) * 100).toFixed(1)}%`,
  }))

  return (
    <SectionCard>
      <WidgetHeader title={widget.title} filterNode={filterNode} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        {/* Donut */}
        <div ref={chartRef} style={{ width: '45%', flexShrink: 0, position: 'relative' }}>
          {hasMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={<PieTooltip chartRef={chartRef} metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
          {/* Center text overlay */}
          {hasMounted && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              fontSize: 12, fontWeight: 700, color: '#0f172a',
            }}>
              {data.groups.length}
            </div>
          )}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', flex: 1 }}>
          {chartData.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.fill, flexShrink: 0 }} />
              <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={s.label}>
                {s.label}
              </span>
              <span style={{ fontWeight: 600, color: '#1e293b', flexShrink: 0 }}>
                {s.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Ranked List Renderer (Recharts) ────────────────────────────────────────
function ListTooltip({ active, payload, coordinate, chartRef, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell coordinate={coordinate} chartRef={chartRef}>
      <div style={{
        background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
        fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 1 }}>#{d.rank} {d.label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
          <span>Value: {formatValue(d.value, metricField, aggregation, fmt)}</span>
        </div>
      </div>
    </TooltipShell>
  )
}

function ListRankTick({ x, y, payload, data, width = 100, fontSize = 10.5 }: any) {
  const item = data?.find((d: any) => d.tickLabel === payload.value)
  const rankPrefix = item ? `#${item.rank} ` : ""
  const label = item ? item.label : payload.value
  const maxChars = Math.floor((width - 8) / (fontSize * 0.55)) - rankPrefix.length
  const display = label.length > maxChars ? label.slice(0, maxChars - 1) + "\u2026" : label
  const fullText = `${rankPrefix}${label}`
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullText}</title>
      <text x={-4} y={0} dy={4} textAnchor="end" fontSize={fontSize} fill="#64748b" fontWeight={500}>
        {rankPrefix}{display}
      </text>
    </g>
  )
}

function ListRenderer({ widget, data, filterNode }: CustomWidgetRendererProps & { filterNode?: React.ReactNode }) {
  const { fmt, fmtAxis } = useCurrency()
  const hasMounted = useHasMounted()
  const chartRef = useRef<HTMLDivElement>(null)

  const chartData = data.groups.map((g, i) => ({
    ...g,
    rank: i + 1,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    tickLabel: `#${i + 1} ${g.label}`,
  }))

  const maxValue = chartData.reduce((m, d) => Math.max(m, d.value), 0) || 1
  const xDomain: [number, number] = [0, maxValue]

  return (
    <SectionCard>
      <WidgetHeader title={widget.title} filterNode={filterNode} />
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
        Top {data.groups.length} • Total: {formatValue(data.total, widget.metric_field, widget.aggregation, fmt)}
      </div>
      {data.groups.length === 0 ? (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
          No data
        </div>
      ) : (
        // Sticky-axis pattern (see BarRenderer for rationale).
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="thin-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            {hasMounted ? (
              <div ref={chartRef} style={{ width: "100%", height: Math.max(chartData.length * 36, 80) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={xDomain} />
                    <YAxis
                      type="category"
                      dataKey="tickLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={<ListRankTick data={chartData} />}
                      width={100}
                    />
                    <RechartsTooltip
                      content={<ListTooltip chartRef={chartRef} metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
                      cursor={{ fill: "rgba(0,0,0,.03)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                      <LabelList dataKey="value" content={makeBarValueLabel((v) => formatValue(v, widget.metric_field, widget.aggregation, fmtAxis))} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
          {hasMounted && (
            <StickyAxis
              maxValue={maxValue}
              paddingLeft={100}
              paddingRight={12}
              format={(v) => formatValue(v, widget.metric_field, widget.aggregation, fmtAxis)}
            />
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Renderer ──────────────────────────────────────────────────────────
export function CustomWidgetRenderer({ widget, data, filterOptions, filterValue, onFilterChange }: CustomWidgetRendererProps) {
  // Build the interactive filter dropdown once (when configured) and hand it
  // to each sub-renderer to place in its header.
  const filterNode = widget.config?.filter && onFilterChange ? (
    <WidgetFilterDropdown
      label={widget.config.filter.label}
      options={filterOptions ?? []}
      value={filterValue ?? null}
      onChange={onFilterChange}
    />
  ) : null

  switch (widget.widget_type) {
    case 'kpi':
      return <KPIRenderer widget={widget} data={data} filterNode={filterNode} />
    case 'bar':
      return <BarRenderer widget={widget} data={data} filterNode={filterNode} />
    case 'pie':
      return <PieRenderer widget={widget} data={data} filterNode={filterNode} />
    case 'list':
      return <ListRenderer widget={widget} data={data} filterNode={filterNode} />
    default:
      return <SectionCard><div style={{ padding: 20, color: '#94a3b8' }}>Unknown widget type</div></SectionCard>
  }
}
