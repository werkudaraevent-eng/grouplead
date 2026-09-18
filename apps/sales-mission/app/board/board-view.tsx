import type { BoardMission, BoardSnapshot, BoardTeamMember } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"
import { AutoScroll } from "./auto-scroll"
import { BoardClock } from "./board-clock"

/**
 * The wall board.
 *
 * Built like a departures board, not a dashboard. One table fills the screen:
 * a slim bar carries the unit, the summary sentence, the date and the clock,
 * and everything below it is the schedule under its column headings — Jam,
 * Klien, Lokasi, Sales, Status — on a single surface, rows separated by
 * hairlines rather than floated as cards. The time sits first in every row in
 * large tabular figures, the status is a word, and the only accent on the
 * screen marks the visit happening now, tinted in its place in the list.
 *
 * Rows that are done or past step down in tone, not opacity, so the first
 * full-contrast row is the next visit — how a departures board says "next"
 * without a label. Everything is an `em` of one root size that follows the
 * screen (`.board-root` in globals.css), so 1080p, 4K and a portrait panel
 * show the same composition.
 */

/**
 * One margin for the whole screen: the bar at the top, the column headings and
 * every row start on the same line, and the team column ends on the same line
 * at the other edge.
 */
const EDGE = "px-[1.6em]"

/**
 * Header and rows share this so the columns line up; portrait drops Lokasi.
 * Klien takes twice the share of the other two: it is the one thing on a row
 * that identifies the visit, and truncating it to widen a half-empty Lokasi
 * column is the wrong trade at four metres.
 */
const COLUMNS =
  "grid grid-cols-[6.5em_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_9.5em] portrait:grid-cols-[5.5em_minmax(0,1.8fr)_minmax(0,1fr)_8em] items-center gap-x-[1.2em] " + EDGE

/** One baseline rhythm, shared by the schedule and the team column. */
const ROW_HEIGHT = "3.8em"

type VisitState = "past" | "now" | "later"
type RowTone = "normal" | "past" | "now"

/**
 * Colour is a role, not a hue per status. Everything routine takes the row's
 * own ink; only an exception is coloured, the way a FIDS colours a delay.
 */
const STATUS_ROLE: Record<string, "muted" | "strong" | "primary"> = {
  SCHEDULED: "muted",
  ASSIGNED: "muted",
  ACCEPTED: "strong",
  IN_PROGRESS: "primary",
  COMPLETED: "muted",
  RESCHEDULE_REQUESTED: "muted",
}

const ROW_INK: Record<RowTone, { fg: string; muted: string }> = {
  normal: { fg: "var(--board-on-surface)", muted: "var(--board-on-surface-variant)" },
  past: { fg: "var(--board-on-surface-dim)", muted: "var(--board-on-surface-dim)" },
  now: { fg: "var(--board-on-primary-container)", muted: "var(--board-primary)" },
}

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

/** Cancelled and refused visits never reach here (OFF_THE_BOARD), so done means done. */
const isOver = (mission: BoardMission) => mission.status === "COMPLETED"

function ColumnHeader() {
  const label = "text-[0.85em] font-medium tracking-[0.04em] text-[var(--board-on-surface-variant)]"
  return (
    <div className={cn(COLUMNS, "shrink-0 border-b border-[var(--board-outline)] pb-[0.5em] pt-[0.2em]")}>
      <span className={label}>Jam</span>
      <span className={label}>Klien</span>
      <span className={cn(label, "portrait:hidden")}>Lokasi</span>
      <span className={label}>Sales</span>
      <span className={label}>Status</span>
    </div>
  )
}

function StatusCell({ status, tone }: { status: string; tone: RowTone }) {
  const role = STATUS_ROLE[status] ?? "muted"
  const colour =
    tone === "now"
      ? "text-[var(--board-on-primary-container)]"
      : role === "primary"
        ? "text-[var(--board-primary)]"
        : role === "strong"
          ? "text-[var(--row-fg)]"
          : "text-[var(--row-muted)]"
  return (
    <span className="min-w-0">
      {tone === "now" && (
        <span className="flex items-center gap-[0.45em] text-[0.85em] font-semibold tracking-[0.06em] text-[var(--board-tertiary)]">
          <span aria-hidden="true" className="board-pulse h-[0.6em] w-[0.6em] rounded-full bg-[var(--board-tertiary)]" />
          Sekarang
        </span>
      )}
      <span className={cn("block truncate text-[1.25em] font-medium leading-tight", colour)}>{statusLabel(status)}</span>
    </span>
  )
}

