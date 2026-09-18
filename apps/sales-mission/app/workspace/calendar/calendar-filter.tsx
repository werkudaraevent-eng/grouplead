"use client"

import { useRouter } from "next/navigation"
import { Check } from "@/components/icons"
import { FacetSelect } from "@/components/facet-select"
import { PersonAvatar } from "@/components/person-avatar"
import { rememberView, ViewLink } from "@/components/remember-view"
import { calendarHref, SALES_ME, toggleMe } from "@/lib/missions/calendar-filter"
import { cn } from "@/lib/utils"

/**
 * Whose calendar: "Semua" and "Saya" as filter chips, then the Sales facet
 * for one or more named people. The same shapes as the activity list's
 * quick chips and facet (M3 filter chips, tonal with a leading check when
 * on), so the two pages read as one. Every change is remembered as the
 * calendar's view before navigating, and "Semua" writes an empty memory
 * first so the server does not restore the filter it is leaving.
 */
export function CalendarFilter({
  month,
  day,
  sales,
  people,
}: {
  month: string
  day: string
  sales: string[]
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
}) {
  const router = useRouter()
  const hasMe = sales.includes(SALES_ME)
  const named = sales.filter((id) => id !== SALES_ME)
  const href = (next: string[]) => calendarHref({ month, day, sales: next })
  const go = (next: string[]) => {
    const target = href(next)
    rememberView("calendar", target.split("?")[1] ?? "")
    router.push(target)
  }

  const chips = [
    { key: "all", label: "Semua", active: sales.length === 0, href: href([]) },
    { key: "me", label: "Saya", active: hasMe, href: href(toggleMe(sales)) },
  ]

  return (
    <nav
      aria-label="Saringan kalender"
      className="chip-scroll -mx-4 flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <ViewLink
          key={chip.key}
          list="calendar"
          href={chip.href}
          aria-pressed={chip.active}
          className={cn(
            "relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
            chip.active
              ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]"
              : "border-input bg-transparent text-foreground hover:bg-muted"
          )}
        >
          {chip.active && <Check className="h-4 w-4" aria-hidden="true" />}
          {chip.label}
        </ViewLink>
      ))}
      <FacetSelect
        label="Sales"
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        value={named}
        onChange={(next) => go(hasMe ? [SALES_ME, ...next] : next)}
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
