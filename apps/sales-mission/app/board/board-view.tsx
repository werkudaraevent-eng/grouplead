import { CalendarCheck, CalendarDays, CheckCircle2, MapPin, Users } from "@/components/icons"
import type { BoardMission, BoardSnapshot } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"
import { FitList, type FitItem } from "./fit-list"

/**
 * The screen. Read from across a room: large type, high contrast, no
 * interaction, and it never scrolls. A wall display has nobody to scroll
 * it, so the layout is a fixed viewport: header, hero and counts take what
 * they need, the panels take the rest. A panel with more rows than fit
 * turns pages on a timer (see FitList) instead of clipping or spilling.
 *
 * Material's rules for a dark, distant surface, taken as rules:
 *
 *   - Tonal elevation, not borders. Panels are a lighter wash of the same
 *     neutral (--board-surface-1/2); nothing is outlined, nothing casts a
 *     shadow. Large shape (24dp) on panels, full round on the small chips.
 *   - One tinted container for the one thing the room should look at. The
 *     primary container holds the next visit, or the one happening now.
 *   - A type scale with real steps: display for the clock, headline for the
 *     hero, title for section headers, body for rows. The steps shrink
 *     together on a short screen so the composition holds at 720p.
 *   - Status is a dot and a word, never a pill; a time is a mono chip.
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

/** Row heights the FitList paginates by. The rows below render at exactly these. */
const ROW = 68
const SUBHEADER = 40
const TEAM_ROW = 68

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

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Users; tone: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[var(--board-surface-1)] px-5 py-3 [@media(max-height:820px)]:py-2">
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full [@media(max-height:820px)]:h-9 [@media(max-height:820px)]:w-9", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-[var(--board-text-dim)]">{label}</span>
        <span className="block text-3xl font-bold tabular-nums leading-tight text-[var(--board-text)] [@media(max-height:820px)]:text-2xl">{value}</span>
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

function Row({ mission, state }: { mission: BoardMission; state: "past" | "now" | "later" }) {
  const done = mission.status === "COMPLETED" || mission.status === "CANCELLED" || mission.status === "REJECTED"
  const now = state === "now" && !done
  return (
    <div
      className={cn(
        "flex h-full items-center gap-5 border-b border-[var(--board-line)] px-6",
        now && "rounded-xl border-transparent bg-[var(--board-primary-container)] text-[var(--board-on-primary-container)]",
        !now && (done || state === "past") && "opacity-55"
      )}
    >
      <span className={cn("inline-flex h-9 w-[4.5rem] shrink-0 items-center justify-center rounded-full font-mono text-lg font-bold tabular-nums", now ? "bg-white/15" : "bg-[var(--board-surface-2)]")}>
        {mission.time ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold leading-tight">{mission.clientLabel}</span>
        <span className={cn("block truncate text-sm", now ? "text-[var(--board-on-primary-container)]/80" : "text-[var(--board-text-dim)]")}>
          {[mission.primarySalesName, mission.location].filter(Boolean).join(" · ") || mission.missionType}
        </span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-2 text-sm", now ? "text-[var(--board-on-primary-container)]" : "text-[var(--board-text-dim)]")}>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", now ? "bg-[var(--board-running)]" : STATUS_DOT[mission.status] ?? "bg-[var(--board-text-dim)]")} />
        {now ? "Sekarang" : statusLabel(mission.status)}
      </span>
    </div>
  )
}

function DayHeader({ label, isToday, count }: { label: string; isToday: boolean; count: number }) {
  return (
    <div className={cn("flex h-full items-center justify-between px-6 text-sm font-semibold", isToday ? "bg-[var(--board-surface-2)] text-[var(--board-accent)]" : "text-[var(--board-text-dim)]")}>
      <span>{label}{isToday && " · Hari ini"}</span>
      <span className="font-normal">{count > 0 ? `${count} kunjungan` : "Kosong"}</span>
    </div>
  )
}

