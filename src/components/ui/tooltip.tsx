"use client"

import { ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: string
  children?: ReactNode
  position?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex cursor-default">
            {children || <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={position}
            sideOffset={6}
            className={cn(
              "z-50 px-2.5 py-1.5 text-[11px] leading-snug font-medium",
              "bg-slate-900 text-white rounded-md shadow-lg",
              "max-w-[240px] select-none",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2",
              "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-slate-900" width={8} height={4} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

interface InfoIconProps {
  tooltip: string
  position?: "top" | "bottom" | "left" | "right"
}

export function InfoIcon({ tooltip, position = "top" }: InfoIconProps) {
  return (
    <Tooltip content={tooltip} position={position}>
      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
    </Tooltip>
  )
}
