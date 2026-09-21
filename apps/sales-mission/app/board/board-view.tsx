import { Ban, CalendarClock, Check, Clock3, MapPin, UserX, Users } from "lucide-react"
import type { BoardMission, BoardOutcome, BoardSnapshot, BoardTeamMember } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
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
const ROW_COLUMNS = "grid grid-cols-[5.2em_minmax(0,2fr)_minmax(0,1.1fr)_10em] portrait:grid-cols-[4.6em_minmax(0,2fr)_9em] items-center gap-x-[1.1em]"

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

/** Cancelled and refused visits never reach here (OFF_THE_BOARD), so reported means done. */
const isOver = (mission: BoardMission) => mission.reported

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

function TopBar({
  screenLabel,
  dateLabel,
  clock,
  preview,
  masked,
  qr,
}: {
  screenLabel: string | null
  dateLabel: string
  clock: string
  preview: boolean
  masked: boolean
  /** The QR when the rail cannot hold it: portrait, or a board with no rail. */
  qr: { svg: string; className?: string } | null
}) {
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
        {qr && (
          <div className={cn("items-center gap-[0.7em]", qr.className)}>
            <QrTile svg={qr.svg} size="3.6em" />
            <p className="text-[0.85em] leading-tight text-[var(--board-on-surface-variant)]">
              Pindai untuk jadwal
              <br />
              di ponselmu
            </p>
          </div>
        )}
        <BoardClock initial={clock} className="text-[3.4em] font-semibold tabular-nums leading-none tracking-[-0.02em]" />
      </div>
    </header>
  )
}

/* ── QR ── */

