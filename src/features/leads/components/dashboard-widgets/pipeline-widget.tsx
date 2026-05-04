"use client"

import { resolveStageColor } from "@/features/leads/lib/stage-color"
import { SectionCard, SectionTitle, SectionSub, CHART_COLORS, formatPct, formatSignedPct, TOOLTIP_STYLE } from "./shared"
import { useState } from "react"

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

/** Classify stage as active, won, or lost */
function classifyStage(name: string): "active" | "won" | "lost" {
    const n = name.toLowerCase()
    if (n.includes("won")) return "won"
    if (n.includes("lost") || n.includes("turndown") || n.includes("cancelled") || n.includes("postponed")) return "lost"
    return "active"
}

export function PipelineWidget({ data, comparisonLabel }: PipelineWidgetProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const totalLeads = data.reduce((s, d) => s + d.count, 0)
    const maxCount = Math.max(...data.map(d => d.count), 1)

    // Split into active pipeline vs closed outcomes
    const activeStages = data.filter(d => classifyStage(d.name) === "active")
    const wonStages = data.filter(d => classifyStage(d.name) === "won")
    const lostStages = data.filter(d => classifyStage(d.name) === "lost")

    const wonCount = wonStages.reduce((s, d) => s + d.count, 0)
    const lostCount = lostStages.reduce((s, d) => s + d.count, 0)
    const closedTotal = wonCount + lostCount
    const winRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0

    const renderRow = (stage: PipelineStageData, idx: number, type: "active" | "won" | "lost") => {
        const color = type === "won" ? "#6EBDA1" : type === "lost" ? "#ED6F22" : resolveStageColor(stage.color, CHART_COLORS[idx % CHART_COLORS.length])
        const barWidth = totalLeads > 0 ? Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 3 : 0) : 0
        const isHovered = hoveredId === stage.id

        return (
            <div
                key={stage.id}
                className="group relative"
                onMouseEnter={() => setHoveredId(stage.id)}
                onMouseLeave={() => setHoveredId(null)}
            >
                <div className="flex items-center gap-2 py-[5px]">
                    {/* Stage name */}
                    <div className="w-[140px] shrink-0 text-right pr-2">
                        <span className="text-[11px] font-medium text-[#292D30] leading-tight" title={stage.name}>
                            {stage.name}
                        </span>
                    </div>
                    {/* Funnel bar */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="flex-1 h-[18px] bg-[#f4f6f8] rounded-[3px] overflow-hidden relative">
                            <div
                                className="h-full rounded-[3px]"
                                style={{
                                    width: `${barWidth}%`,
                                    backgroundColor: color,
                                    opacity: isHovered ? 1 : 0.8,
                                    transition: "width 500ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
                                }}
                            />
                        </div>
                        {/* Count + percentage */}
                        <div className="flex items-baseline gap-1 shrink-0 min-w-[52px]">
                            <span className="text-[12px] font-bold tabular-nums text-[#292D30]">{stage.count}</span>
                            {totalLeads > 0 && (
                                <span className="text-[9px] text-muted-foreground tabular-nums">{formatPct(stage.share)}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                    <div
                        className="absolute left-[148px] -top-1 z-10 pointer-events-none animate-in fade-in duration-150"
                        style={{ ...TOOLTIP_STYLE, position: "absolute" }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{stage.name}</div>
                        <div>{stage.count} leads ({formatPct(stage.share)})</div>
                        <div style={{ opacity: 0.7, fontSize: 10 }}>
                            {comparisonLabel}: {stage.previousCount} ({formatPct(stage.previousShare)})
                        </div>
                        {stage.shareDelta !== 0 && (
                            <div style={{ fontWeight: 600, color: stage.shareDelta >= 0 ? "#6ee7b7" : "#fca5a5", fontSize: 10 }}>
                                YoY: {formatSignedPct(stage.shareDelta, " pts")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <SectionCard>
            {/* Header with win rate */}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <SectionTitle>Pipeline Funnel</SectionTitle>
                    <SectionSub>{totalLeads} total leads across {data.length} stages</SectionSub>
                </div>
                {closedTotal > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Win rate</div>
                        <div className="text-[17px] font-bold tabular-nums tracking-tight" style={{ color: winRate >= 50 ? "#6EBDA1" : winRate >= 30 ? "#292D30" : "#ED6F22" }}>
                            {winRate.toFixed(1)}%
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar">
                {/* Active Pipeline */}
                {activeStages.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1 pl-[148px]">Active pipeline</div>
                        {activeStages.map((s, i) => renderRow(s, i, "active"))}
                    </div>
                )}

                {/* Divider */}
                {(wonStages.length > 0 || lostStages.length > 0) && activeStages.length > 0 && (
                    <div className="border-t border-dashed border-border/60 my-2" />
                )}

                {/* Closed Outcomes */}
                {(wonStages.length > 0 || lostStages.length > 0) && (
                    <div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1 pl-[148px]">Closed outcomes</div>
                        {wonStages.map((s, i) => renderRow(s, i, "won"))}
                        {lostStages.map((s, i) => renderRow(s, i, "lost"))}
                    </div>
                )}

                {/* Won vs Lost summary bar */}
                {closedTotal > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2 pl-[148px]">
                            <div className="flex-1 h-[6px] bg-[#f4f6f8] rounded-full overflow-hidden flex">
                                <div
                                    className="h-full rounded-l-full"
                                    style={{ width: `${(wonCount / closedTotal) * 100}%`, backgroundColor: "#6EBDA1", transition: "width 500ms cubic-bezier(0.23,1,0.32,1)" }}
                                />
                                <div
                                    className="h-full rounded-r-full"
                                    style={{ width: `${(lostCount / closedTotal) * 100}%`, backgroundColor: "#ED6F22", transition: "width 500ms cubic-bezier(0.23,1,0.32,1)" }}
                                />
                            </div>
                            <div className="flex gap-3 shrink-0 text-[9px] font-medium">
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#6EBDA1]" />Won {wonCount}</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ED6F22]" />Lost {lostCount}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    )
}
