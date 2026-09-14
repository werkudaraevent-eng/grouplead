import { CalendarCheck, CalendarDays, CheckCircle2, MapPin, Users } from "lucide-react"
import type { BoardMission, BoardSnapshot } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"

/**
 * The screen. Read from across a room: large type, high contrast, no
 * interaction. Masking has already happened upstream — this renders whatever
 * labels it is handed and never decides what to hide.
 *
 * Material's rules for a dark, distant surface, taken as rules:
 *
 *   - Tonal elevation, not borders. Panels are a lighter wash of the same
 *     neutral (--board-surface-1/2); nothing is outlined.
 *   - One tinted container for the one thing the room should look at. The
 *     primary container holds "Berikutnya": the next visit, or the one
 *     happening now. Everything else is neutral.
 *   - A type scale with real steps: display for the clock, headline for the
 *     hero, title for section headers, body for rows. Numbers are large only
 *     where they are the point.
 *   - Empty states are centred and say what would fill them, not a lone
 *     sentence in a corner.
 *
 * Colours come from the --board-* tokens in globals.css, so the board is a
 * declared surface of the design system instead of a third colour scheme
 * living inside one component.
 */

const STATUS_DOT: Record<string, string> = {
  COMPLETED: "bg-[var(--board-done)]",
  ACCEPTED: "bg-[var(--board-active)]",
  IN_PROGRESS: "bg-[var(--board-running)]",
  CANCELLED: "bg-[var(--board-text-dim)]",
  REJECTED: "bg-[var(--board-text-dim)]",
}

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2)
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[var(--board-surface-1)] px-6 py-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--board-surface-2)] text-[var(--board-text-dim)]">
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-base text-[var(--board-text-dim)]">{label}</span>
        <span className="block text-4xl font-bold tabular-nums leading-tight text-[var(--board-text)]">{value}</span>
      </span>
    </div>
  )
}

function Empty({ icon: Icon, title, hint }: { icon: typeof Users; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--board-surface-2)] text-[var(--board-text-dim)]">
        <Icon className="h-8 w-8" />
      </span>
      <p className="mt-4 text-2xl font-semibold text-[var(--board-text)]">{title}</p>
      <p className="mt-1 max-w-md text-lg text-[var(--board-text-dim)]">{hint}</p>
    </div>
  )
}

function Row({ mission, state, compact = false }: { mission: BoardMission; state: "past" | "now" | "later"; compact?: boolean }) {
  const done = mission.status === "COMPLETED" || mission.status === "CANCELLED" || mission.status === "REJECTED"
  return (
    <li
      className={cn(
        "flex items-center gap-5 px-6",
        compact ? "gap-4 px-4 py-3" : "py-4",
        state === "now" && "bg-[var(--board-primary-container)] text-[var(--board-on-primary-container)]",
        (done || state === "past") && state !== "now" && "opacity-60"
      )}
    >
      <span className={cn("shrink-0 font-mono font-bold tabular-nums", compact ? "w-14 text-lg" : "w-20 text-2xl")}>{mission.time ?? "—"}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold", compact ? "text-base" : "text-xl")}>{mission.clientLabel}</span>
        <span className={cn("block truncate", compact ? "text-sm" : "text-base", state === "now" ? "text-[var(--board-on-primary-container)]/80" : "text-[var(--board-text-dim)]")}>
          {[mission.primarySalesName, mission.location].filter(Boolean).join(" · ") || mission.missionType}
        </span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-2", compact ? "text-xs" : "text-sm", state === "now" ? "text-[var(--board-on-primary-container)]" : "text-[var(--board-text-dim)]")}>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[mission.status] ?? "bg-[var(--board-text-dim)]")} />
        {state === "now" && !done ? "Sekarang" : statusLabel(mission.status)}
      </span>
    </li>
  )
}

