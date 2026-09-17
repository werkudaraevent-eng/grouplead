"use client"

import { useRouter } from "next/navigation"
import { Check } from "@/components/icons"
import { FacetSelect } from "@/components/facet-select"
import { PersonAvatar } from "@/components/person-avatar"
import { publicCalendarHref } from "@/lib/board/public-calendar"
import { cn } from "@/lib/utils"

/**
 * Whose schedule, on the public calendar.
 *
 * The same two shapes as the signed-in filter so the pages read as one, minus
 * the parts that need an account: there is no "Saya" without a viewer, and
 * nothing is remembered between visits because there is nobody to remember it
 * for. The URL carries the whole state, which also makes a filtered link
 * shareable as it is.
 */
export function JadwalFilter({
  token,
  month,
  day,
  sales,
  people,
}: {
  token: string
  month: string
  day: string
  sales: string[]
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
}) {
  const router = useRouter()
  const go = (next: string[]) => router.push(publicCalendarHref(token, { month, day, sales: next }))
  const all = sales.length === 0

  return (
    <nav
      aria-label="Saringan jadwal"
      className="-mx-4 flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={all}
        onClick={() => go([])}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors",
          all ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "border-input bg-transparent text-foreground hover:bg-muted"
        )}
      >
        {all && <Check className="h-4 w-4" aria-hidden="true" />}
        Semua
      </button>
      <FacetSelect
        label="Sales"
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        value={sales}
        onChange={go}
        renderOption={(option) => {
          const person = people.find((item) => item.id === option.value)
          return (
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={option.label} avatarUrl={person?.avatarUrl ?? null} size="sm" />
              <span className="truncate">{option.label}</span>
            </span>
          )
        }}
      />
    </nav>
  )
}
