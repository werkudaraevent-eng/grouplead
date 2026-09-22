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
 * tabs; on a desk it follows the page header.
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

export function ReportTabs({ showInsight = false }: { showInsight?: boolean }) {
  const pathname = usePathname()
  const tabs = showInsight ? [...TABS, INSIGHT_TAB] : TABS
  return (
    <nav role="tablist" aria-label="Tampilan laporan" className="mb-4 flex border-b max-lg:-mt-3 max-sm:-mx-4 max-sm:mb-3 sm:max-lg:-mx-6 sm:max-lg:px-2">
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
