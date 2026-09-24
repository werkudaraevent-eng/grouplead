import Link from "next/link"
import { CalendarDays } from "@/components/icons"
import { PersonAvatar } from "@/components/person-avatar"
import { groupDayMissions, type CalendarGroup } from "@/lib/missions/calendar-filter"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"

/**
 * One day's visits, beside the month grid.
 *
 * The same four facts on both calendars — time, client, where, who — because
 * that is what someone asks a calendar. Who is also a face: the primary
 * sales' avatar trails the row (M3 list item with a trailing avatar; Google
 * Calendar's schedule view, Linear and Asana put the assignee at the end of
 * the row), with the name still in words underneath, so the pane reads at
 * a glance without losing the text. The list can be grouped by location or
 * by person: an M3 list subheader per group with its count, the grouped
 * fact dropped from each row since the header already says it. What
 * differs between the calendars is whether a row goes anywhere: signed in it
 * opens the activity and carries the viewer's join state; on the public
 * calendar there is nothing to open and no viewer, so the row is a plain
 * entry. Passing the link in rather than branching inside keeps the two
 * pages honestly identical everywhere else.
 */
export function DayPane<T extends MissionListItem>({
  dayLabel,
  title,
  missions,
  now,
  action,
  tools,
  people = [],
  group = "none",
  itemHref,
  itemExtra,
  emptyText = "Tidak ada aktivitas pada hari ini",
}: {
  dayLabel: string
  title: string
  missions: T[]
  now: Date
  action?: React.ReactNode
  /** Controls about how the list is shown (the grouping menu), beside the action. */
  tools?: React.ReactNode
  /** Faces for the primary sales of each row, by user id. */
  people?: Array<{ id: string; name: string; avatarUrl: string | null }>
  group?: CalendarGroup
  itemHref?: (mission: T) => string
  itemExtra?: (mission: T) => React.ReactNode
  emptyText?: string
}) {
  const avatars = new Map(people.map((person) => [person.id, person.avatarUrl]))
  const sections = groupDayMissions(missions, group)
  return (
    <aside className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{dayLabel}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
        </div>
        {(action || tools) && (
          <div className="flex shrink-0 items-center gap-1">
            {tools}
            {action}
          </div>
        )}
      </div>

      {missions.length > 0 ? (
        // A scroll box only where the card has a height to fill. On a phone the
        // card grows with its list and the page scrolls; a scroll container that
        // cannot scroll would still swallow the touch with overscroll-contain.
        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain">
          {sections.map((section) => (
            <div key={section.key} className="divide-y border-b last:border-b-0">
              {section.label && (
                <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-card px-5 pb-1.5 pt-3 text-xs font-semibold text-muted-foreground">
                  <span className="truncate">{section.label}</span>
                  <span className="shrink-0 font-normal tabular-nums">{section.missions.length}</span>
                </div>
              )}
              {section.missions.map((mission) => {
                const secondary = [group === "location" ? null : mission.location, group === "sales" ? null : mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType
                const body = (
                  <>
                    <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatMissionSchedule(mission.scheduledStart, now).split(", ").pop()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                      {itemExtra?.(mission)}
                    </span>
                    {mission.primarySalesName && (
                      <PersonAvatar
                        name={mission.primarySalesName}
                        avatarUrl={mission.primarySalesId ? (avatars.get(mission.primarySalesId) ?? null) : null}
                        size="sm"
                        className="self-center"
                      />
                    )}
                  </>
                )
                return itemHref ? (
                  <Link key={mission.id} href={itemHref(mission)} className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                    {body}
                  </Link>
                ) : (
                  <div key={mission.id} className="flex gap-3 px-5 py-4">
                    {body}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {emptyText}
        </div>
      )}
    </aside>
  )
}
