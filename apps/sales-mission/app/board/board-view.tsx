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
 * Read from across a room by people who cannot touch it, so it is built
 * like a departures board, not a dashboard: one dominant region (the
 * schedule), rows tall enough to read at four metres, the time in large
 * tabular figures at the left of every row, status as a coloured edge and
 * a word, and nothing that competes: no KPI tiles, no separate hero, a
 * small clock. Everything is sized in `em` from one root size that follows
 * the screen's width, so a 4K TV and a 1080p TV show the same composition.
 *
 * Material's rules for a dark, distant surface, kept: tonal surfaces
 * instead of borders; one tinted container for the one thing the room
 * should look at (the visit happening now, else the next one), in its
 * place in the list rather than repeated above it; empty states that say
 * what would fill them, in a quiet colour; motion small and slow.
 */

const EDGE: Record<string, string> = {
  COMPLETED: "bg-[var(--board-done)]",
  ACCEPTED: "bg-[var(--board-active)]",
  IN_PROGRESS: "bg-[var(--board-running)]",
  CANCELLED: "bg-[var(--board-text-dim)]",
  REJECTED: "bg-[var(--board-text-dim)]",
}

type VisitState = "past" | "now" | "later"

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2)
}

/** A stable tonal hue per person, so the same name is the same colour every day. */
function avatarTone(name: string): string {
  const tones = ["bg-sky-500/25 text-sky-100", "bg-emerald-500/25 text-emerald-100", "bg-amber-500/25 text-amber-100", "bg-violet-500/25 text-violet-100", "bg-rose-500/25 text-rose-100", "bg-teal-500/25 text-teal-100"]
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return tones[Math.abs(hash) % tones.length]
}

const isOver = (mission: BoardMission) => mission.status === "COMPLETED" || mission.status === "CANCELLED" || mission.status === "REJECTED"

function VisitRow({ mission, state, highlight }: { mission: BoardMission; state: VisitState; highlight: "now" | "next" | null }) {
  const now = highlight === "now"
  const next = highlight === "next"
  const dim = !now && !next && (isOver(mission) || state === "past")
  const people = [
    mission.primarySalesName,
    mission.supportingSalesNames.length > 0 ? `+${mission.supportingSalesNames.length}` : null,
  ].filter(Boolean).join(" ")
  const meta = [people || null, mission.location, mission.missionType].filter(Boolean).join(" · ")
  return (
    <li
      className={cn(
        "relative flex items-center gap-[1em] rounded-[0.8em] py-[0.7em] pl-[1.4em] pr-[1.2em]",
        now && "bg-[var(--board-primary-container)] text-[var(--board-on-primary-container)]",
        next && "bg-[var(--board-surface-2)]",
        dim && "opacity-55"
      )}
    >
      <span aria-hidden="true" className={cn("absolute left-[0.5em] top-[0.9em] bottom-[0.9em] w-[0.3em] rounded-full", now ? "bg-[var(--board-running)]" : EDGE[mission.status] ?? "bg-[var(--board-text-dim)]")} />
      <span className="w-[3.1em] shrink-0 font-mono text-[2.2em] font-extrabold tabular-nums leading-none">{mission.time ?? "—"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.5em] font-bold leading-tight">{mission.clientLabel}</span>
        <span className={cn("mt-[0.2em] block truncate text-[1.05em]", now ? "text-[var(--board-on-primary-container)]/85" : "text-[var(--board-text-dim)]")}>{meta}</span>
      </span>
      <span className="shrink-0 text-right">
        {(now || next) && (
          <span className={cn("mb-[0.25em] flex items-center justify-end gap-[0.45em] text-[0.78em] font-bold uppercase tracking-[0.18em]", now ? "text-[var(--board-on-primary-container)]" : "text-[var(--board-accent)]")}>
            {now && <span aria-hidden="true" className="board-pulse h-[0.6em] w-[0.6em] rounded-full bg-[var(--board-running)]" />}
            {now ? "Sekarang" : "Berikutnya"}
          </span>
        )}
        <span className={cn("flex items-center justify-end gap-[0.5em] text-[1.05em]", now ? "text-[var(--board-on-primary-container)]/85" : "text-[var(--board-text-dim)]")}>
          <span aria-hidden="true" className={cn("h-[0.55em] w-[0.55em] rounded-full", EDGE[mission.status] ?? "bg-[var(--board-text-dim)]")} />
          {statusLabel(mission.status)}
        </span>
      </span>
    </li>
  )
}

function DayHeading({ label, isToday, count }: { label: string; isToday: boolean; count: number }) {
  return (
    <li className="flex items-baseline justify-between gap-[1em] px-[1.2em] pb-[0.35em] pt-[1em] first:pt-[0.4em]">
      <span className={cn("text-[1.05em] font-bold uppercase tracking-[0.14em]", isToday ? "text-[var(--board-accent)]" : "text-[var(--board-text-dim)]")}>
        {isToday ? `Hari ini · ${label}` : label}
      </span>
      <span className="text-[0.95em] text-[var(--board-text-dim)]">{count > 0 ? `${count} kunjungan` : "Tidak ada kunjungan"}</span>
    </li>
  )
}

