"use client"

import { useRouter } from "next/navigation"
import { ListTree } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { rememberView } from "@/components/remember-view"
import type { ListKey } from "@/lib/view-cookies"
import { CALENDAR_GROUP_LABELS, CALENDAR_GROUPS, type CalendarGroup } from "@/lib/missions/calendar-filter"
import { cn } from "@/lib/utils"

/**
 * How the day pane is grouped: one icon button in the pane's header that
 * opens an M3 menu of radio items (the same shape as a widget's size menu),
 * so no new control is learned. The choice is part of the URL, so a public
 * link carries it, and on the signed-in calendar it is remembered with the
 * rest of the view. The button reads as "on" while a grouping is active.
 */
export function DayGroupMenu({ value, hrefs, list }: { value: CalendarGroup; /** The page's URL for each grouping, built on the server: a client component may only receive data. */ hrefs: Record<CalendarGroup, string>; list?: ListKey }) {
  const router = useRouter()
  const active = value !== "none"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-10 w-10 rounded-full md:h-9 md:w-9", active ? "bg-[var(--tonal)] text-[var(--tonal-foreground)] hover:bg-[var(--tonal)]" : "text-muted-foreground")}
          aria-label={active ? `Dikelompokkan menurut ${CALENDAR_GROUP_LABELS[value].toLowerCase()}` : "Kelompokkan"}
          title="Kelompokkan"
        >
          <ListTree className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Kelompokkan menurut</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const href = hrefs[next as CalendarGroup]
            if (list) rememberView(list, href.split("?")[1] ?? "")
            router.push(href)
          }}
        >
          {CALENDAR_GROUPS.map((group) => (
            <DropdownMenuRadioItem key={group} value={group}>
              {CALENDAR_GROUP_LABELS[group]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
