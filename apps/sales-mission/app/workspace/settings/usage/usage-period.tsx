"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Segmented } from "@/components/segmented"
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from "@/lib/usage/usage-stats"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * The period for "Pengguna aktif per hari" and "Halaman paling dibuka", as
 * a segmented button in each of those cards' headers: it is a range (which
 * view of the same data), and it sits on the cards it changes, not once at
 * the top of the page, because the tiles and the people table between them
 * count fixed windows and a page-level control would read as narrowing
 * them too. One period, in the URL, so both cards always show the same
 * days, pressing either moves both, and a finding can be linked.
 */
export function UsagePeriodControl({ period }: { period: UsagePeriod }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Segmented
      label="Periode"
      value={String(period)}
      options={USAGE_PERIODS.map((value) => ({ value: String(value), label: `${value} hari` }))}
      onChange={(next) => {
        const value = Number(next)
        startTransition(() => router.replace(paths.settings.usage(value === DEFAULT_USAGE_PERIOD ? undefined : { period: value }), { scroll: false }))
      }}
      className={cn(pending && "opacity-70")}
    />
  )
}