function VisitRow({ mission, tone }: { mission: BoardMission; tone: RowTone }) {
  const ink = ROW_INK[tone]
  const people = [
    mission.primarySalesName,
    mission.supportingSalesNames.length > 0 ? `+${mission.supportingSalesNames.length}` : null,
  ].filter(Boolean).join(" ")
  return (
    <li
      className={cn(
        COLUMNS,
        "relative border-b border-[var(--board-outline-variant)] py-[0.55em] text-[var(--row-fg)]",
        tone === "now" && "bg-[var(--board-primary-container)]"
      )}
      style={{ "--row-fg": ink.fg, "--row-muted": ink.muted, minHeight: ROW_HEIGHT } as React.CSSProperties}
    >
      {tone === "now" && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[0.35em] bg-[var(--board-tertiary)]" />}
      <span className="text-[2.3em] font-semibold tabular-nums leading-none tracking-[-0.01em]">{mission.time ?? "—"}</span>
      <span className="min-w-0">
        <span className="block truncate text-[1.8em] font-medium leading-[1.15]">{mission.clientLabel}</span>
        {/* Portrait has no room for a Lokasi column, so the location moves under the name. */}
        {mission.location && <span className="hidden truncate text-[1.1em] text-[var(--row-muted)] portrait:block">{mission.location}</span>}
      </span>
      <span className="truncate text-[1.25em] text-[var(--row-muted)] portrait:hidden">{mission.location || mission.missionType}</span>
      <span className="truncate text-[1.25em] text-[var(--row-muted)]">{people || "—"}</span>
      <StatusCell status={mission.status} tone={tone} />
    </li>
  )
}

function DayHeading({ label, isToday, count }: { label: string; isToday: boolean; count: number }) {
  return (
    <li className={cn("flex items-baseline justify-between gap-[1em] bg-[var(--board-surface-container-low)] py-[0.5em]", EDGE)}>
      <span className={cn("text-[1.1em] font-medium", isToday ? "text-[var(--board-primary)]" : "text-[var(--board-on-surface)]")}>
        {isToday ? `Hari ini · ${label}` : label}
      </span>
      <span className="text-[1em] text-[var(--board-on-surface-variant)]">{count > 0 ? `${count} kunjungan` : "Tidak ada kunjungan"}</span>
    </li>
  )
}

function TeamRow({ member }: { member: BoardTeamMember }) {
  return (
    <li
      style={{ minHeight: ROW_HEIGHT }}
      className={cn("flex items-center gap-[0.8em] border-b border-[var(--board-outline-variant)] py-[0.7em]", EDGE)}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.25em] font-medium leading-tight">{member.name}</span>
        <span className="mt-[0.15em] block truncate text-[1em] text-[var(--board-on-surface-variant)]">
          {member.next ? (
            <>
              {member.next.day && `${member.next.day} `}
              <span className="font-medium tabular-nums text-[var(--board-on-surface)]">{member.next.time}</span>
              {" · "}
              {member.next.client}
            </>
          ) : (
            "Tidak ada jadwal lagi"
          )}
        </span>
      </span>
      <span className="shrink-0 text-[1em] font-medium tabular-nums text-[var(--board-on-surface-variant)]">{member.missionCount}</span>
    </li>
  )
}

function EmptyRows({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-[2em] text-center">
      <p className="text-[1.5em] text-[var(--board-on-surface-variant)]">{title}</p>
      {hint && <p className="mt-[0.4em] max-w-[24em] text-[1em] text-[var(--board-on-surface-dim)]">{hint}</p>}
    </div>
  )
}

/**
 * The rest of the board, ruled.
 *
 * A departures board with four departures does not stop halfway down the wall
 * and leave a void: the ruling carries on to the bottom, which is how the
 * emptiness reads as "nothing more today" rather than as a broken screen. The
 * lines are painted rather than rendered as rows, so they cost nothing and can
 * never be mistaken for entries.
 */
function Ruled({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("min-h-0 flex-1", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0, transparent calc(" +
          ROW_HEIGHT +
          " - 1px), var(--board-outline-variant) calc(" +
          ROW_HEIGHT +
          " - 1px), var(--board-outline-variant) " +
          ROW_HEIGHT +
          ")",
      }}
    />
  )
}

/** A panel body that fills its region: what there is, then ruling to the bottom. */
function RuledBody({ empty, children }: { empty?: React.ReactNode; children?: React.ReactNode }) {
  if (empty) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Ruled />
        <div className="absolute inset-0">{empty}</div>
      </div>
    )
  }
  return (
    <div className="flex min-h-full flex-col">
      <div className="shrink-0">{children}</div>
      <Ruled />
    </div>
  )
}

function TopBar({
  screenLabel,
  summary,
  dateLabel,
  clock,
  preview,
  masked,
}: {
  screenLabel: string | null
  summary: string | null
  dateLabel: string
  clock: string
  preview: boolean
  masked: boolean
}) {
  return (
    <header className={cn("flex flex-wrap items-center gap-x-[1.6em] gap-y-[0.3em] bg-[var(--board-surface-container)] py-[1em]", EDGE)}>
      <p className="text-[1.1em] font-medium">
        Sales Activity
        {screenLabel && <span className="text-[var(--board-on-surface-variant)]"> · {screenLabel}</span>}
      </p>
      {summary && <p className="min-w-0 flex-1 truncate text-[1em] text-[var(--board-on-surface-variant)]">{summary}</p>}
      <div className="ml-auto flex items-center gap-[1.2em]">
        {/* Plain text, not a pill: a chip is an interactive component in M3, and
            nothing on a wall can be pressed. */}
        {preview && (
          <p className="text-[0.85em] text-[var(--board-on-surface-dim)]">
            Pratinjau · nama klien {masked ? "disamarkan" : "ditampilkan"}
          </p>
        )}
        <p className="text-[1em] text-[var(--board-on-surface-variant)]">{dateLabel}</p>
        {/* Modest on purpose: nobody looks at a wall to learn the time. */}
        <BoardClock initial={clock} className="text-[1.4em] font-medium tabular-nums leading-none" />
      </div>
    </header>
  )
}

