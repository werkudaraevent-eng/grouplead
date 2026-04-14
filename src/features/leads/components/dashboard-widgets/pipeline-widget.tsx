"use client"

import { useState, useEffect, useRef } from "react"
import { resolveStageColor, toRgba } from "@/features/leads/lib/stage-color"
import { CHART_COLORS, formatPct, formatSignedPct } from "./shared"

interface PipelineStageData {
    id: string
    name: string
    color: string
    count: number
    previousCount: number
    share: number
    previousShare: number
    shareDelta: number
    sortOrder: number
}

interface PipelineWidgetProps {
    data: PipelineStageData[]
    comparisonLabel: string
}

export function PipelineWidget({ data, comparisonLabel }: PipelineWidgetProps) {
    const [hovIdx, setHovIdx] = useState<number | null>(null)
    const [showTopFade, setShowTopFade] = useState(false)
    const [showBottomFade, setShowBottomFade] = useState(false)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const maxCount = Math.max(...data.map(d => d.count), 1)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const updateScrollState = () => {
            const { scrollTop, scrollHeight, clientHeight } = el
            setShowTopFade(scrollTop > 4)
            setShowBottomFade(scrollTop + clientHeight < scrollHeight - 4)
        }
        updateScrollState()
        el.addEventListener("scroll", updateScrollState, { passive: true })
        window.addEventListener("resize", updateScrollState)
        return () => {
            el.removeEventListener("scroll", updateScrollState)
            window.removeEventListener("resize", updateScrollState)
        }
    }, [data])

    return (
        <div style={{
            background: "#fff", borderRadius: 10, padding: 16,
            border: "1px solid #e5e8ed", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
        }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729", marginBottom: 1 }}>Pipeline Stages</div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 14 }}>Lead distribution by stage</div>

            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                {showTopFade && (
                    <div style={{
                        position: "absolute", top: 0, left: 0, right: 8, height: 18,
                        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0) 100%)",
                        zIndex: 2, pointerEvents: "none",
                    }} />
                )}
                {showBottomFade && (
                    <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 8, height: 24,
                        background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.98) 100%)",
                        zIndex: 2, pointerEvents: "none",
                    }} />
                )}
                <div
                    ref={scrollRef}
                    className="pipeline-stages-scroll"
                    style={{
                        display: "flex", flexDirection: "column", gap: 10,
                        overflowY: "auto", paddingRight: 6,
                        scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent",
                        maxHeight: "100%",
                    }}
                >
                    {data.map((p, i) => {
                        const color = resolveStageColor(p.color, CHART_COLORS[i % CHART_COLORS.length])
                        return (
                            <div key={p.id}
                                onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)}
                                style={{ cursor: "default", position: "relative" }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: hovIdx === i ? "#0f1729" : "#5a6178", transition: "color .12s" }}>{p.name}</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700,
                                        color: hovIdx === i ? "#fff" : color,
                                        background: hovIdx === i ? color : toRgba(color, 0.12),
                                        border: `1px solid ${toRgba(color, hovIdx === i ? 0.35 : 0.22)}`,
                                        padding: "0 5px", borderRadius: 3, minWidth: 20, textAlign: "center" as const,
                                        transition: "background .12s, color .12s, border-color .12s", lineHeight: "16px",
                                    }}>{p.count}</span>
                                </div>
                                <div style={{ height: 5, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", width: `${(p.count / maxCount) * 100}%`,
                                        background: `linear-gradient(90deg, ${color}, ${toRgba(color, 0.72)})`,
                                        borderRadius: 3, transition: "width .45s ease",
                                    }} />
                                </div>
                                {hovIdx === i && (
                                    <div style={{
                                        position: "absolute", top: 28, left: 0, zIndex: 10,
                                        minWidth: 220, maxWidth: 280, padding: "8px 10px",
                                        background: "#0f1729", boxShadow: "0 8px 24px rgba(15, 23, 41, 0.22)",
                                        borderRadius: 10, pointerEvents: "none",
                                    }}>
                                        <div style={{
                                            position: "absolute", top: -6, left: 18,
                                            width: 12, height: 12, background: "#0f1729",
                                            transform: "rotate(45deg)", borderRadius: 2,
                                        }} />
                                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", position: "relative" }}>
                                            {formatPct(p.share)} of current leads
                                        </div>
                                        <div style={{ fontSize: 9.5, color: "#cbd5e1", marginTop: 3, position: "relative" }}>
                                            {comparisonLabel}: {p.previousCount} lead{p.previousCount === 1 ? "" : "s"} ({formatPct(p.previousShare)})
                                        </div>
                                        <div style={{
                                            fontSize: 9.5, fontWeight: 600,
                                            color: p.shareDelta >= 0 ? "#6ee7b7" : "#fca5a5",
                                            marginTop: 3, position: "relative",
                                        }}>
                                            YoY share: {formatSignedPct(p.shareDelta, " pts")}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
            <style jsx>{`
                .pipeline-stages-scroll::-webkit-scrollbar { width: 8px; }
                .pipeline-stages-scroll::-webkit-scrollbar-track { background: transparent; }
                .pipeline-stages-scroll::-webkit-scrollbar-thumb {
                    background: #d7dee9; border-radius: 999px;
                    border: 2px solid transparent; background-clip: padding-box;
                }
                .pipeline-stages-scroll::-webkit-scrollbar-thumb:hover {
                    background: #c0c9d8; border: 2px solid transparent; background-clip: padding-box;
                }
            `}</style>
        </div>
    )
}
