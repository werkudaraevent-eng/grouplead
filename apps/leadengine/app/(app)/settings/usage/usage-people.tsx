import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { lastSeenLabel, lastSeenStamp, TREND_WEEKS, type PersonUsage } from "@/lib/usage/usage-stats"
import { usagePageLabel } from "@/lib/usage/usage-path"
import { cn } from "@/lib/utils"

/**
 * People: everyone who can use LeadEngine, most recently seen first. A
 * table on a desk, a card per person on a phone, where a six-column table
 * would need a sideways scroll. Nothing links: a person's usage is these
 * four numbers, not a trail.
 */

const number = new Intl.NumberFormat("en-US")

/** Days active per week as one quiet line, on a fixed 0–7 scale so rows compare. */
export function UsageTrend({ weekly, className }: { weekly: number[]; className?: string }) {
  if (weekly.every((value) => value === 0)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>
  }
  const width = 64
  const height = 20
  const step = width / Math.max(1, weekly.length - 1)
  const y = (value: number) => (height - 2 - (Math.min(value, 7) / 7) * (height - 4)).toFixed(1)
  const points = weekly.map((value, index) => `${(index * step).toFixed(1)},${y(value)}`)
  const area = `M0,${height} L${points.join(" L")} L${width},${height} Z`
  const last = weekly[weekly.length - 1]
  const label = `Days active per week, last ${TREND_WEEKS} weeks: ${weekly.join(", ")}. This week ${last} ${last === 1 ? "day" : "days"}.`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className={cn("shrink-0 overflow-visible text-primary", className)}>
      <title>{label}</title>
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(last)} r="2" fill="currentColor" />
    </svg>
  )
}

/** The window a column counts over, under its name and in sentence case. */
function Window({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] font-medium normal-case tracking-normal">{children}</span>
}

/** A muted mark, not a status colour: not coming in is a fact to notice, not an alarm. */
function IdleChip() {
  return <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Inactive 7 days</span>
}

function LastSeen({ person, now }: { person: PersonUsage; now: Date }) {
  if (!person.lastSeenAt) return <span className="text-muted-foreground">Never</span>
  return (
    <span className={person.state === "idle" ? "text-muted-foreground" : "text-foreground"} title={lastSeenStamp(person.lastSeenAt)}>
      {lastSeenLabel(person.lastSeenAt, now)}
    </span>
  )
}

export function UsagePeople({ people, now }: { people: PersonUsage[]; now: Date }) {
  if (people.length === 0) {
    return <p className="px-5 py-6 text-[13px] text-muted-foreground">Nobody has LeadEngine access yet.</p>
  }

  return (
    <>
      <ul className="divide-y divide-border md:hidden">
        {people.map((person) => (
          <li key={person.id} className="flex items-start gap-3 px-4 py-3">
            <InitialsAvatar name={person.name} src={person.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">{person.name}</span>
                {person.state === "idle" && <IdleChip />}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <LastSeen person={person} now={now} />
                {person.lastPath && <> · {usagePageLabel(person.lastPath)}</>}
              </p>
              {person.state !== "never" && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 text-xs text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">{number.format(person.daysActive30)}</span> days active (30 days) ·{" "}
                    <span className="font-medium tabular-nums text-foreground">{number.format(person.views7)}</span> pages opened (7 days)
                  </p>
                  <UsageTrend weekly={person.weekly} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        {/* Scrolls inside the card, never the page, if a wide drawer leaves the table short of room. */}
        <div className="overflow-x-auto thin-scrollbar">
          <Table className="min-w-[680px] table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="hidden w-[210px] xl:table-column" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="text-right" title="How many different days this person opened LeadEngine">
                  Days active<Window>30 days</Window>
                </TableHead>
                <TableHead className="text-right" title="How many pages this person opened">
                  Pages opened<Window>7 days</Window>
                </TableHead>
                <TableHead title="Days active per week">
                  Trend<Window>{TREND_WEEKS} weeks</Window>
                </TableHead>
                <TableHead className="hidden xl:table-cell">Last page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const lastPage = person.lastPath ? usagePageLabel(person.lastPath) : null
                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <InitialsAvatar name={person.name} src={person.avatarUrl} size="sm" />
                        <span className="min-w-0 truncate font-medium text-foreground" title={person.name}>
                          {person.name}
                        </span>
                        {person.state === "idle" && <IdleChip />}
                      </span>
                    </TableCell>
                    <TableCell className="truncate">
                      <LastSeen person={person} now={now} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.state === "never" ? <span className="text-muted-foreground">—</span> : number.format(person.daysActive30)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.state === "never" ? <span className="text-muted-foreground">—</span> : number.format(person.views7)}
                    </TableCell>
                    <TableCell>
                      <UsageTrend weekly={person.weekly} />
                    </TableCell>
                    <TableCell className="hidden truncate xl:table-cell">
                      {lastPage ? <span title={lastPage}>{lastPage}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
