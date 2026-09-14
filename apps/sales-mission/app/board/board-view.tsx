import { CalendarCheck, CheckCircle2, MapPin, Users } from "lucide-react"
import type { BoardSnapshot } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { cn } from "@/lib/utils"

/**
 * The screen. Read from across a room: large type, high contrast, no
 * interaction. Masking has already happened upstream — this renders whatever
 * labels it is handed and never decides what to hide.
 *
 * Colours come from the --board-* tokens in globals.css rather than raw hex,
 * so the board is a declared surface of the design system instead of a third
 * colour scheme living inside one component. The dashboard inside the app is
 * a different component on the app's own tokens; only the data is shared.
 */

const STATUS_TONES: Record<string, string> = {
  COMPLETED: "bg-[var(--board-done-surface)] text-[var(--board-done)]",
  ACCEPTED: "bg-[var(--board-active-surface)] text-[var(--board-active)]",
  IN_PROGRESS: "bg-[var(--board-running-surface)] text-[var(--board-running)]",
  ASSIGNED: "bg-[var(--board-line)] text-[var(--board-text-dim)]",
  SCHEDULED: "bg-[var(--board-line)] text-[var(--board-text-dim)]",
  CANCELLED: "bg-[var(--board-line)] text-[var(--board-text-dim)] line-through",
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-2xl bg-[var(--board-panel-raised)] px-6 py-5">
      <div className="flex items-center gap-2.5 text-[var(--board-text-dim)]">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-3 text-5xl font-bold tabular-nums text-[var(--board-text)]">{value}</p>
    </div>
  )
}

function MissionRow({ mission, compact = false }: { mission: BoardSnapshot["missions"][number]; compact?: boolean }) {
  return (
    <li className={cn("flex items-center gap-4 px-5", compact ? "py-2.5" : "gap-5 px-6 py-4")}>
      <span className={cn("shrink-0 font-mono font-bold tabular-nums", compact ? "w-14 text-lg" : "w-20 text-2xl")}>
        {mission.time ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold", compact ? "text-base" : "text-xl")}>{mission.clientLabel}</span>
        <span className={cn("block truncate text-[var(--board-text-dim)]", compact ? "text-sm" : "text-base")}>
          {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full font-semibold",
          compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
          STATUS_TONES[mission.status] ?? "bg-[var(--board-line)] text-[var(--board-text-dim)]"
        )}
      >
        {statusLabel(mission.status)}
      </span>
    </li>
  )
}

export function BoardView({
  snapshot,
  subtitle,
  now,
  panels,
}: {
  snapshot: BoardSnapshot
  subtitle: string
  now: Date
  panels: BoardPanel[]
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
  const title = week ? "Papan lapangan minggu ini" : "Papan lapangan hari ini"

  return (
    <div className="min-h-screen bg-[var(--board-bg)] px-8 py-8 text-[var(--board-text)]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Mission</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-lg text-[var(--board-text-dim)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-[var(--board-text-dim)]">{dateLabel}</p>
          <p className="font-mono text-4xl font-bold tabular-nums">{clock}</p>
        </div>
      </header>

      {show("counts") && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={week ? "Mission minggu ini" : "Mission hari ini"} value={snapshot.counts.todayTotal} icon={CalendarCheck} />
          <Stat label="Diterima" value={snapshot.counts.accepted} icon={CheckCircle2} />
          <Stat label="Selesai" value={snapshot.counts.completed} icon={CheckCircle2} />
          <Stat label="Mission berjalan" value={snapshot.counts.openMissions} icon={MapPin} />
        </section>
      )}

      <section className={cn("mt-8 grid gap-6", show("schedule") && show("team") && "xl:grid-cols-[2fr_1fr]")}>
        {show("schedule") && !week && (
          <div className="overflow-hidden rounded-2xl bg-[var(--board-panel)]">
            <h2 className="border-b border-[var(--board-line)] px-6 py-4 text-xl font-semibold">Jadwal hari ini</h2>
            {snapshot.missions.length > 0 ? (
              <ul className="divide-y divide-[var(--board-line)]">
                {snapshot.missions.map((mission) => <MissionRow key={mission.id} mission={mission} />)}
              </ul>
            ) : (
              <p className="px-6 py-10 text-xl text-[var(--board-text-dim)]">Tidak ada mission terjadwal hari ini.</p>
            )}
          </div>
        )}

        {show("schedule") && week && (
          /*
            A week on a screen is seven columns, the way every wall calendar is
            read: today's column is lifted so the eye lands there first.
          */
          <div className="grid gap-3 md:grid-cols-7">
            {snapshot.days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "overflow-hidden rounded-2xl bg-[var(--board-panel)]",
                  day.isToday && "bg-[var(--board-panel-raised)] ring-2 ring-[var(--board-accent)]"
                )}
              >
                <h2 className={cn("border-b border-[var(--board-line)] px-4 py-3 text-base font-semibold", day.isToday && "text-[var(--board-accent)]")}>
                  {day.label}
                  <span className="ml-2 font-mono text-sm text-[var(--board-text-dim)]">{day.missions.length}</span>
                </h2>
                {day.missions.length > 0 ? (
                  <ul className="divide-y divide-[var(--board-line)]">
                    {day.missions.map((mission) => <MissionRow key={mission.id} mission={mission} compact />)}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-sm text-[var(--board-text-dim)]">Kosong</p>
                )}
              </div>
            ))}
          </div>
        )}

        {show("team") && (
          <div className="overflow-hidden rounded-2xl bg-[var(--board-panel)]">
            <h2 className="border-b border-[var(--board-line)] px-6 py-4 text-xl font-semibold">Tim di lapangan</h2>
            {snapshot.team.length > 0 ? (
              <ul className="divide-y divide-[var(--board-line)]">
                {snapshot.team.map((member) => (
                  <li key={member.name} className="flex items-center gap-4 px-6 py-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--board-line)] text-base font-bold">
                      {member.name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{member.name}</span>
                      <span className="block truncate text-sm text-[var(--board-text-dim)]">
                        {member.next ? `Berikutnya ${member.next}` : "Semua kunjungan selesai"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-lg tabular-nums text-[var(--board-text-dim)]">{member.missionCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-10 text-xl text-[var(--board-text-dim)]">
                {week ? "Belum ada yang bertugas minggu ini." : "Belum ada yang bertugas hari ini."}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