/** The code on a white tile: dark modules on light is what a phone camera expects, and the tile's padding is the quiet zone. */
function QrTile({ svg, size }: { svg: string; size: string }) {
  return (
    <span
      aria-hidden="true"
      className="board-qr grid shrink-0 place-items-center rounded-[0.7em] bg-white p-[0.45em]"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/**
 * The wall's one call to action, as signage does it: a persistent QR in the
 * supporting rail with a verb, sized for someone who walks up to it, never
 * in the hero. It opens the public calendar, so the phone shows the same
 * schedule with the same masking and can be checked at the viewer's own pace.
 */
function QrCard({ svg }: { svg: string }) {
  return (
    <section className={cn(CARD, "flex shrink-0 items-center gap-[1.1em] px-[1.3em] py-[1.1em] portrait:hidden")}>
      <QrTile svg={svg} size="6.4em" />
      <div className="min-w-0">
        <p className="text-[1.15em] font-semibold leading-tight">Pindai untuk jadwal di ponselmu</p>
        <p className="mt-[0.3em] text-[0.95em] leading-snug text-[var(--board-on-surface-variant)]">Jadwal tim, tanpa login. Cek kapan saja dengan waktumu sendiri.</p>
      </div>
    </section>
  )
}

/* ── Spotlight ── */

type Spotlight =
  | { kind: "now"; mission: BoardMission }
  /** Several visits at once: the wall says so and shows the first few, the timeline shows them all. */
  | { kind: "many"; missions: BoardMission[] }
  | { kind: "next"; mission: BoardMission; when: string }
  | { kind: "done"; completed: number }
  | { kind: "empty" }

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

  if (spotlight.kind === "many") {
    const shown = spotlight.missions.slice(0, 3)
    const rest = spotlight.missions.length - shown.length
    return (
      <section className="relative overflow-hidden rounded-[1.6em] bg-[var(--board-primary-container)] px-[1.8em] py-[1.4em] text-[var(--board-on-primary-container)]">
        <div className="flex items-center gap-[0.6em]">
          <span className="board-ring h-[0.75em] w-[0.75em] rounded-full bg-[var(--board-tertiary)]" aria-hidden="true" />
          <Eyebrow className="text-[var(--board-tertiary)]">Sedang berlangsung · {spotlight.missions.length} kunjungan</Eyebrow>
        </div>
        <ul className="mt-[0.8em] grid grid-cols-3 gap-[1.2em] portrait:grid-cols-1 portrait:gap-[0.6em]">
          {shown.map((mission) => {
            const people = peopleOf(mission)
            return (
              <li
                key={mission.id}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[0.9em] border-l-[0.12em] pl-[0.9em]"
                style={{ borderColor: "color-mix(in srgb, var(--board-on-primary-container) 25%, transparent)" }}
              >
                <span className="text-[2.2em] font-semibold tabular-nums leading-none tracking-[-0.03em]">{mission.time ?? "—"}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[1.5em] font-semibold leading-[1.15]">{mission.clientLabel}</span>
                  <span className="mt-[0.2em] flex min-w-0 items-center gap-[0.35em] text-[1em]">
                    {people[0] && <Avatar name={people[0]} size="1.5em" ring="var(--board-primary-container)" />}
                    <span className="truncate">{[people[0], mission.location].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
        {rest > 0 && <p className="mt-[0.7em] text-[1em] text-[var(--board-primary)]">+{rest} kunjungan lagi, lihat jadwal di bawah</p>}
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

function StatsCard({
  total,
  completed,
  elapsed,
  unreported,
  peopleOut,
  week,
}: {
  total: number
  completed: number
  elapsed: number
  unreported: number
  peopleOut: number
  week: boolean
}) {
  const pct = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "0%")
  const stats = [
    { label: "Dilaporkan", value: completed, tone: completed > 0 ? "var(--board-success)" : undefined },
    { label: "Belum dilaporkan", value: unreported, tone: unreported > 0 ? "var(--board-tertiary)" : undefined },
    { label: "Di lapangan", value: peopleOut, tone: undefined },
  ]
  return (
    <section className={cn(CARD, "px-[1.5em] py-[1.3em]")}>
      <Eyebrow className="text-[var(--board-on-surface-variant)]">{week ? "Progres minggu ini" : "Progres hari ini"}</Eyebrow>
      <div className="mt-[0.4em] flex items-baseline gap-[0.4em] tabular-nums">
        <span className="text-[3.2em] font-semibold leading-none tracking-[-0.02em]">{elapsed}</span>
        <span className="text-[1.4em] font-medium text-[var(--board-on-surface-variant)]">/ {total} sudah berlangsung</span>
      </div>
      {/* Two segments: what was written down, and what happened but was not. */}
      <div
        className="mt-[0.9em] flex h-[0.6em] overflow-hidden rounded-full bg-[var(--board-surface-container-highest)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={elapsed}
        aria-label={`${completed} dilaporkan, ${unreported} belum dilaporkan, dari ${total} kunjungan`}
      >
        <div className="h-full bg-[var(--board-success)]" style={{ width: pct(completed) }} />
        <div className="h-full bg-[var(--board-tertiary)] opacity-70" style={{ width: pct(unreported) }} />
      </div>
      <dl className="mt-[1.1em] grid grid-cols-3 gap-[0.6em]">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1em] bg-[var(--board-surface-container)] px-[0.9em] py-[0.7em]">
            <dd className="text-[1.9em] font-semibold tabular-nums leading-none" style={{ color: stat.tone }}>{stat.value}</dd>
            <dt className="mt-[0.35em] truncate text-[0.9em] text-[var(--board-on-surface-variant)]">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── Schedule ── */

/**
 * The last column says what the wall can know about the visit's state, not
 * what the workflow calls it. "Diterima" or "Ditugaskan" is a fact about the
 * assignment nobody in the office acts on; the end time, "Sekarang",
 * "Selesai" or "Belum dilaporkan" is.
 */
function StatusCell({ mission, tone, elapsed }: { mission: BoardMission; tone: RowTone; elapsed: boolean }) {
  if (tone === "now") {
    return (
      <span className="flex items-center gap-[0.5em] text-[1.15em] font-semibold text-[var(--board-tertiary)]">
        <span aria-hidden="true" className="board-pulse h-[0.6em] w-[0.6em] shrink-0 rounded-full bg-[var(--board-tertiary)]" />
        Sekarang
      </span>
    )
  }
  if (mission.reported) {
    return (
      <span className="flex items-center gap-[0.45em] text-[1.15em] font-medium text-[var(--board-success)]">
        <Check aria-hidden="true" className="h-[1em] w-[1em] shrink-0" strokeWidth={2.6} />
        Selesai
      </span>
    )
  }
  if (elapsed) {
    return (
      <span className="flex min-w-0 items-center gap-[0.45em] text-[1.15em] font-medium text-[var(--board-tertiary)]">
        <span aria-hidden="true" className="h-[0.6em] w-[0.6em] shrink-0 rounded-full border-[0.14em] border-current" />
        <span className="truncate">Belum dilaporkan</span>
      </span>
    )
  }
  return (
    <span className="text-[1.15em] font-medium tabular-nums" style={{ color: tone === "past" ? "var(--board-on-surface-dim)" : "var(--board-on-surface-variant)" }}>
      {mission.time ? `s.d. ${clockOf(mission.endMinute)}` : "—"}
    </span>
  )
}

/** The kind of a visit's outcome, as a colour and a glyph: met, moved, nobody there, called off. */
function OutcomeLine({ outcome, tone }: { outcome: BoardOutcome; tone: RowTone }) {
  const met = outcome.kind === "met_decision_maker" || outcome.kind === "met_staff"
  const color =
    tone === "now"
      ? "var(--board-on-primary-container)"
      : met
        ? "var(--board-success)"
        : outcome.kind === "rescheduled"
          ? "var(--board-primary)"
          : "var(--board-tertiary)"
  const Icon = met ? Check : outcome.kind === "rescheduled" ? CalendarClock : outcome.kind === "absent" ? UserX : Ban
  return (
    <span className="flex min-w-0 items-center gap-[0.3em]" style={{ color }}>
      <Icon aria-hidden="true" className="h-[1em] w-[1em] shrink-0" strokeWidth={met ? 2.6 : 2.2} />
      <span className="truncate">{outcome.label}</span>
    </span>
  )
}

function TypeChip({ type, tone }: { type: string; tone: RowTone }) {
  return (
    <span
      className="shrink-0 rounded-full px-[0.6em] py-[0.18em] text-[0.8em] font-medium leading-none"
      style={{
        background: tone === "now" ? "color-mix(in srgb, var(--board-on-primary-container) 14%, transparent)" : "var(--board-surface-container-highest)",
        color: tone === "now" ? "var(--board-on-primary-container)" : tone === "past" ? "var(--board-on-surface-dim)" : "var(--board-on-surface-variant)",
      }}
    >
      {type}
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

function VisitRow({ mission, tone, elapsed }: { mission: BoardMission; tone: RowTone; elapsed: boolean }) {
  const people = peopleOf(mission)
  const fg = tone === "past" ? "var(--board-on-surface-dim)" : tone === "now" ? "var(--board-on-primary-container)" : "var(--board-on-surface)"
  const muted = tone === "past" ? "var(--board-on-surface-dim)" : tone === "now" ? "var(--board-primary)" : "var(--board-on-surface-variant)"
  const type = mission.missionType.trim()
  return (
    <li className="grid grid-cols-[2.2em_minmax(0,1fr)] items-center" data-board-now={tone === "now" ? "" : undefined}>
      <span className="grid place-items-center" aria-hidden="true">
        <TimelineNode tone={tone} done={mission.reported} />
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
          <span className="flex min-w-0 items-center gap-[0.6em]">
            <span className="min-w-0 truncate text-[1.55em] font-semibold leading-[1.2]">{mission.clientLabel}</span>
            {type && <TypeChip type={type} tone={tone} />}
          </span>
          {/* Second line: what the report said when the wall may say it, then where. */}
          {(mission.outcome || mission.location) && (
            <span className="mt-[0.15em] flex min-w-0 items-center gap-[0.5em] text-[1em]" style={{ color: muted }}>
              {mission.outcome && <OutcomeLine outcome={mission.outcome} tone={tone} />}
              {mission.outcome && mission.location && <span aria-hidden="true">·</span>}
              {mission.location && (
                <span className="flex min-w-0 items-center gap-[0.3em]">
                  <MapPin aria-hidden="true" className="h-[1em] w-[1em] shrink-0" />
                  <span className="truncate">{mission.location}</span>
                </span>
              )}
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
        <StatusCell mission={mission} tone={tone} elapsed={elapsed} />
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
  const live = Boolean(member.now)
  return (
    <li
      className="flex items-center gap-[0.9em] rounded-[1.1em] px-[0.9em] py-[0.7em]"
      style={{ background: live ? "var(--board-primary-container)" : "var(--board-surface-container)", color: live ? "var(--board-on-primary-container)" : "var(--board-on-surface)" }}
      data-board-now={live ? "" : undefined}
    >
      <Avatar name={member.name} size="2.7em" ring={live ? "var(--board-tertiary)" : undefined} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.2em] font-semibold leading-tight">{member.name}</span>
        <span className="mt-[0.2em] flex items-center gap-[0.35em] truncate text-[0.98em]" style={{ color: live ? "var(--board-on-primary-container)" : "var(--board-on-surface-variant)" }}>
          {member.now ? (
            <>
              <span aria-hidden="true" className="board-pulse h-[0.55em] w-[0.55em] shrink-0 rounded-full bg-[var(--board-tertiary)]" />
              <span className="truncate">
                <span className="font-semibold tabular-nums">{member.now.time}</span>
                {" · "}
                {member.now.client}
                {member.now.location && <span style={{ color: "var(--board-primary)" }}> · {member.now.location}</span>}
              </span>
            </>
          ) : member.next ? (
            <span className="truncate">
              Berikutnya {member.next.day && `${member.next.day} `}
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
      <span
        className="shrink-0 rounded-full px-[0.65em] py-[0.3em] text-[0.9em] font-semibold tabular-nums"
        style={{ background: live ? "color-mix(in srgb, var(--board-on-primary-container) 14%, transparent)" : "var(--board-surface-container-highest)" }}
        title={`${member.missionCount} kunjungan`}
      >
        {member.missionCount} <span className="font-normal opacity-80">kunj.</span>
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
  qr = null,
}: {
  snapshot: BoardSnapshot
  now: Date
  panels: BoardPanel[]
  /** A signed-in admin looking, not a screen on a wall: say so, and say what is masked. */
  preview: boolean
  masked: boolean
  /** The screen's name as the admin labelled its link, if any. */
  screenLabel: string | null
  /** QR code to the paired calendar link as SVG markup, when the link carries one. */
  qr?: string | null
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
  // Every visit in progress at this minute, in the day's order: with ten
  // people out, two or three at once is the normal case, not the edge.
  const ongoingAll = snapshot.missions.filter((mission) => stateOf(mission) === "now" && !isOver(mission))
  const ongoingIds = new Set(ongoingAll.map((mission) => mission.id))
  const ongoing = ongoingAll[0]
  const toneOf = (mission: BoardMission): RowTone => {
    if (ongoingIds.has(mission.id)) return "now"
    return isOver(mission) || stateOf(mission) === "past" ? "past" : "normal"
  }
  /** Its scheduled end has passed: it happened, whether or not it was reported. */
  const hasElapsed = (mission: BoardMission) => stateOf(mission) === "past"

  // The agenda: today onward. On the week board yesterday is history.
  const days = snapshot.days.filter((day) => day.date >= snapshot.today)
  const agenda = days.flatMap((day) => day.missions)
  const visits = agenda.length
  const completed = agenda.filter(isOver).length
  const live = agenda.filter((mission) => mission.status === "IN_PROGRESS" || ongoingIds.has(mission.id)).length
  const dayLabel = new Map(snapshot.days.map((day) => [day.date, day.label]))

  const upcoming = agenda.find((mission) => !isOver(mission) && stateOf(mission) === "later")
  const spotlight: Spotlight = ongoingAll.length > 1
    ? { kind: "many", missions: ongoingAll }
    : ongoing
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
      <TopBar
        screenLabel={screenLabel}
        dateLabel={dateLabel}
        clock={clock}
        preview={preview}
        masked={masked}
        // In the rail when there is one (landscape); in the bar when the rail is a band (portrait) or absent.
        qr={qr ? { svg: qr, className: rail ? "hidden portrait:flex" : "flex" } : null}
      />

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
                <PanelHeading title={week ? "Jadwal minggu ini" : "Jadwal hari ini"} meta={live > 0 ? `${visits} kunjungan · ${live} berlangsung` : `${visits} kunjungan`} />
                <div className="min-h-0 flex-1">
                  <AutoScroll id={`schedule-${snapshot.range}`}>
                    <ul className="relative flex flex-col gap-[0.45em] pb-[1.2em] pl-[0.6em] pr-[1.2em]">
                      <span aria-hidden="true" className="absolute bottom-[1.6em] left-[1.7em] top-[0.8em] w-[0.14em] rounded-full bg-[var(--board-outline-variant)]" />
                      {week
                        ? days.flatMap((day) => [
                            <DayHeading key={`day-${day.date}`} label={day.label} isToday={day.isToday} count={day.missions.length} />,
                            ...day.missions.map((mission) => (
                              <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} elapsed={hasElapsed(mission)} />
                            )),
                          ])
                        : agenda.map((mission) => <VisitRow key={mission.id} mission={mission} tone={toneOf(mission)} elapsed={hasElapsed(mission)} />)}
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
            {show("counts") && (
              <StatsCard
                total={snapshot.counts.todayTotal}
                completed={snapshot.counts.completed}
                elapsed={snapshot.counts.elapsed}
                unreported={snapshot.counts.unreported}
                peopleOut={snapshot.team.length}
                week={week}
              />
            )}
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
            {qr && <QrCard svg={qr} />}
          </div>
        )}
      </div>
    </div>
  )
}
