"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { PAGE_SIZES } from "@/lib/missions/mission-paging"

/**
 * The table's footer, as Material's data table lays it out: rows per page,
 * the range and total, previous and next, all at the trailing edge. State
 * lives in the URL beside the filters, so page 3 of a filtered view is a
 * link that can be sent and returned to.
 */
export function MissionPagination({ page, size, total }: { page: number; size: number; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()

  const set = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key)
      else params.set(key, value)
    }
    const qs = params.toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  const first = total === 0 ? 0 : page * size + 1
  const last = Math.min(total, (page + 1) * size)
  const lastPage = Math.max(0, Math.ceil(total / size) - 1)

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t bg-card px-4 py-2 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        <span>Baris per halaman</span>
        <select
          value={size}
          onChange={(event) => set({ size: event.target.value === "25" ? null : event.target.value, page: null })}
          className="h-9 rounded-md border border-input bg-field px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Baris per halaman"
        >
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span className="tabular-nums" aria-live="polite">
        {pending ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : `${first}–${last} dari ${total}`}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page <= 0 || pending} onClick={() => set({ page: page - 1 <= 0 ? null : String(page - 1) })} aria-label="Halaman sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page >= lastPage || pending} onClick={() => set({ page: String(page + 1) })} aria-label="Halaman berikutnya">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </span>
    </div>
  )
}

/** The Jadwal column header: click to cycle nearest-first, oldest-first, newest-first. */
export function SortHeader({ sort }: { sort: "upcoming" | "asc" | "desc" }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const next = sort === "upcoming" ? "asc" : sort === "asc" ? "desc" : "upcoming"
  const label = sort === "upcoming" ? "terdekat dulu" : sort === "asc" ? "terlama dulu" : "terbaru dulu"
  const go = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "upcoming") params.delete("sort")
    else params.set("sort", next)
    params.delete("page")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  return (
    <button type="button" onClick={go} className="inline-flex items-center gap-1 hover:text-foreground" title={`Urut: ${label}. Klik untuk mengubah.`}>
      Jadwal
      <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">{label}</span>
    </button>
  )
}
