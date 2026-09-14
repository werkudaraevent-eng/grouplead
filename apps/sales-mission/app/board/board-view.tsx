import { CalendarCheck, CalendarDays, CheckCircle2, MapPin, Users } from "lucide-react"
import type { BoardMission, BoardSnapshot } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"

/**
 * The screen. Read from across a room: large type, high contrast, no
 * interaction, and it never scrolls. A wall display has nobody to scroll
 * it, so the layout is a fixed viewport: header, hero and counts take what
 * they need, the panels take the rest and clip, and a panel with more rows
 * than fit says "+N lagi" instead of running off the bottom.
 *
 * Material's rules for a dark, distant surface, taken as rules:
 *
 *   - Tonal elevation, not borders. Panels are a lighter wash of the same
 *     neutral (--board-surface-1/2); nothing is outlined.
 *   - One tinted container for the one thing the room should look at. The
 *     primary container holds the next visit, or the one happening now.
 *   - A type scale with real steps: display for the clock, headline for the
 *     hero, title for section headers, body for rows.
 *   - Empty states are centred and say what would fill them.
 *   - A week is an agenda with day subheaders, not seven narrow columns.
 */

const STATUS_DOT: Record<string, string> = {
  COMPLETED: "bg-[var(--board-done)]",
  ACCEPTED: "bg-[var(--board-active)]",
  IN_PROGRESS: "bg-[var(--board-running)]",
  CANCELLED: "bg-[var(--board-text-dim)]",
  REJECTED: "bg-[var(--board-text-dim)]",
}

/** Rows that fit a 1080p panel beside the hero and counts. */
const DAY_ROWS = 7
const WEEK_ROWS = 9
const TEAM_ROWS = 7

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2)
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[var(--board-surface-1)] px-5 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--board-surface-2)] text-[var(--board-text-dim)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-[var(--board-text-dim)]">{label}</span>
        <span className="block text-3xl font-bold tabular-nums leading-tight text-[var(--board-text)]">{value}</span>
      </span>
    </div>
  )
}

function Empty({ icon: Icon, title, hint }: { icon: typeof Users; title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--board-surface-2)] text-[var(--board-text-dim)]">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-4 text-xl font-semibold text-[var(--board-text)]">{title}</p>
      <p className="mt-1 max-w-md text-base text-[var(--board-text-dim)]">{hint}</p>
    </div>
  )
}

function More({ count }: { count: number }) {
  if (count <= 0) return null
  return <p className="px-6 py-3 text-base text-[var(--board-text-dim)]">+{count} lagi</p>
}

