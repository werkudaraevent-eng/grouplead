"use client"

import Link from "next/link"
import { useState } from "react"
import { Slot } from "radix-ui"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useCompact } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"

/**
 * A row's overflow menu: a dropdown on a desk, an action sheet on a phone.
 *
 * Material's menu is for a pointer; on a phone the same choices become a
 * bottom sheet of 56dp rows the thumb can hit. The items are data rather
 * than children so the two renderings cannot disagree about what is
 * offered. `null` items are skipped; a separator is a "divider" entry.
 */
export type MenuEntry =
  | { kind?: "item"; label: string; icon?: React.ElementType; href?: string; onSelect?: () => void; danger?: boolean }
  | { kind: "divider" }
  | null
  | false

export function ResponsiveMenu({
  trigger,
  title,
  items,
  align = "end",
  className,
}: {
  trigger: React.ReactElement
  title: string
  items: MenuEntry[]
  align?: "start" | "center" | "end"
  className?: string
}) {
  const compact = useCompact()
  const [open, setOpen] = useState(false)
  const entries = items.filter((item): item is Exclude<MenuEntry, null | false> => Boolean(item))

  if (compact) {
    return (
      <>
        <Slot.Root onClick={() => setOpen(true)}>{trigger}</Slot.Root>
        <BottomSheet open={open} onOpenChange={setOpen} title={title}>
          <div className="space-y-1 pb-2">
            {entries.map((entry, index) => {
              if (entry.kind === "divider") return <div key={index} className="my-2 border-t" />
              const Icon = entry.icon
              const classes = cn(
                "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors hover:bg-muted",
                entry.danger ? "text-[var(--danger-foreground)]" : "text-foreground"
              )
              const body = (
                <>
                  {Icon && <Icon className={cn("h-5 w-5 shrink-0", entry.danger ? "" : "text-muted-foreground")} aria-hidden="true" />}
                  <span className="flex-1">{entry.label}</span>
                </>
              )
              return entry.href ? (
                <Link key={index} href={entry.href} className={classes} onClick={() => setOpen(false)}>{body}</Link>
              ) : (
                <button key={index} type="button" className={classes} onClick={() => { setOpen(false); entry.onSelect?.() }}>{body}</button>
              )
            })}
          </div>
        </BottomSheet>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("w-56", className)}>
        {entries.map((entry, index) => {
          if (entry.kind === "divider") return <DropdownMenuSeparator key={index} />
          const Icon = entry.icon
          const danger = entry.danger ? "text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]" : undefined
          if (entry.href) {
            return (
              <DropdownMenuItem key={index} asChild className={danger}>
                <Link href={entry.href}>{Icon && <Icon className="h-4 w-4" />} {entry.label}</Link>
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuItem key={index} onSelect={entry.onSelect} className={danger}>
              {Icon && <Icon className="h-4 w-4" />} {entry.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
