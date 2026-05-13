"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts"
import { SectionCard, SectionTitle, CHART_COLORS, EllipsisTick } from "./shared"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useCurrency } from "@/contexts/currency-context"

// Types (inline to avoid circular deps)
interface AggregateGroup {
  key: string
  label: string
  value: number
}

interface AggregateResult {
  total: number
  groups: AggregateGroup[]
}

interface CustomWidgetConfig {
  id: string
  title: string
  widget_type: 'kpi' | 'bar' | 'pie' | 'list'
  metric_field: string
  aggregation: 'count' | 'sum' | 'avg'
  group_by: string | null
  config: { limit?: number; color?: string }
}

interface CustomWidgetRendererProps {
  widget: CustomWidgetConfig
  data: AggregateResult
}

function isCurrencyField(field: string): boolean {
  return ['actual_value', 'estimated_value', '_pipeline_value', '_lost_revenue', '_avg_deal_size'].includes(field)
}

function isPercentField(field: string): boolean {
  return ['_win_rate', '_conversion_rate'].includes(field)
}

function isDaysField(field: string): boolean {
  return field === '_sales_cycle_days'
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

// ─── KPI Renderer (matches SingleKPIWidget design) ─────────────────────────
function KPIRenderer({ widget, data }: CustomWidgetRendererProps) {
  const { fmt } = useCurrency()
  const accentColor = widget.config.color || '#02378D'
  return (
    <div
      style={{
        background: "#fff", borderRadius: 10,
        padding: "10px 14px 8px",
        border: `1px solid #e5e8ed`,
        display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
        position: "relative", overflow: "hidden", cursor: "default",
        height: "100%", boxSizing: "border-box",
        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
        transition: "all .25s ease",
      }}
    >
      {/* Accent top bar — same as built-in KPI cards */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}66)`,
        opacity: 0.5, transition: "opacity .2s",
      }} />

      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8", letterSpacing: ".15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {widget.title}
        </span>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: accentColor + "0c",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accentColor, flexShrink: 0, fontSize: 11, fontWeight: 700,
        }}>
          #
        </span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 22, fontWeight: 800, color: "#0f172a",
        letterSpacing: "-0.5px", lineHeight: 1,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {formatValue(data.total, widget.metric_field, widget.aggregation, fmt)}
      </div>

      {/* Subtitle */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2, minHeight: 20 }}>
        <span style={{ fontSize: 9, color: "#cbd5e1", fontStyle: "italic" }}>
          {widget.aggregation === 'avg' ? 'Average' : widget.aggregation === 'sum' ? 'Total' : 'Count'}
          {widget.metric_field !== '_count' && ` • ${widget.metric_field.replace(/_/g, ' ')}`}
        </span>
      </div>
    </div>
  )
}

// ─── Bar Chart Renderer (Recharts) ──────────────────────────────────────────
function BarTooltip({ active, payload, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
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
  )
}

function BarRenderer({ widget, data }: CustomWidgetRendererProps) {
  const { fmt } = useCurrency()
  const hasMounted = useHasMounted()

  const chartData = data.groups.map((g, i) => ({
    ...g,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <SectionCard>
      <SectionTitle>{widget.title}</SectionTitle>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
        {data.groups.length} groups • Total: {formatValue(data.total, widget.metric_field, widget.aggregation, fmt)}
      </div>
      {data.groups.length === 0 ? (
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
          No data
        </div>
      ) : (
        // Sticky-axis pattern: scrollable bars on top, frozen X-axis below.
        // Recharts renders the entire chart (incl. axes) as one SVG, so a
        // single overflow:auto wrapper makes the axis scroll with the bars.
        // We split into two BarCharts that share the same data — top one
        // hides the X-axis, bottom one only renders it.
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="thin-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            {hasMounted ? (
              <div style={{ width: "100%", height: Math.max(chartData.length * 36, 80) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, 'dataMax']} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={<EllipsisTick width={80} fontSize={10.5} />}
                      width={80}
                    />
                    <RechartsTooltip
                      content={<BarTooltip metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
                      cursor={{ fill: "rgba(0,0,0,.03)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
          {hasMounted && (
            <div style={{ width: "100%", height: 22, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#b0b8c8", fontWeight: 500 }} domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="label" hide width={80} />
                  <Bar dataKey="value" hide />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Pie/Donut Renderer (Recharts) ──────────────────────────────────────────
function PieTooltip({ active, payload, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
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
  )
}

function PieRenderer({ widget, data }: CustomWidgetRendererProps) {
  const { fmt } = useCurrency()
  const hasMounted = useHasMounted()
  const total = data.groups.reduce((s, g) => s + g.value, 0) || 1

  const chartData = data.groups.map((g, i) => ({
    ...g,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    pct: (g.value / total) * 100,
    pctLabel: `${((g.value / total) * 100).toFixed(1)}%`,
  }))

  return (
    <SectionCard>
      <SectionTitle>{widget.title}</SectionTitle>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        {/* Donut */}
        <div style={{ width: '45%', flexShrink: 0, position: 'relative' }}>
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
                  content={<PieTooltip metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
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
function ListTooltip({ active, payload, metricField, aggregation, fmt }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
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

function ListRenderer({ widget, data }: CustomWidgetRendererProps) {
  const { fmt } = useCurrency()
  const hasMounted = useHasMounted()

  const chartData = data.groups.map((g, i) => ({
    ...g,
    rank: i + 1,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    tickLabel: `#${i + 1} ${g.label}`,
  }))

  return (
    <SectionCard>
      <SectionTitle>{widget.title}</SectionTitle>
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
              <div style={{ width: "100%", height: Math.max(chartData.length * 36, 80) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, 'dataMax']} />
                    <YAxis
                      type="category"
                      dataKey="tickLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={<ListRankTick data={chartData} />}
                      width={100}
                    />
                    <RechartsTooltip
                      content={<ListTooltip metricField={widget.metric_field} aggregation={widget.aggregation} fmt={fmt} />}
                      cursor={{ fill: "rgba(0,0,0,.03)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
          {hasMounted && (
            <div style={{ width: "100%", height: 22, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#b0b8c8", fontWeight: 500 }} domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="tickLabel" hide width={100} />
                  <Bar dataKey="value" hide />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Renderer ──────────────────────────────────────────────────────────
export function CustomWidgetRenderer({ widget, data }: CustomWidgetRendererProps) {
  switch (widget.widget_type) {
    case 'kpi':
      return <KPIRenderer widget={widget} data={data} />
    case 'bar':
      return <BarRenderer widget={widget} data={data} />
    case 'pie':
      return <PieRenderer widget={widget} data={data} />
    case 'list':
      return <ListRenderer widget={widget} data={data} />
    default:
      return <SectionCard><div style={{ padding: 20, color: '#94a3b8' }}>Unknown widget type</div></SectionCard>
  }
}
