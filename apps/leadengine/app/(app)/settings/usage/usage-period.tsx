"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from "@/lib/usage/usage-stats"
import { cn } from "@/lib/utils"

/**
 * The period for "Daily active users" and "Most opened pages", as a
 * segmented control in each of those cards' headers: it is a range (which
 * view of the same data), and it sits on the cards it changes, not once at
 * the top of the page, because the tiles and the people table between them
 * count fixed windows and a page-level control would read as narrowing
 * them too. One period, in the URL, so both cards always show the same
 * days, pressing either moves both, and a finding can be linked.
 *
 * The house `SegmentedControl`, sized to its labels rather than its row;
 * each option is 44px tall on a phone (the touch target), 32px on a desk.
 */
export function UsagePeriodControl({ period }: { period: UsagePeriod }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <SegmentedControl
      aria-label="Period"
      value={String(period)}
      options={USAGE_PERIODS.map((value) => ({ value: String(value), label: `${value} days` }))}
      onChange={(next) => {
        const value = Number(next)
        const href = value === DEFAULT_USAGE_PERIOD ? "/settings/usage" : `/settings/usage?period=${value}`
        startTransition(() => router.replace(href, { scroll: false }))
      }}
      // Its buttons share a form row equally (flex-1); here each is as wide as its
      // label, so an equal share can never wrap "30 days" onto two lines.
      className={cn("w-auto shrink-0 [&>button]:flex-none [&>button]:whitespace-nowrap [&>button]:min-h-11 sm:[&>button]:min-h-8", pending && "opacity-70")}
    />
  )
}
