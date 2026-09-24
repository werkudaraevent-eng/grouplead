"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Material 3 primary tabs: sibling views of one destination. The
 * navigation item stays one ("Laporan"); the tabs choose between the list
 * of records, the summary over them, and the day's AI brief. Indicator
 * under the active label, 48dp tall, sentence case. On a phone the row
 * sits flush under the top app bar, edge to edge, where M3 puts primary
 * tabs; on a desk it follows the page header. The row pins to the top of
 * the page's scroller: the tabs say which of the three views this is and
 * are how to reach the others, so they stay in reach under the header while
 * a long Ringkasan or Insight scrolls beneath them (M3 tabs: fixed under the
 * top app bar as content scrolls; Google Analytics, Play Console). Below
 * `lg` the scroller has 12px of top padding, and a sticky box pins inside
 * a scroller's padding: `-mt-3` takes it back at rest and `-top-3` once
 * pinned, so the row sits flush under the app bar with no strip of the
 * page scrolling past above it.
 *
 * Insight is a tab only where it exists: the unit's switch is on and the
 * person may read Insight AI. A tab that leads to a refusal is worse than
 * no tab, so the caller decides and passes `showInsight`.
 */
const TABS = [
  { href: "/workspace/reports", label: "Daftar" },
  { href: "/workspace/reports/ringkasan", label: "Ringkasan" },
] as const

const INSIGHT_TAB = { href: "/workspace/reports/insight", label: "Insight" } as const

/**
 * The row's height, 48dp tabs and the 1px rule under them: what pins under
 * it on a phone (the Daftar list's search and chips) starts here.
 */
export const REPORT_TABS_HEIGHT = "calc(3rem + 1px)"

export function ReportTabs({ showInsight = false }: { showInsight?: boolean }) {
  const pathname = usePathname()
  const tabs = showInsight ? [...TABS, INSIGHT_TAB] : TABS
  return (
    <nav role="tablist" aria-label="Tampilan laporan" className="sticky top-0 z-20 mb-4 flex border-b bg-background max-lg:-top-3 max-lg:-mt-3 max-sm:-mx-4 max-sm:mb-3 sm:max-lg:-mx-6 sm:max-lg:px-2">
      {tabs.map((tab) => {
        const active = tab.href === "/workspace/reports" ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "relative flex h-12 items-center px-4 text-sm font-medium transition-colors",
              active ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