function TeamRow({ member }: { member: BoardTeamMember }) {
  return (
    <li className="flex items-center gap-[0.8em] border-b border-[var(--board-line)] py-[0.65em] last:border-0">
      <span className={cn("grid h-[2.4em] w-[2.4em] shrink-0 place-items-center rounded-full text-[0.9em] font-bold", avatarTone(member.name))}>{initials(member.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.2em] font-semibold leading-tight">{member.name}</span>
        <span className="mt-[0.15em] block truncate text-[0.95em] text-[var(--board-text-dim)]">
          {member.next ? (
            <>
              {member.next.day && `${member.next.day} `}
              <span className="font-mono font-bold tabular-nums text-[var(--board-text)]">{member.next.time}</span>
              {" · "}
              {member.next.client}
            </>
          ) : (
            "Tidak ada jadwal lagi"
          )}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[var(--board-surface-2)] px-[0.6em] py-[0.15em] font-mono text-[0.85em] tabular-nums text-[var(--board-text-dim)]">{member.missionCount}</span>
    </li>
  )
}

function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.2em] bg-[var(--board-surface-1)]">
      <h2 className="flex shrink-0 items-baseline justify-between gap-[1em] px-[1.2em] pb-[0.5em] pt-[0.9em] text-[1.25em] font-bold">
        {title}
        <span className="text-[0.75em] font-normal text-[var(--board-text-dim)]">{meta}</span>
      </h2>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

function Quiet({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-[2em] pb-[2em] text-center">
      <p className="text-[1.4em] font-semibold text-[var(--board-text-dim)]">{title}</p>
      <p className="mt-[0.3em] max-w-[24em] text-[0.95em] text-[var(--board-text-dim)]/80">{hint}</p>
    </div>
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
  // The one row the room should look at: the visit happening now, else the
  // next one to start. Marked where it sits, not lifted out of the list.
  const ongoing = snapshot.missions.find((mission) => stateOf(mission) === "now" && !isOver(mission))
  const upcoming = ongoing ? null : snapshot.missions.find((mission) => stateOf(mission) === "later" && !isOver(mission))
  const highlightFor = (mission: BoardMission): "now" | "next" | null =>
    mission.id === ongoing?.id ? "now" : mission.id === upcoming?.id ? "next" : null

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
    <div
      className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-[1.1em] overflow-hidden bg-[var(--board-bg)] px-[2.2em] pb-[1.6em] pt-[1.3em] text-[var(--board-text)]"
      style={{ fontSize: "clamp(15px, 1.05vw, 44px)", colorScheme: "dark" }}
    >
      {/* The document behind the board is light; a minute reload must not flash white. */}
      <style>{`html, body { background: var(--board-bg, #0d1117); }`}</style>

      <header className="flex items-end justify-between gap-[1.5em]">
        <div className="min-w-0">
          <p className="text-[0.7em] font-bold uppercase tracking-[0.22em] text-[var(--board-accent)]">
            Sales Activity{screenLabel ? ` · ${screenLabel}` : ""}
          </p>
          <h1 className="mt-[0.2em] text-[1.6em] font-extrabold leading-none tracking-tight">{week ? "Minggu ini di lapangan" : "Hari ini di lapangan"}</h1>
          {show("counts") && <p className="mt-[0.45em] text-[0.95em] text-[var(--board-text-dim)]">{summary}</p>}
        </div>
        <div className="flex shrink-0 items-end gap-[1.2em]">
          {preview && (
            <span className="rounded-full border border-[var(--board-line)] px-[0.8em] py-[0.3em] text-[0.68em] font-semibold uppercase tracking-[0.16em] text-[var(--board-text-dim)]">
              Pratinjau · nama klien {masked ? "disamarkan" : "ditampilkan"}
            </span>
          )}
          <div className="text-right">
            <p className="text-[0.95em] text-[var(--board-text-dim)]">{dateLabel}</p>
            <BoardClock initial={clock} className="mt-[0.1em] text-[1.4em] font-bold tabular-nums leading-none" />
          </div>
        </div>
      </header>

      <div className={cn("grid min-h-0 gap-[1.1em]", show("schedule") && show("team") ? "grid-cols-[minmax(0,1fr)_minmax(0,0.34fr)]" : "grid-cols-1")}>
        {show("schedule") && (
          <Panel title={week ? "Jadwal minggu ini" : "Jadwal hari ini"} meta={`${visits} kunjungan`}>
            {visits === 0 ? (
              <Quiet
                title={week ? "Tidak ada kunjungan minggu ini" : "Tidak ada kunjungan hari ini"}
                hint="Kunjungan yang dijadwalkan tampil di sini, urut jam."
              />
            ) : (
              <AutoScroll id={`schedule-${snapshot.range}`}>
                <ul className="space-y-[0.2em] px-[0.6em] pb-[0.8em]">
                  {week
                    ? days.flatMap((day) => [
                        <DayHeading key={`day-${day.date}`} label={day.label} isToday={day.isToday} count={day.missions.length} />,
                        ...day.missions.map((mission) => <VisitRow key={mission.id} mission={mission} state={stateOf(mission)} highlight={highlightFor(mission)} />),
                      ])
                    : snapshot.missions.map((mission) => <VisitRow key={mission.id} mission={mission} state={stateOf(mission)} highlight={highlightFor(mission)} />)}
                </ul>
              </AutoScroll>
            )}
          </Panel>
        )}

        {show("team") && (
          <Panel title="Tim di lapangan" meta={`${snapshot.team.length} orang`}>
            {snapshot.team.length > 0 ? (
              <AutoScroll id="team">
                <ul className="px-[1.2em] pb-[0.8em]">
                  {snapshot.team.map((member) => <TeamRow key={member.name} member={member} />)}
                </ul>
              </AutoScroll>
            ) : (
              <Quiet title={week ? "Belum ada yang bertugas minggu ini" : "Belum ada yang bertugas hari ini"} hint="Setiap sales dengan kunjungan tampil di sini beserta tujuan berikutnya." />
            )}
          </Panel>
        )}
      </div>
    </div>
  )
}
