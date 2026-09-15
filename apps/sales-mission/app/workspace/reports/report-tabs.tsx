"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Material 3 primary tabs: two sibling views of one destination. The
 * navigation item stays one ("Laporan"); the tabs choose between the list
 * of records and the summary over them. Indicator under the active label,
 * 48dp tall, sentence case.
 */
const TABS = [
  { href: "/workspace/reports", label: "Daftar" },
  { href: "/workspace/reports/ringkasan", label: "Ringkasan" },
] as const

export function ReportTabs() {
  const pathname = usePathname()
  return (
    <nav role="tablist" aria-label="Tampilan laporan" className="mb-4 flex border-b">
      {TABS.map((tab) => {
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