export function BoardView({
  snapshot,
  now,
  panels,
  preview,
  masked,
  screenLabel,
}: {
  snapshot: BoardSnapshot
  now: Date
  panels: BoardPanel[]
  /** A signed-in admin looking, not a screen on a wall: say so, and say what is masked. */
  preview: boolean
  masked: boolean
  /** The screen's name as the admin labelled its link, if any. */
  screenLabel: string | null
}) {
  const dateLabel = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)
  const clock = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(now)
  const show = (panel: BoardPanel) => panels.includes(panel)
  const week = snapshot.range === "week"
  const nowMinute = minuteOfDay(now)

  const stateOf = (mission: BoardMission): VisitState => {
    if (mission.day < snapshot.today) return "past"
    if (mission.day > snapshot.today) return "later"
    if (mission.startMinute <= nowMinute && nowMinute < mission.endMinute) return "now"
    return mission.endMinute <= nowMinute ? "past" : "later"
  }
  // The one row the room should look at: the visit happening now. Marked where
  // it sits, not lifted out of the list. There is no "next" treatment: past
  // rows are dimmed, so the first full-contrast row already is the next one.
  const ongoing = snapshot.missions.find((mission) => stateOf(mission) === "now" && !isOver(mission))
  const toneOf = (mission: BoardMission): RowTone => {
    if (mission.id === ongoing?.id) return "now"
    return isOver(mission) || stateOf(mission) === "past" ? "past" : "normal"
  }

  // The agenda: today onward. On the week board yesterday is history and the
  // wall has no room for it.
  const days = snapshot.days.filter((day) => day.date >= snapshot.today)
  const visits = days.reduce((sum, day) => sum + day.missions.length, 0)
  const peopleOut = snapshot.team.length
  const summary = [
    `${visits} kunjungan ${week ? "minggu ini" : "hari ini"}`,
    peopleOut > 0 ? `${peopleOut} orang di lapangan` : null,
    snapshot.counts.completed > 0 ? `${snapshot.counts.completed} selesai` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[var(--board-surface)] text-[var(--board-on-surface)]">
      <TopBar
        screenLabel={screenLabel}
        summary={show("counts") ? summary : null}
        dateLabel={dateLabel}
        clock={clock}
        preview={preview}
        masked={masked}
      />

      <div
        className={cn(
          "grid min-h-0",
          show("schedule") && show("team")
            ? "grid-cols-[minmax(0,1fr)_22em] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1fr)_18em]"
            : "grid-cols-1"
        )}
      >
        {show("schedule") && (
          <section className="flex min-h-0 min-w-0 flex-col pt-[0.8em]">
            <ColumnHeader />
            {visits === 0 ? (
              <RuledBody
                empty={
                  <EmptyRows
                    title={week ? "Tidak ada kunjungan minggu ini." : "Tidak ada kunjungan hari ini."}
                    hint="Kunjungan yang dijadwalkan tampil di sini, urut jam."
                  />
                }
              />
            ) : (
              <AutoScroll id={`schedule-${snapshot.range}`}>
                <RuledBody>
                  <ul>
                    {week
                      ? days.flatMap((day) => [
                          <DayHeading key={`day-${day.date}`} label={day.label} isToday={day.isToday} count={day.missions.length} />,
                          ...day.missions.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />),
                        ])
                      : snapshot.missions.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />)}
                  </ul>
                </RuledBody>
              </AutoScroll>
            )}
          </section>
        )}

        {show("team") && (
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-col pt-[0.8em]",
              show("schedule") && "border-l border-[var(--board-outline-variant)] portrait:border-l-0 portrait:border-t"
            )}
          >
            <div className={cn("flex shrink-0 items-baseline justify-between gap-[1em] border-b border-[var(--board-outline)] pb-[0.5em] pt-[0.2em]", EDGE)}>
              <span className="text-[0.85em] font-medium tracking-[0.04em] text-[var(--board-on-surface-variant)]">Tim di lapangan</span>
              <span className="text-[0.85em] tracking-[0.04em] text-[var(--board-on-surface-variant)]">{snapshot.team.length} orang</span>
            </div>
            {snapshot.team.length > 0 ? (
              <AutoScroll id="team">
                <RuledBody>
                  <ul>
                    {snapshot.team.map((member) => <TeamRow key={member.name} member={member} />)}
                  </ul>
                </RuledBody>
              </AutoScroll>
            ) : (
              <RuledBody empty={<EmptyRows title={week ? "Belum ada yang bertugas minggu ini." : "Belum ada yang bertugas hari ini."} />} />
            )}
          </section>
        )}
      </div>
    </div>
  )
}
