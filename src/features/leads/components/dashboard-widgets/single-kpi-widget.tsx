"use client"

import { useState, useEffect } from "react"
import { Badge } from "./shared"

export interface SingleKPIProps {
    label: string
    value: string
    prefix?: string
    suffix?: string
    vsTarget: number
    vsPrev: number
    accent: string
    icon: React.ComponentType<any>
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, icon: Icon }: SingleKPIProps) {
    const [vis, setVis] = useState(false)
    const [hov, setHov] = useState(false)
    useEffect(() => { const t = setTimeout(() => setVis(true), 80); return () => clearTimeout(t) }, [])

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: "#fff", borderRadius: 10,
                padding: "12px 14px 10px",
                border: `1px solid ${hov ? accent + "35" : "#e5e8ed"}`,
                opacity: vis ? 1 : 0,
                transform: vis ? (hov ? "translateY(-2px)" : "translateY(0)") : "translateY(8px)",
                transition: "all .25s ease",
                display: "flex", flexDirection: "column" as const, gap: 4, minWidth: 0,
                position: "relative" as const, overflow: "hidden", cursor: "default",
                height: "100%", boxSizing: "border-box" as const,
                boxShadow: hov
                    ? `0 6px 20px ${accent}10, 0 1px 4px rgba(0,0,0,.04)`
                    : "0 1px 2px rgba(0,0,0,.03)",
            }}
        >
            {/* Accent top bar */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
                background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
                opacity: hov ? 1 : 0.5, transition: "opacity .2s",
            }} />

            {/* Label + icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8892a4", letterSpacing: ".15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: accent + "0c",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: accent, flexShrink: 0,
                }}>
                    <Icon style={{ width: 12, height: 12 }} strokeWidth={2.5} />
                </span>
            </div>

            {/* Value */}
            <div style={{
                fontSize: 26, fontWeight: 800, color: "#0f1729",
                letterSpacing: "-0.7px", lineHeight: 1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
                {prefix}{value}{suffix}
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const, marginTop: 2 }}>
                <Badge value={vsTarget} label="target" />
                <Badge value={vsPrev} label="YoY" />
            </div>
        </div>
    )
}
