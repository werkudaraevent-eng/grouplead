"use client"

import { useRouter } from "next/navigation"
import { FacetSelect } from "@/components/facet-select"
import { PersonAvatar } from "@/components/person-avatar"
import { rememberView } from "@/components/remember-view"
import { ToggleChip } from "@/components/toggle-chip"
import { calendarHref, SALES_ME, toggleMe, type CalendarView } from "@/lib/missions/calendar-filter"

/**
 * Whose calendar, where, and what kind: the "Saya" toggle, then the Sales,
 * Lokasi and Jenis facets, then "Bersihkan semua" while anything narrows the
 * month. The same controls as the activity list's (one `ToggleChip`, the
 * same facet buttons, M3 filter chips), so the two pages read as one. There
 * is no "Semua" chip: the whole team is what the calendar shows when nothing
 * is chosen, so it is not an option beside the others but the state that
 * clearing returns to, as on Aktivitas. "Saya" comes first because on a
 * phone this row scrolls sideways and it is the chip a rep reaches for most.
 * Lokasi and Jenis list what the month actually holds. Every change is
 * remembered as the calendar's view before navigating, so clearing writes
 * an empty memory and the server does not restore the filter it is leaving.
 */
export function CalendarFilter({
  month,
  day,
  view,
  people,
  locations,
  types,
}: {
  month: string
  day: string
  view: CalendarView
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  locations: string[]
  types: string[]
}) {
  const router = useRouter()
  const { sales } = view
  const hasMe = sales.includes(SALES_ME)
  const named = sales.filter((id) => id !== SALES_ME)
  const href = (next: Partial<CalendarView>) => calendarHref({ month, day, ...view, ...next })
  const go = (next: Partial<CalendarView>) => {
    const target = href(next)
    rememberView("calendar", target.split("?")[1] ?? "")
    router.push(target)
  }

  const narrowed = sales.length > 0 || view.location.length > 0 || view.type.length > 0

  return (
    <nav
      aria-label="Saringan kalender"
      className="chip-scroll -mx-4 flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ToggleChip label="Saya" pressed={hasMe} onToggle={() => go({ sales: toggleMe(sales) })} />
      <FacetSelect
        label="Sales"
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        value={named}
        onChange={(next) => go({ sales: hasMe ? [SALES_ME, ...next] : next })}
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
      <FacetSelect label="Lokasi" options={locations.map((location) => ({ value: location, label: location }))} value={view.location} onChange={(next) => go({ location: next })} />
      <FacetSelect label="Jenis" options={types.map((type) => ({ value: type, label: type }))} value={view.type} onChange={(next) => go({ type: next })} />
      {narrowed && (
        <button
          type="button"
          onClick={() => go({ sales: [], location: [], type: [] })}
          className="inline-flex min-h-10 shrink-0 items-center px-1 text-xs font-semibold text-primary hover:underline md:min-h-9"
        >
          Bersihkan semua
        </button>
      )}
    </nav>
  )
}