export function BoardView({ snapshot, subtitle, now, panels }: { snapshot: BoardSnapshot; subtitle: string; now: Date; panels: BoardPanel[] }) {
  const dateLabel = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)
  const clock = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(now)
  const show = (panel: BoardPanel) => panels.includes(panel)
  const week = snapshot.range === "week"
  const nowMinute = minuteOfDay(now)

  const stateOf = (mission: BoardMission): "past" | "now" | "later" => {
    if (mission.day < snapshot.today) return "past"
    if (mission.day > snapshot.today) return "later"
    if (mission.startMinute <= nowMinute && nowMinute < mission.endMinute) return "now"
    return mission.endMinute <= nowMinute ? "past" : "later"
  }
  const live = (mission: BoardMission) => mission.status !== "COMPLETED" && mission.status !== "CANCELLED" && mission.status !== "REJECTED"
  const ongoing = snapshot.missions.find((mission) => stateOf(mission) === "now" && live(mission))
  const upcoming = snapshot.missions.find((mission) => stateOf(mission) === "later" && live(mission))
  const hero = ongoing ?? upcoming
  const heroKind = ongoing ? "Sedang berlangsung" : "Berikutnya"
  const todayCount = snapshot.days.find((day) => day.isToday)?.missions.length ?? 0

  return (
    <div className="min-h-screen bg-[var(--board-bg)] px-12 py-10 text-[var(--board-text)]">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Mission</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{week ? "Minggu ini di lapangan" : "Hari ini di lapangan"}</h1>
          <p className="mt-1 text-lg text-[var(--board-text-dim)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xl text-[var(--board-text-dim)]">{dateLabel}</p>
          <p className="text-6xl font-bold tabular-nums leading-none">{clock}</p>
        </div>
      </header>

      {/* The one tinted surface. Nothing else on the screen competes with it. */}
      <section className="mt-10 rounded-3xl bg-[var(--board-primary-container)] px-8 py-7 text-[var(--board-on-primary-container)]">
        {hero ? (
          <div className="flex flex-wrap items-center gap-8">
            <div className="shrink-0">
              <p className="text-base font-semibold uppercase tracking-widest opacity-80">{heroKind}</p>
              <p className="mt-1 font-mono text-6xl font-bold tabular-nums leading-none">{hero.time}</p>
              {week && hero.day !== snapshot.today && (
                <p className="mt-1 text-lg opacity-80">{snapshot.days.find((day) => day.date === hero.day)?.label}</p>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-4xl font-bold">{hero.clientLabel}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xl opacity-90">
                {hero.primarySalesName && <span className="inline-flex items-center gap-2"><Users className="h-5 w-5" />{hero.primarySalesName}{hero.supportingSalesNames.length > 0 && ` +${hero.supportingSalesNames.length}`}</span>}
                {hero.location && <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5" />{hero.location}</span>}
                <span className="inline-flex items-center gap-2"><CalendarCheck className="h-5 w-5" />{hero.missionType}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/10">
              <CalendarDays className="h-8 w-8" />
            </span>
            <div>
              <p className="text-3xl font-bold">
                {todayCount > 0 ? "Semua kunjungan hari ini selesai" : week ? "Tidak ada kunjungan tersisa minggu ini" : "Tidak ada kunjungan hari ini"}
              </p>
              <p className="mt-1 text-lg opacity-80">
                {todayCount > 0 ? `${todayCount} kunjungan dijalani hari ini.` : "Kunjungan yang dijadwalkan akan tampil di sini begitu ada."}
              </p>
            </div>
          </div>
        )}
      </section>

      {show("counts") && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={week ? "Kunjungan minggu ini" : "Kunjungan hari ini"} value={snapshot.counts.todayTotal} icon={CalendarCheck} />
          <Stat label="Diterima" value={snapshot.counts.accepted} icon={CheckCircle2} />
          <Stat label="Selesai" value={snapshot.counts.completed} icon={CheckCircle2} />
          <Stat label="Mission berjalan" value={snapshot.counts.openMissions} icon={MapPin} />
        </section>
      )}

      <section className={cn("mt-6 grid gap-6", show("schedule") && show("team") && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        {show("schedule") && !week && (
          <div className="overflow-hidden rounded-3xl bg-[var(--board-surface-1)]">
            <h2 className="flex items-center justify-between px-6 py-5 text-2xl font-semibold">
              Jadwal hari ini
              <span className="text-base font-normal text-[var(--board-text-dim)]">{snapshot.missions.length} kunjungan</span>
            </h2>
            {snapshot.missions.length > 0 ? (
              <ul className="divide-y divide-[var(--board-line)]">
                {snapshot.missions.map((mission) => <Row key={mission.id} mission={mission} state={stateOf(mission)} />)}
              </ul>
            ) : (
              <Empty icon={CalendarDays} title="Tidak ada kunjungan hari ini" hint="Jadwal yang dibuat untuk hari ini akan tampil di sini, urut jam." />
            )}
          </div>
        )}

        {show("schedule") && week && (
          /* A week on a screen is seven columns, the way a wall calendar is
             read; today's column is lifted so the eye lands there first. */
          <div className="grid gap-3 md:grid-cols-7">
            {snapshot.days.map((day) => (
              <div key={day.date} className={cn("overflow-hidden rounded-2xl bg-[var(--board-surface-1)]", day.isToday && "bg-[var(--board-surface-2)] ring-2 ring-[var(--board-accent)]")}>
                <h2 className={cn("flex items-center justify-between px-4 py-3 text-base font-semibold", day.isToday && "text-[var(--board-accent)]")}>
                  {day.label}
                  <span className="font-mono text-sm text-[var(--board-text-dim)]">{day.missions.length}</span>
                </h2>
                {day.missions.length > 0 ? (
                  <ul className="divide-y divide-[var(--board-line)]">
                    {day.missions.map((mission) => <Row key={mission.id} mission={mission} state={stateOf(mission)} compact />)}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-[var(--board-text-dim)]">Kosong</p>
                )}
              </div>
            ))}
          </div>
        )}

        {show("team") && (
          <div className="overflow-hidden rounded-3xl bg-[var(--board-surface-1)]">
            <h2 className="flex items-center justify-between px-6 py-5 text-2xl font-semibold">
              Tim di lapangan
              <span className="text-base font-normal text-[var(--board-text-dim)]">{snapshot.team.length} orang</span>
            </h2>
            {snapshot.team.length > 0 ? (
              <ul className="divide-y divide-[var(--board-line)]">
                {snapshot.team.map((member) => (
                  <li key={member.name} className="flex items-center gap-4 px-6 py-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--board-surface-2)] text-base font-bold">{initials(member.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-semibold">{member.name}</span>
                      <span className="block truncate text-base text-[var(--board-text-dim)]">
                        {member.next ? `Berikutnya ${member.next}` : "Semua kunjungan selesai"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--board-surface-2)] px-3 py-1 font-mono text-base tabular-nums text-[var(--board-text-dim)]">{member.missionCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Users} title={week ? "Belum ada yang bertugas minggu ini" : "Belum ada yang bertugas hari ini"} hint="Setiap sales dengan kunjungan muncul di sini beserta tujuan berikutnya." />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
