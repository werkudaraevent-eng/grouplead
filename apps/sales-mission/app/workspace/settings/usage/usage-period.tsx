"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Segmented } from "@/components/segmented"
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from "@/lib/usage/usage-stats"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * The period for "Halaman paling dibuka", as a segmented button in the
 * card's own header: it is a range (which view of the same list), and it
 * sits on the one card it changes so nobody reads it as narrowing the
 * people table above. The URL carries it, so a finding can be linked.
 */
export function UsagePeriodControl({ period }: { period: UsagePeriod }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Segmented
      label="Periode halaman"
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