function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-[var(--board-surface-1)]">
      <h2 className="flex shrink-0 items-center justify-between px-6 py-4 text-xl font-semibold [@media(max-height:820px)]:py-3">
        {title}
        <span className="text-sm font-normal text-[var(--board-text-dim)]">{meta}</span>
      </h2>
      <div className="min-h-0 flex-1">{children}</div>
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

  // Today: the visits in order, the ones already over dimmed at the top.
  const dayItems: FitItem[] = snapshot.missions.map((mission) => ({ key: mission.id, height: ROW, node: <Row mission={mission} state={stateOf(mission)} /> }))

  // Week: an agenda from today onward, a subheader per day.
  const weekItems: FitItem[] = snapshot.days
    .filter((day) => day.date >= snapshot.today)
    .flatMap((day) => [
      { key: `day-${day.date}`, height: SUBHEADER, node: <DayHeader label={day.label} isToday={day.isToday} count={day.missions.length} /> },
      ...day.missions.map((mission) => ({ key: mission.id, height: ROW, node: <Row mission={mission} state={stateOf(mission)} /> })),
    ])

  const teamItems: FitItem[] = snapshot.team.map((member) => ({
    key: member.name,
    height: TEAM_ROW,
    node: (
      <div className="flex h-full items-center gap-4 border-b border-[var(--board-line)] px-6">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold", avatarTone(member.name))}>{initials(member.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold leading-tight">{member.name}</span>
          <span className="block truncate text-sm text-[var(--board-text-dim)]">
            {member.next ? `Berikutnya ${member.next}` : "Semua kunjungan selesai"}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[var(--board-surface-2)] px-3 py-1 font-mono text-sm tabular-nums text-[var(--board-text-dim)]">{member.missionCount}</span>
      </div>
    ),
  }))

  return (
    <div className="grid h-dvh grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-5 overflow-hidden bg-[var(--board-bg)] px-10 py-7 text-[var(--board-text)] [@media(max-height:820px)]:gap-4 [@media(max-height:820px)]:px-8 [@media(max-height:820px)]:py-5">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Activity</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight [@media(max-height:820px)]:text-2xl">{week ? "Minggu ini di lapangan" : "Hari ini di lapangan"}</h1>
          <p className="mt-0.5 text-base text-[var(--board-text-dim)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-[var(--board-text-dim)]">{dateLabel}</p>
          <p className="text-5xl font-bold tabular-nums leading-none [@media(max-height:820px)]:text-4xl">{clock}</p>
        </div>
      </header>

      {/* The one tinted surface. Nothing else on the screen competes with it. */}
      <section className="rounded-3xl bg-[var(--board-primary-container)] px-7 py-5 text-[var(--board-on-primary-container)] [@media(max-height:820px)]:py-4">
        {hero ? (
          <div className="flex items-center gap-8">
            <div className="shrink-0">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest opacity-80">
                {ongoing && <span aria-hidden="true" className="board-pulse h-2.5 w-2.5 rounded-full bg-[var(--board-running)]" />}
                {ongoing ? "Sedang berlangsung" : "Berikutnya"}
              </p>
              <p className="mt-1 font-mono text-5xl font-bold tabular-nums leading-none [@media(max-height:820px)]:text-4xl">{hero.time}</p>
              {week && hero.day !== snapshot.today && (
                <p className="mt-1 text-base opacity-80">{snapshot.days.find((day) => day.date === hero.day)?.label}</p>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-3xl font-bold [@media(max-height:820px)]:text-2xl">{hero.clientLabel}</p>
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
          <Stat label={week ? "Kunjungan minggu ini" : "Kunjungan hari ini"} value={snapshot.counts.todayTotal} icon={CalendarCheck} tone="bg-[var(--board-active-surface)] text-[var(--board-active)]" />
          <Stat label="Diterima" value={snapshot.counts.accepted} icon={CheckCircle2} tone="bg-[var(--board-active-surface)] text-[var(--board-active)]" />
          <Stat label="Selesai" value={snapshot.counts.completed} icon={CheckCircle2} tone="bg-[var(--board-done-surface)] text-[var(--board-done)]" />
          <Stat label="Aktivitas berjalan" value={snapshot.counts.openMissions} icon={MapPin} tone="bg-[var(--board-running-surface)] text-[var(--board-running)]" />
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
            ) : (
              <FitList id={`schedule-${snapshot.range}`} items={week ? weekItems : dayItems} />
            )}
          </Panel>
        )}

        {show("team") && (
          <Panel title="Tim di lapangan" meta={`${snapshot.team.length} orang`}>
            {snapshot.team.length > 0 ? (
              <FitList id="team" items={teamItems} />
            ) : (
              <Empty icon={Users} title={week ? "Belum ada yang bertugas minggu ini" : "Belum ada yang bertugas hari ini"} hint="Setiap sales dengan kunjungan muncul di sini beserta tujuan berikutnya." />
            )}
          </Panel>
        )}
      </section>
    </div>
  )
}
