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

/** Header and rows share this so the columns line up; portrait drops Lokasi. */
const COLUMNS =
  "grid grid-cols-[6.5em_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_10em] portrait:grid-cols-[5.5em_minmax(0,1.4fr)_minmax(0,1fr)_8em] items-center gap-x-[1.2em] px-[1.4em]"

type VisitState = "past" | "now" | "later"
type RowTone = "normal" | "past" | "now"

/**
 * Colour is a role, not a hue per status. Everything routine takes the row's
 * own ink; only an exception is coloured, the way a FIDS colours a delay.
 */
const STATUS_ROLE: Record<string, "muted" | "strong" | "primary" | "error"> = {
  SCHEDULED: "muted",
  ASSIGNED: "muted",
  ACCEPTED: "strong",
  IN_PROGRESS: "primary",
  COMPLETED: "muted",
  CANCELLED: "error",
  REJECTED: "error",
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

const isOver = (mission: BoardMission) => mission.status === "COMPLETED" || mission.status === "CANCELLED" || mission.status === "REJECTED"

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
      : role === "error"
        ? "text-[var(--board-error)]"
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
      style={{ "--row-fg": ink.fg, "--row-muted": ink.muted } as React.CSSProperties}
      className={cn(
        COLUMNS,
        "relative min-h-[3.8em] border-b border-[var(--board-outline-variant)] py-[0.55em] text-[var(--row-fg)]",
        tone === "now" && "bg-[var(--board-primary-container)]"
      )}
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
    <li className="flex items-baseline justify-between gap-[1em] bg-[var(--board-surface-container-low)] px-[1.4em] py-[0.5em]">
      <span className={cn("text-[1.1em] font-medium", isToday ? "text-[var(--board-primary)]" : "text-[var(--board-on-surface)]")}>
        {isToday ? `Hari ini · ${label}` : label}
      </span>
      <span className="text-[1em] text-[var(--board-on-surface-variant)]">{count > 0 ? `${count} kunjungan` : "Tidak ada kunjungan"}</span>
    </li>
  )
}

function TeamRow({ member }: { member: BoardTeamMember }) {
  return (
    <li className="flex items-center gap-[0.8em] border-b border-[var(--board-outline-variant)] px-[1.4em] py-[0.7em] last:border-0">
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
    <header className="flex flex-wrap items-center gap-x-[1.6em] gap-y-[0.3em] bg-[var(--board-surface-container)] px-[2.4em] py-[1em]">
      <p className="text-[1.1em] font-medium">
        Sales Activity
        {screenLabel && <span className="text-[var(--board-on-surface-variant)]"> · {screenLabel}</span>}
      </p>
      {summary && <p className="min-w-0 flex-1 truncate text-[1em] text-[var(--board-on-surface-variant)]">{summary}</p>}
      <div className="ml-auto flex items-center gap-[1.2em]">
        {preview && (
          <span className="rounded-full bg-[var(--board-surface-container-high)] px-[0.9em] py-[0.3em] text-[0.8em] font-medium text-[var(--board-on-surface-variant)]">
            Pratinjau · nama klien {masked ? "disamarkan" : "ditampilkan"}
          </span>
        )}
        <p className="text-[1em] text-[var(--board-on-surface-variant)]">{dateLabel}</p>
        <BoardClock initial={clock} className="text-[2em] font-medium tabular-nums leading-none tracking-[-0.01em]" />
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
              <EmptyRows
                title={week ? "Tidak ada kunjungan minggu ini." : "Tidak ada kunjungan hari ini."}
                hint="Kunjungan yang dijadwalkan tampil di sini, urut jam."
              />
            ) : (
              <AutoScroll id={`schedule-${snapshot.range}`}>
                <ul>
                  {week
                    ? days.flatMap((day) => [
                        <DayHeading key={`day-${day.date}`} label={day.label} isToday={day.isToday} count={day.missions.length} />,
                        ...day.missions.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />),
                      ])
                    : snapshot.missions.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />)}
                </ul>
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
            <div className="flex shrink-0 items-baseline justify-between gap-[1em] border-b border-[var(--board-outline)] px-[1.4em] pb-[0.5em] pt-[0.2em]">
              <span className="text-[0.85em] font-medium tracking-[0.04em] text-[var(--board-on-surface-variant)]">Tim di lapangan</span>
              <span className="text-[0.85em] tracking-[0.04em] text-[var(--board-on-surface-variant)]">{snapshot.team.length} orang</span>
            </div>
            {snapshot.team.length > 0 ? (
              <AutoScroll id="team">
                <ul>
                  {snapshot.team.map((member) => <TeamRow key={member.name} member={member} />)}
                </ul>
              </AutoScroll>
            ) : (
              <EmptyRows title={week ? "Belum ada yang bertugas minggu ini." : "Belum ada yang bertugas hari ini."} />
            )}
          </section>
        )}
      </div>
    </div>
  )
}
