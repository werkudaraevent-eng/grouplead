"use client"

import { Slot } from "radix-ui"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useCompact } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"

/**
 * A popover on a desk, a bottom sheet on a phone.
 *
 * Material anchors a small choice list to its control where there is room
 * and moves it to a modal bottom sheet where there is not: a 256px popover
 * on a 360px phone is a desktop control squeezed, with rows too short to
 * tap and a keyboard that covers it. The trigger stays the same element in
 * both; only the surface it opens changes. Controlled, so the caller can
 * close it after a pick.
 */
export function ResponsivePopover({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  align = "start",
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactElement
  title: string
  description?: string
  align?: "start" | "center" | "end"
  /** Popover content classes (width, padding); ignored on a phone. */
  className?: string
  children: React.ReactNode
}) {
  const compact = useCompact()
  if (compact) {
    return (
      <>
        <Slot.Root onClick={() => onOpenChange(!open)}>{trigger}</Slot.Root>
        <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
          <div className="px-2 pb-2">{children}</div>
        </BottomSheet>
      </>
    )
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("p-0", className)}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
