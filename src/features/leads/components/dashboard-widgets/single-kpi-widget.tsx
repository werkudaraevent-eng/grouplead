"use client"

import { Badge } from "./shared"
import { InfoIcon } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface SingleKPIProps {
    label: string
    value: string
    prefix?: string
    suffix?: string
    vsTarget: number | null
    vsPrev: number | null
    accent: string
    icon: React.ComponentType<any>
    tooltip?: string
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, icon: Icon, tooltip }: SingleKPIProps) {
    return (
        <div
            className={cn(
                "group bg-card rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,.03)]",
                "px-3.5 pt-2.5 pb-2 flex flex-col gap-1 min-w-0",
                "relative overflow-visible cursor-default h-full box-border",
                "transition-all duration-200 ease-out",
                "hover:-translate-y-0.5 hover:shadow-md",
                "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
            )}
            style={{
                // accent-colored hover border needs dynamic color
                borderColor: undefined,
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = accent + "35"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
        >
            {/* Accent top bar */}
            <div
                className="absolute top-0 left-0 right-0 h-[2.5px] rounded-t-[10px] opacity-50 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }}
            />

            {/* Label + icon */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground tracking-wide truncate">{label}</span>
                    {tooltip && <InfoIcon tooltip={tooltip} position="top" />}
                </div>
                <span
                    className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0"
                    style={{ background: accent + "0c", color: accent }}
                >
                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                </span>
            </div>

            {/* Value */}
            <div className="text-[22px] font-extrabold text-foreground tracking-tight leading-none truncate">
                {prefix}{value}{suffix}
            </div>

            {/* Badges */}
            <div className="flex gap-0.5 flex-wrap mt-0.5 min-h-[20px]">
                {vsTarget !== null && <Badge value={vsTarget} label="target" />}
                {vsPrev !== null && <Badge value={vsPrev} label="YoY" />}
                {vsTarget === null && vsPrev === null && (
                    <span className="text-[9px] text-slate-300 italic">
                        No comparison data
                    </span>
                )}
            </div>
        </div>
    )
}
