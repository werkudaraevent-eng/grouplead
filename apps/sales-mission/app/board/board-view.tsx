import { Check, Clock3, MapPin, Users } from "lucide-react"
import type { BoardMission, BoardSnapshot, BoardTeamMember } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"
import { AutoScroll } from "./auto-scroll"
import { BoardClock } from "./board-clock"

/**
 * The wall board, M3 Expressive on a dark tonal scheme.
 *
 * The screen has one focal point, the spotlight: the visit happening now, else
 * the next one with a countdown, else a done state. Around it sit the day's
 * progress, the schedule as a timeline and the team with identity avatars.
 * Structure comes from tonal surfaces and extra-large shapes, not borders.
 * Every size is an `em` of `.board-root`, so 1080p, 4K and portrait keep the
 * same composition.
 */

const CARD = "rounded-[1.6em] bg-[var(--board-surface-container-low)]"
const ROW_COLUMNS = "grid grid-cols-[5.2em_minmax(0,2fr)_minmax(0,1.1fr)_8.5em] portrait:grid-cols-[4.6em_minmax(0,2fr)_7.5em] items-center gap-x-[1.1em]"

type VisitState = "past" | "now" | "later"
type RowTone = "normal" | "past" | "now"

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

const clockOf = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}.${String(minute % 60).padStart(2, "0")}`

function countdown(minutes: number): string {
  if (minutes < 1) return "sebentar lagi"
  if (minutes < 60) return `dalam ${minutes} menit`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `dalam ${hours} jam ${rest} menit` : `dalam ${hours} jam`
}

/** Cancelled and refused visits never reach here (OFF_THE_BOARD), so done means done. */
const isOver = (mission: BoardMission) => mission.status === "COMPLETED"

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?"
}

function avatarHue(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (hash % 6) + 1
}

function Avatar({ name, size = "2.4em", ring }: { name: string; size?: string; ring?: string }) {
  const hue = avatarHue(name)
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold leading-none"
      style={{
        width: size,
        height: size,
        fontSize: "1em",
        background: `var(--board-avatar-${hue})`,
        color: `var(--board-on-avatar-${hue})`,
        boxShadow: ring ? `0 0 0 0.18em ${ring}` : undefined,
      }}
    >
      <span className="text-[0.9em]">{initials(name)}</span>
    </span>
  )
}

function peopleOf(mission: BoardMission): string[] {
  return [mission.primarySalesName, ...mission.supportingSalesNames].filter((name): name is string => Boolean(name))
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[0.95em] font-medium tracking-[0.02em]", className)}>{children}</p>
}

/* ── Top bar ── */

function TopBar({ screenLabel, dateLabel, clock, preview, masked }: { screenLabel: string | null; dateLabel: string; clock: string; preview: boolean; masked: boolean }) {
  return (
    <header className="flex items-end justify-between gap-[2em]">
      <div className="min-w-0">
        <Eyebrow className="text-[var(--board-primary)]">
          Sales Activity
          {screenLabel && <span className="text-[var(--board-on-surface-variant)]"> · {screenLabel}</span>}
        </Eyebrow>
        <h1 className="mt-[0.15em] truncate text-[2.1em] font-semibold leading-tight tracking-[-0.01em]">{dateLabel}</h1>
      </div>
      <div className="flex shrink-0 items-end gap-[1.4em]">
        {preview && <p className="mb-[0.5em] text-[0.85em] text-[var(--board-on-surface-dim)]">Pratinjau · nama klien {masked ? "disamarkan" : "ditampilkan"}</p>}
        <BoardClock initial={clock} className="text-[3.4em] font-semibold tabular-nums leading-none tracking-[-0.02em]" />
      </div>
    </header>
  )
}

/* ── Spotlight ── */

type Spotlight = { kind: "now"; mission: BoardMission } | { kind: "next"; mission: BoardMission; when: string } | { kind: "done"; completed: number } | { kind: "empty" }

function SpotlightCard({ spotlight, week }: { spotlight: Spotlight; week: boolean }) {
  if (spotlight.kind === "empty" || spotlight.kind === "done") {
    const done = spotlight.kind === "done"
    return (
      <section
        className={cn("flex items-center gap-[1.4em] rounded-[1.6em] px-[1.8em] py-[1.5em]", !done && "flex-1 justify-center")}
        style={{
          background: done ? "var(--board-success-container)" : "var(--board-surface-container)",
        }}
      >
        <span
          className="grid h-[3.4em] w-[3.4em] shrink-0 place-items-center rounded-full"
          style={{
            background: done ? "var(--board-success)" : "var(--board-surface-container-highest)",
            color: done ? "var(--board-success-container)" : "var(--board-on-surface-variant)",
          }}
        >
          {done ? <Check className="h-[1.8em] w-[1.8em]" strokeWidth={2.6} /> : <Clock3 className="h-[1.6em] w-[1.6em]" />}
        </span>
        <div className="min-w-0">
          <p className="text-[2em] font-semibold leading-tight">
            {done
              ? spotlight.completed === 1
                ? "Kunjungan sudah selesai"
                : `Semua ${spotlight.completed} kunjungan selesai`
              : week
                ? "Tidak ada kunjungan minggu ini"
                : "Tidak ada kunjungan hari ini"}
          </p>
          <p className="mt-[0.2em] text-[1.15em] text-[var(--board-on-surface-variant)]">
            {done ? "Kerja bagus, tim. Jadwal berikutnya akan muncul di sini." : "Kunjungan yang dijadwalkan akan muncul di sini, urut jam."}
          </p>
        </div>
      </section>
    )
  }

  const { mission } = spotlight
  const live = spotlight.kind === "now"
  const people = peopleOf(mission)
  return (
    <section
      className="relative overflow-hidden rounded-[1.6em] px-[1.8em] py-[1.4em]"
      style={{
        background: live ? "var(--board-primary-container)" : "var(--board-surface-container-high)",
        color: live ? "var(--board-on-primary-container)" : "var(--board-on-surface)",
      }}
    >
      <div className="flex items-center gap-[0.6em]">
        {live ? (
          <span className="board-ring h-[0.75em] w-[0.75em] rounded-full bg-[var(--board-tertiary)]" aria-hidden="true" />
        ) : (
          <Clock3 aria-hidden="true" className="h-[1.1em] w-[1.1em] text-[var(--board-primary)]" />
        )}
        <Eyebrow className={live ? "text-[var(--board-tertiary)]" : "text-[var(--board-primary)]"}>
          {live ? "Sedang berlangsung" : `Berikutnya · ${spotlight.when}`}
        </Eyebrow>
      </div>

      <div className="mt-[0.7em] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-[1.4em]">
        <div className="tabular-nums leading-none">
          <p className="text-[4em] font-semibold tracking-[-0.03em]">{mission.time ?? "—"}</p>
          {mission.time && (
            <p className={cn("mt-[0.3em] text-[1.1em] font-medium", live ? "text-[var(--board-primary)]" : "text-[var(--board-on-surface-variant)]")}>
              s.d. {clockOf(mission.endMinute)}
            </p>
          )}
        </div>
        <div
          className="min-w-0 border-l-[0.12em] pl-[1.4em]"
          style={{
            borderColor: live ? "color-mix(in srgb, var(--board-on-primary-container) 25%, transparent)" : "var(--board-outline-variant)",
          }}
        >
          <p className="truncate text-[2.6em] font-semibold leading-[1.1] tracking-[-0.01em]">{mission.clientLabel}</p>
          <div
            className={cn(
              "mt-[0.45em] flex flex-wrap items-center gap-x-[1.4em] gap-y-[0.3em] text-[1.2em]",
              live ? "text-[var(--board-on-primary-container)]" : "text-[var(--board-on-surface-variant)]"
            )}
          >
            {mission.location && (
              <span className="flex min-w-0 items-center gap-[0.35em]">
                <MapPin aria-hidden="true" className="h-[1em] w-[1em] shrink-0 opacity-80" />
                <span className="truncate">{mission.location}</span>
              </span>
            )}
            {people.length > 0 && (
              <span className="flex min-w-0 items-center gap-[0.35em]">
                <Users aria-hidden="true" className="h-[1em] w-[1em] shrink-0 opacity-80" />
                <span className="truncate">{people.join(", ")}</span>
              </span>
            )}
          </div>
        </div>
        {people.length > 0 && (
          <div className="flex -space-x-[0.6em] portrait:hidden">
            {people.slice(0, 3).map((name) => (
              <Avatar key={name} name={name} size="3.4em" ring={live ? "var(--board-primary-container)" : "var(--board-surface-container-high)"} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Progress ── */

function StatsCard({ total, completed, live, peopleOut, week }: { total: number; completed: number; live: number; peopleOut: number; week: boolean }) {
  const ratio = total > 0 ? completed / total : 0
  const stats = [
    { label: "Kunjungan", value: total },
    { label: "Berjalan", value: live },
    { label: "Di lapangan", value: peopleOut },
  ]
  return (
    <section className={cn(CARD, "px-[1.5em] py-[1.3em]")}>
      <Eyebrow className="text-[var(--board-on-surface-variant)]">{week ? "Progres minggu ini" : "Progres hari ini"}</Eyebrow>
      <div className="mt-[0.4em] flex items-baseline gap-[0.4em] tabular-nums">
        <span className="text-[3.2em] font-semibold leading-none tracking-[-0.02em]">{completed}</span>
        <span className="text-[1.4em] font-medium text-[var(--board-on-surface-variant)]">/ {total} selesai</span>
      </div>
      <div
        className="mt-[0.9em] h-[0.6em] overflow-hidden rounded-full bg-[var(--board-surface-container-highest)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <div className="h-full rounded-full bg-[var(--board-success)]" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <dl className="mt-[1.1em] grid grid-cols-3 gap-[0.6em]">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1em] bg-[var(--board-surface-container)] px-[0.9em] py-[0.7em]">
            <dd className="text-[1.9em] font-semibold tabular-nums leading-none">{stat.value}</dd>
            <dt className="mt-[0.35em] truncate text-[0.9em] text-[var(--board-on-surface-variant)]">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── Schedule ── */

function StatusCell({ status, tone }: { status: string; tone: RowTone }) {
  if (tone === "now") {
    return (
      <span className="flex items-center gap-[0.5em] text-[1.15em] font-semibold text-[var(--board-tertiary)]">
        <span aria-hidden="true" className="board-pulse h-[0.6em] w-[0.6em] shrink-0 rounded-full bg-[var(--board-tertiary)]" />
        Sekarang
      </span>
    )
  }
  if (status === "COMPLETED") {
    return (
      <span className="flex items-center gap-[0.45em] text-[1.15em] font-medium text-[var(--board-success)]">
        <Check aria-hidden="true" className="h-[1em] w-[1em] shrink-0" strokeWidth={2.6} />
        Selesai
      </span>
    )
  }
  const dot = status === "IN_PROGRESS" ? "var(--board-tertiary)" : status === "ACCEPTED" ? "var(--board-primary)" : "var(--board-on-surface-dim)"
  return (
    <span
      className="flex min-w-0 items-center gap-[0.5em] text-[1.15em] font-medium"
      style={{
        color: tone === "past" ? "var(--board-on-surface-dim)" : "var(--board-on-surface-variant)",
      }}
    >
      <span aria-hidden="true" className="h-[0.55em] w-[0.55em] shrink-0 rounded-full" style={{ background: dot }} />
      <span className="truncate">{statusLabel(status)}</span>
    </span>
  )
}

function TimelineNode({ tone, done }: { tone: RowTone; done: boolean }) {
  if (tone === "now") return <span className="board-ring relative z-10 h-[0.9em] w-[0.9em] rounded-full bg-[var(--board-tertiary)]" />
  if (done)
    return (
      <span className="relative z-10 grid h-[1.1em] w-[1.1em] place-items-center rounded-full bg-[var(--board-success)] text-[var(--board-success-container)]">
        <Check className="h-[0.75em] w-[0.75em]" strokeWidth={3.2} />
      </span>
    )
  return (
    <span
      className="relative z-10 h-[0.85em] w-[0.85em] rounded-full border-[0.16em] bg-[var(--board-surface-container-low)]"
      style={{
        borderColor: tone === "past" ? "var(--board-on-surface-dim)" : "var(--board-primary)",
      }}
    />
  )
}

function VisitRow({ mission, tone }: { mission: BoardMission; tone: RowTone }) {
  const people = peopleOf(mission)
  const fg = tone === "past" ? "var(--board-on-surface-dim)" : tone === "now" ? "var(--board-on-primary-container)" : "var(--board-on-surface)"
  const muted = tone === "past" ? "var(--board-on-surface-dim)" : tone === "now" ? "var(--board-primary)" : "var(--board-on-surface-variant)"
  return (
    <li className="grid grid-cols-[2.2em_minmax(0,1fr)] items-center">
      <span className="grid place-items-center" aria-hidden="true">
        <TimelineNode tone={tone} done={mission.status === "COMPLETED"} />
      </span>
      <div
        className={cn(ROW_COLUMNS, "rounded-[1.1em] px-[1.1em] py-[0.75em]")}
        style={{
          color: fg,
          background: tone === "now" ? "var(--board-primary-container)" : tone === "past" ? "transparent" : "var(--board-surface-container)",
        }}
      >
        <span className="text-[1.9em] font-semibold tabular-nums leading-none tracking-[-0.01em]">{mission.time ?? "—"}</span>
        <span className="min-w-0">
          <span className="block truncate text-[1.55em] font-semibold leading-[1.2]">{mission.clientLabel}</span>
          {(mission.location || mission.missionType) && (
            <span className="mt-[0.15em] flex items-center gap-[0.3em] truncate text-[1em]" style={{ color: muted }}>
              {mission.location && <MapPin aria-hidden="true" className="h-[1em] w-[1em] shrink-0" />}
              <span className="truncate">{mission.location || mission.missionType}</span>
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-[0.6em] portrait:hidden">
          {people[0] && <Avatar name={people[0]} size="2.1em" />}
          <span className="min-w-0 truncate text-[1.15em]" style={{ color: tone === "past" ? muted : fg }}>
            {people[0] ?? "—"}
            {people.length > 1 && <span style={{ color: muted }}> +{people.length - 1}</span>}
          </span>
        </span>
        <StatusCell status={mission.status} tone={tone} />
      </div>
    </li>
  )
}

function DayHeading({ label, isToday, count }: { label: string; isToday: boolean; count: number }) {
  return (
    <li className="grid grid-cols-[2.2em_minmax(0,1fr)] items-center pb-[0.1em] pt-[0.7em] first:pt-0">
      <span className="grid place-items-center" aria-hidden="true">
        <span className="relative z-10 h-[0.5em] w-[0.5em] rotate-45 bg-[var(--board-on-surface-variant)]" />
      </span>
      <p className="flex items-baseline gap-[0.6em] px-[0.4em]">
        <span className={cn("text-[1.2em] font-semibold", isToday ? "text-[var(--board-primary)]" : "text-[var(--board-on-surface)]")}>
          {isToday ? `Hari ini · ${label}` : label}
        </span>
        <span className="text-[1em] text-[var(--board-on-surface-variant)]">{count > 0 ? `${count} kunjungan` : "Tidak ada kunjungan"}</span>
      </p>
    </li>
  )
}

function EndOfList({ week }: { week: boolean }) {
  return (
    <li className="grid grid-cols-[2.2em_minmax(0,1fr)] items-center pt-[0.2em]">
      <span className="grid place-items-center" aria-hidden="true">
        <span className="relative z-10 h-[0.45em] w-[0.45em] rounded-full bg-[var(--board-outline-variant)]" />
      </span>
      <p className="px-[1.1em] py-[0.6em] text-[1.05em] text-[var(--board-on-surface-dim)]">
        {week ? "Tidak ada jadwal lagi minggu ini" : "Tidak ada jadwal lagi hari ini"}
      </p>
    </li>
  )
}

/* ── Team ── */

function TeamRow({ member }: { member: BoardTeamMember }) {
  return (
    <li className="flex items-center gap-[0.9em] rounded-[1.1em] bg-[var(--board-surface-container)] px-[0.9em] py-[0.7em]">
      <Avatar name={member.name} size="2.7em" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.2em] font-semibold leading-tight">{member.name}</span>
        <span className="mt-[0.2em] flex items-center gap-[0.35em] truncate text-[0.98em] text-[var(--board-on-surface-variant)]">
          {member.next ? (
            <span className="truncate">
              {member.next.day && `${member.next.day} `}
              <span className="font-semibold tabular-nums text-[var(--board-on-surface)]">{member.next.time}</span>
              {" · "}
              {member.next.client}
            </span>
          ) : (
            <>
              <Check aria-hidden="true" className="h-[1em] w-[1em] shrink-0 text-[var(--board-success)]" strokeWidth={2.6} />
              <span className="truncate">Jadwal selesai</span>
            </>
          )}
        </span>
      </span>
      <span className="grid h-[2em] min-w-[2em] shrink-0 place-items-center rounded-full bg-[var(--board-surface-container-highest)] px-[0.5em] text-[1em] font-semibold tabular-nums">
        {member.missionCount}
      </span>
    </li>
  )
}

function PanelHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-[1em] px-[1.5em] pb-[0.8em] pt-[1.2em]">
      <h2 className="text-[1.25em] font-semibold">{title}</h2>
      {meta && <span className="text-[1em] text-[var(--board-on-surface-variant)]">{meta}</span>}
    </div>
  )
}

/* ── Screen ── */

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
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)
  const clock = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)
  const show = (panel: BoardPanel) => panels.includes(panel)
  const week = snapshot.range === "week"
  const nowMinute = minuteOfDay(now)

  const stateOf = (mission: BoardMission): VisitState => {
    if (mission.day < snapshot.today) return "past"
    if (mission.day > snapshot.today) return "later"
    if (mission.startMinute <= nowMinute && nowMinute < mission.endMinute) return "now"
    return mission.endMinute <= nowMinute ? "past" : "later"
  }
  const ongoing = snapshot.missions.find((mission) => stateOf(mission) === "now" && !isOver(mission))
  const toneOf = (mission: BoardMission): RowTone => {
    if (mission.id === ongoing?.id) return "now"
    return isOver(mission) || stateOf(mission) === "past" ? "past" : "normal"
  }

  // The agenda: today onward. On the week board yesterday is history.
  const days = snapshot.days.filter((day) => day.date >= snapshot.today)
  const agenda = days.flatMap((day) => day.missions)
  const visits = agenda.length
  const completed = agenda.filter(isOver).length
  const live = agenda.filter((mission) => mission.status === "IN_PROGRESS" || mission.id === ongoing?.id).length
  const dayLabel = new Map(snapshot.days.map((day) => [day.date, day.label]))

  const upcoming = agenda.find((mission) => !isOver(mission) && stateOf(mission) === "later")
  const spotlight: Spotlight = ongoing
    ? { kind: "now", mission: ongoing }
    : upcoming
      ? {
          kind: "next",
          mission: upcoming,
          when: upcoming.day === snapshot.today ? countdown(upcoming.startMinute - nowMinute) : (dayLabel.get(upcoming.day) ?? upcoming.day),
        }
      : visits > 0
        ? { kind: "done", completed }
        : { kind: "empty" }

  const rail = show("counts") || show("team")

  return (
    <div className="board-backdrop grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-[1.3em] overflow-hidden p-[1.6em] text-[var(--board-on-surface)]">
      <TopBar screenLabel={screenLabel} dateLabel={dateLabel} clock={clock} preview={preview} masked={masked} />

      <div
        className={cn(
          "grid min-h-0 gap-[1.3em]",
          show("schedule") && rail ? "grid-cols-[minmax(0,1fr)_25em] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1fr)_auto]" : "grid-cols-1"
        )}
      >
        {show("schedule") && (
          <div className="flex min-h-0 min-w-0 flex-col gap-[1.3em]">
            <SpotlightCard spotlight={spotlight} week={week} />
            {visits > 0 && (
              <section className={cn(CARD, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
                <PanelHeading title={week ? "Jadwal minggu ini" : "Jadwal hari ini"} meta={`${visits} kunjungan`} />
                <div className="min-h-0 flex-1">
                  <AutoScroll id={`schedule-${snapshot.range}`}>
                    <ul className="relative flex flex-col gap-[0.45em] pb-[1.2em] pl-[0.6em] pr-[1.2em]">
                      <span aria-hidden="true" className="absolute bottom-[1.6em] left-[1.7em] top-[0.8em] w-[0.14em] rounded-full bg-[var(--board-outline-variant)]" />
                      {week
                        ? days.flatMap((day) => [
                            <DayHeading key={`day-${day.date}`} label={day.label} isToday={day.isToday} count={day.missions.length} />,
                            ...day.missions.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />),
                          ])
                        : agenda.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} />)}
                      <EndOfList week={week} />
                    </ul>
                  </AutoScroll>
                </div>
              </section>
            )}
          </div>
        )}

        {rail && (
          <div className={cn("flex min-h-0 min-w-0 flex-col gap-[1.3em]", show("schedule") && "portrait:grid portrait:h-[21em] portrait:grid-cols-2")}>
            {show("counts") && <StatsCard total={visits} completed={completed} live={live} peopleOut={snapshot.team.length} week={week} />}
            {show("team") && (
              <section className={cn(CARD, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
                <PanelHeading title="Tim di lapangan" meta={`${snapshot.team.length} orang`} />
                {snapshot.team.length > 0 ? (
                  <div className="min-h-0 flex-1">
                    <AutoScroll id="team">
                      <ul className="flex flex-col gap-[0.45em] px-[1em] pb-[1.2em]">
                        {snapshot.team.map((member) => (
                          <TeamRow key={member.name} member={member} />
                        ))}
                      </ul>
                    </AutoScroll>
                  </div>
                ) : (
                  <p className="px-[1.5em] pb-[1.4em] text-[1.05em] text-[var(--board-on-surface-dim)]">
                    {week ? "Belum ada yang bertugas minggu ini." : "Belum ada yang bertugas hari ini."}
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
