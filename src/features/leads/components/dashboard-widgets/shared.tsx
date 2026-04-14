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
        <div style={{
            background: "#fff", borderRadius: 10, padding: "14px 16px 12px",
            border: "1px solid #e5e8ed", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            height: "100%", display: "flex", flexDirection: "column",
            overflow: "hidden",
            ...style,
        }}>
            {children}
        </div>
    )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729", marginBottom: 1 }}>{children}</div>
}

export function SectionSub({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 12 }}>{children}</div>
}

export function InsightCallout({ icon, text }: { icon: string; text: string }) {
    return (
        <div style={{
            marginTop: 10, paddingTop: 8, borderLeft: "2px solid #6366f1",
            paddingLeft: 8, fontSize: 10, fontStyle: "italic", color: "#8892a4",
            lineHeight: 1.5,
        }}>
            {icon} {text}
        </div>
    )
}

export function DarkTooltip({ active, payload, label }: any) {
    if (!active || !payload) return null
    const dataPoint = payload[0]?.payload
    const vsLastYear = dataPoint?.vsLastYear ?? null
    return (
        <div style={{
            background: "#0f1729", color: "#fff", padding: "6px 9px", borderRadius: 6,
            fontSize: 9.5, lineHeight: 1.6, boxShadow: "0 3px 12px rgba(0,0,0,.2)",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <span>{p.name}: {typeof p.value === 'number' && p.name !== 'Count' ? formatCur(p.value) : p.value}</span>
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

export function Badge({ value, label }: { value: number; label: string }) {
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
export const miniSelectStyle: CSSProperties = {
    appearance: "none" as const, background: "#f4f5f7", border: "1px solid #e5e8ed", borderRadius: 5,
    padding: "3px 20px 3px 8px", fontSize: 11, fontWeight: 600, color: "#0f1729",
    cursor: "pointer", fontFamily: "inherit",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 5px center",
}
