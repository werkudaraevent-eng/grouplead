"use client"

import type { ReactElement } from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * M3's plain tooltip: one short label naming an icon button, on the inverse
 * surface, shown on hover or keyboard focus and gone on the press. It wraps
 * the button itself (no extra span), so focus and the button's own state
 * layer stay where they are, and it may carry the control's keyboard
 * shortcut as a key cap after the label. Twin of LeadEngine's
 * `PlainTooltip` in its components/ui/tooltip.tsx.
 */
export function PlainTooltip({
  label,
  shortcut,
  side = "right",
  children,
}: {
  label: string
  shortcut?: string
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            collisionPadding={8}
            className={cn(
              "z-50 flex min-h-6 select-none items-center gap-2 rounded-[4px] bg-foreground px-2 py-1 text-xs font-medium text-background shadow-sm",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            {label}
            {shortcut && (
              <kbd className="rounded-[3px] border border-background/30 px-1 font-sans text-[11px] font-semibold leading-4 text-background">
                {shortcut}
              </kbd>
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