function Row({ mission, state }: { mission: BoardMission; state: "past" | "now" | "later" }) {
  const done = mission.status === "COMPLETED" || mission.status === "CANCELLED" || mission.status === "REJECTED"
  const now = state === "now" && !done
  return (
    <li
      className={cn(
        "flex items-center gap-5 px-6 py-3",
        now && "bg-[var(--board-primary-container)] text-[var(--board-on-primary-container)]",
        !now && (done || state === "past") && "opacity-60"
      )}
    >
      <span className="w-16 shrink-0 font-mono text-xl font-bold tabular-nums">{mission.time ?? "—"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold">{mission.clientLabel}</span>
        <span className={cn("block truncate text-sm", now ? "text-[var(--board-on-primary-container)]/80" : "text-[var(--board-text-dim)]")}>
          {[mission.primarySalesName, mission.location].filter(Boolean).join(" · ") || mission.missionType}
        </span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-2 text-sm", now ? "text-[var(--board-on-primary-container)]" : "text-[var(--board-text-dim)]")}>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[mission.status] ?? "bg-[var(--board-text-dim)]")} />
        {now ? "Sekarang" : statusLabel(mission.status)}
      </span>
    </li>
  )
}

function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-[var(--board-surface-1)]">
      <h2 className="flex shrink-0 items-center justify-between px-6 py-4 text-xl font-semibold">
        {title}
        <span className="text-sm font-normal text-[var(--board-text-dim)]">{meta}</span>
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
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
  const todayCount = snapshot.days.find((day) => day.isToday)?.missions.length ?? 0

  // Today: the list starts at the first visit that is not over yet, so the
  // rows that fit are the ones that still matter; the past is one line.
  const firstLive = snapshot.missions.findIndex((mission) => stateOf(mission) !== "past")
  const dayStart = Math.max(0, firstLive === -1 ? snapshot.missions.length - DAY_ROWS : Math.min(firstLive, Math.max(0, snapshot.missions.length - DAY_ROWS)))
  const dayRows = snapshot.missions.slice(dayStart, dayStart + DAY_ROWS)
  const dayHidden = snapshot.missions.length - dayRows.length

  // Week: an agenda from today onward, so the screen shows what is ahead.
  const agenda = snapshot.days.filter((day) => day.date >= snapshot.today)
  let budget = WEEK_ROWS
  const weekGroups = agenda.map((day) => {
    const rows = day.missions.slice(0, Math.max(0, budget))
    budget -= rows.length
    return { day, rows, hidden: day.missions.length - rows.length }
  })
  const weekHidden = weekGroups.reduce((sum, group) => sum + group.hidden, 0)

  const team = snapshot.team.slice(0, TEAM_ROWS)

  return (
    <div className="grid h-screen grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-5 overflow-hidden bg-[var(--board-bg)] px-10 py-7 text-[var(--board-text)]">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Mission</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{week ? "Minggu ini di lapangan" : "Hari ini di lapangan"}</h1>
          <p className="mt-0.5 text-base text-[var(--board-text-dim)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-[var(--board-text-dim)]">{dateLabel}</p>
          <p className="text-5xl font-bold tabular-nums leading-none">{clock}</p>
        </div>
      </header>

      {/* The one tinted surface. Nothing else on the screen competes with it. */}
      <section className="rounded-3xl bg-[var(--board-primary-container)] px-7 py-5 text-[var(--board-on-primary-container)]">
        {hero ? (
          <div className="flex items-center gap-8">
            <div className="shrink-0">
              <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{ongoing ? "Sedang berlangsung" : "Berikutnya"}</p>
              <p className="mt-1 font-mono text-5xl font-bold tabular-nums leading-none">{hero.time}</p>
              {week && hero.day !== snapshot.today && (
                <p className="mt-1 text-base opacity-80">{snapshot.days.find((day) => day.date === hero.day)?.label}</p>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-3xl font-bold">{hero.clientLabel}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-lg opacity-90">
                {hero.primarySalesName && (
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {hero.primarySalesName}
                    {hero.supportingSalesNames.length > 0 && ` +${hero.supportingSalesNames.length}`}
                  </span>
                )}
                {hero.location && <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5" />{hero.location}</span>}
                <span className="inline-flex items-center gap-2"><CalendarCheck className="h-5 w-5" />{hero.missionType}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10">
              <CalendarDays className="h-7 w-7" />
            </span>
            <div>
              <p className="text-2xl font-bold">
                {todayCount > 0 ? "Semua kunjungan hari ini selesai" : week ? "Tidak ada kunjungan tersisa minggu ini" : "Tidak ada kunjungan hari ini"}
              </p>
              <p className="mt-0.5 text-base opacity-80">
                {todayCount > 0 ? `${todayCount} kunjungan dijalani hari ini.` : "Kunjungan yang dijadwalkan akan tampil di sini begitu ada."}
              </p>
            </div>
          </div>
        )}
      </section>

      {show("counts") ? (
        <section className="grid grid-cols-4 gap-4">
          <Stat label={week ? "Kunjungan minggu ini" : "Kunjungan hari ini"} value={snapshot.counts.todayTotal} icon={CalendarCheck} />
          <Stat label="Diterima" value={snapshot.counts.accepted} icon={CheckCircle2} />
          <Stat label="Selesai" value={snapshot.counts.completed} icon={CheckCircle2} />
          <Stat label="Mission berjalan" value={snapshot.counts.openMissions} icon={MapPin} />
        </section>
      ) : (
        <div />
      )}

      <section className={cn("grid min-h-0 gap-5", show("schedule") && show("team") ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1")}>
        {show("schedule") && (
          <Panel title={week ? "Jadwal minggu ini" : "Jadwal hari ini"} meta={`${snapshot.missions.length} kunjungan`}>
            {snapshot.missions.length === 0 ? (
              <Empty
                icon={CalendarDays}
                title={week ? "Tidak ada kunjungan minggu ini" : "Tidak ada kunjungan hari ini"}
                hint="Jadwal yang dibuat akan tampil di sini, urut jam."
              />
            ) : !week ? (
              <>
                {dayStart > 0 && <p className="px-6 py-2 text-sm text-[var(--board-text-dim)]">{dayStart} kunjungan sebelumnya selesai</p>}
                <ul className="divide-y divide-[var(--board-line)]">
                  {dayRows.map((mission) => <Row key={mission.id} mission={mission} state={stateOf(mission)} />)}
                </ul>
                <More count={dayHidden - dayStart} />
              </>
            ) : (
              <>
                <ul>
                  {weekGroups.map(({ day, rows }) => (
                    <li key={day.date} className={cn(day.isToday && "bg-[var(--board-surface-2)]")}>
                      <h3 className={cn("flex items-center justify-between px-6 py-1.5 text-sm font-semibold", day.isToday ? "text-[var(--board-accent)]" : "text-[var(--board-text-dim)]")}>
                        <span>{day.label}{day.isToday && " · Hari ini"}</span>
                        <span className="font-normal">{day.missions.length > 0 ? `${day.missions.length} kunjungan` : "Kosong"}</span>
                      </h3>
                      {rows.length > 0 && (
                        <ul className="divide-y divide-[var(--board-line)]">
                          {rows.map((mission) => <Row key={mission.id} mission={mission} state={stateOf(mission)} />)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <More count={weekHidden} />
              </>
            )}
          </Panel>
        )}

        {show("team") && (
          <Panel title="Tim di lapangan" meta={`${snapshot.team.length} orang`}>
            {snapshot.team.length > 0 ? (
              <>
                <ul className="divide-y divide-[var(--board-line)]">
                  {team.map((member) => (
                    <li key={member.name} className="flex items-center gap-4 px-6 py-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--board-surface-2)] text-sm font-bold">{initials(member.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-semibold">{member.name}</span>
                        <span className="block truncate text-sm text-[var(--board-text-dim)]">
                          {member.next ? `Berikutnya ${member.next}` : "Semua kunjungan selesai"}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--board-surface-2)] px-3 py-1 font-mono text-sm tabular-nums text-[var(--board-text-dim)]">{member.missionCount}</span>
                    </li>
                  ))}
                </ul>
                <More count={snapshot.team.length - team.length} />
              </>
            ) : (
              <Empty icon={Users} title={week ? "Belum ada yang bertugas minggu ini" : "Belum ada yang bertugas hari ini"} hint="Setiap sales dengan kunjungan muncul di sini beserta tujuan berikutnya." />
            )}
          </Panel>
        )}
      </section>
    </div>
  )
}
