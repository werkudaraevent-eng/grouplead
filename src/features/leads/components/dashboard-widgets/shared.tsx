"use client"

import { CSSProperties } from "react"

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
export const ACCENT = {
    leads: "#6366f1",
    revenue: "#0ea5e9",
    winrate: "#10b981",
    conversion: "#8b5cf6",
    dealsize: "#f59e0b",
}

export const CHART_COLORS = [
    '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#0ea5e9', '#14b8a6', '#f43f5e', '#06b6d4',
]

export const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ─── FORMATTERS ─────────────────────────────────────────────────────────────
/**
 * @deprecated Use `useCurrency()` hook from `@/contexts/currency-context` instead.
 * Kept as a fallback for non-hook contexts (e.g. server utilities).
 */
export function formatCur(amount: number): string {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}M`
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`
    return `Rp ${amount.toLocaleString()}`
}

export function formatPct(value: number) {
    return `${value.toFixed(1)}%`
}

export function formatSignedPct(value: number, suffix = "%") {
    const sign = value > 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}${suffix}`
}

export function getVsLastYearPct(current: number, previous: number) {
    if (previous <= 0) return null
    return ((current - previous) / previous) * 100
}

// ─── SHARED COMPONENTS ──────────────────────────────────────────────────────
export function SectionCard({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
    return (
        <div
            className="thin-scrollbar"
            style={{
                background: "#fff", borderRadius: 12, padding: "16px 18px 14px",
                border: "1px solid #e8ecf1", boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.02)",
                height: "100%", display: "flex", flexDirection: "column",
                overflowY: "auto", overflowX: "hidden",
                ...style,
            }}
        >
            {children}
        </div>
    )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2, letterSpacing: "-0.2px" }}>{children}</div>
}

export function SectionSub({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>{children}</div>
}

export function InsightCallout({ icon, text }: { icon: string; text: string }) {
    return (
        <div style={{
            marginTop: 10, paddingTop: 8, borderLeft: "2px solid #e0e7ff",
            paddingLeft: 10, fontSize: 10.5, color: "#64748b",
            lineHeight: 1.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            flexShrink: 0,
        }}>
            {icon} {text}
        </div>
    )
}

export function DarkTooltip({ active, payload, label, fmt }: any) {
    if (!active || !payload) return null
    const _fmt = fmt ?? formatCur
    const dataPoint = payload[0]?.payload
    const vsLastYear = dataPoint?.vsLastYear ?? null
    return (
        <div style={{
            ...TOOLTIP_STYLE,
        }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <span>{p.name}: {typeof p.value === 'number' && p.name !== 'Count' ? _fmt(p.value) : p.value}</span>
                </div>
            ))}
            {payload[0]?.payload?.overUnder !== undefined && payload[0].payload.actual > 0 && (
                <div style={{ marginTop: 2, opacity: 0.7 }}>
                    vs Target: <span style={{ color: payload[0].payload.overUnder >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                        {payload[0].payload.overUnder > 0 ? "+" : ""}{payload[0].payload.overUnder.toFixed(1)}%
                    </span>
                </div>
            )}
            {dataPoint?.prevYear !== undefined && (
                <div style={{ marginTop: 2, opacity: 0.7 }}>
                    vs Last Year:{" "}
                    <span style={{ color: vsLastYear === null ? "#cbd5e1" : vsLastYear >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                        {vsLastYear === null
                            ? (dataPoint.actual > 0 && dataPoint.prevYear === 0 ? "New" : "N/A")
                            : formatSignedPct(vsLastYear)}
                    </span>
                </div>
            )}
        </div>
    )
}

export function Badge({ value, label }: { value: number | null; label: string }) {
    // Handle null values - show N/A
    if (value === null) {
        return (
            <span style={{
                display: "inline-flex", alignItems: "center", gap: 2,
                fontSize: 10, fontWeight: 600, color: "#94a3b8",
                background: "rgba(148,163,184,.07)",
                padding: "1px 5px", borderRadius: 4, lineHeight: 1.5,
            }}>
                <span style={{ fontSize: 7 }}>—</span>
                N/A {label}
            </span>
  )
}

    const pos = value >= 0
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: 10, fontWeight: 600, color: pos ? "#10b981" : "#ef4444",
            background: pos ? "rgba(16,185,129,.07)" : "rgba(239,68,68,.07)",
            padding: "1px 5px", borderRadius: 4, lineHeight: 1.5,
        }}>
            <span style={{ fontSize: 7 }}>{pos ? "▲" : "▼"}</span>
            {Math.abs(value).toFixed(1)}% {label}
        </span>
    )
}

// ─── MINI SELECT STYLE ──────────────────────────────────────────────────────
export const TOOLTIP_STYLE: CSSProperties = {
    background: "#0f1729", color: "#fff", padding: "8px 11px", borderRadius: 8,
    fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    maxWidth: 260,
}

export const miniSelectStyle: CSSProperties = {
    appearance: "none" as const, background: "#f4f5f7", border: "1px solid #e5e8ed", borderRadius: 5,
    padding: "3px 20px 3px 8px", fontSize: 11, fontWeight: 600, color: "#0f1729",
    cursor: "pointer", fontFamily: "inherit",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 5px center",
}

export function EmptyState({ icon, message, cta, href }: {
  icon?: React.ReactNode
  message: string
  cta?: string
  href?: string
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px 16px", textAlign: "center",
      height: "100%", minHeight: 120,
    }}>
      {icon && <div style={{ marginBottom: 8, opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, maxWidth: 200 }}>
        {message}
      </div>
      {cta && href && (
        <a
          href={href}
          style={{
            marginTop: 10, fontSize: 10, fontWeight: 600,
            color: "#6366f1", textDecoration: "none",
            padding: "4px 12px", border: "1px solid #e0e7ff",
            borderRadius: 6, background: "#eef2ff",
          }}
        >
          {cta}
        </a>
      )}
    </div>
  )
}

/** Shared Y-axis tick that truncates long labels with ellipsis */
export function EllipsisTick({ x, y, payload, width = 100, fontSize = 10 }: any) {
  const maxChars = Math.floor((width - 8) / (fontSize * 0.52))
  const text = payload?.value ?? ""
  const display = text.length > maxChars ? text.slice(0, maxChars - 1) + "\u2026" : text
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text x={-4} y={0} dy={4} textAnchor="end" fill="#64748b" fontSize={fontSize} fontWeight={500}>
        {display}
      </text>
    </g>
  )
}
