import { CalendarCheck, CheckCircle2, MapPin, Users } from "lucide-react"
import type { BoardSnapshot } from "@/lib/board/board-snapshot"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * Shared board rendering for both the TV and the internal view.
 *
 * Sized for a screen read from across a room: large type, high contrast, no
 * interaction. Masking has already happened upstream — this component renders
 * whatever labels it is handed and never decides what to hide.
 */

const STATUS_TONES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-300",
  ACCEPTED: "bg-sky-500/15 text-sky-300",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300",
  ASSIGNED: "bg-white/10 text-white/70",
  SCHEDULED: "bg-white/10 text-white/70",
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-6 py-5">
      <div className="flex items-center gap-2.5 text-white/60">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-3 text-5xl font-bold tabular-nums text-white">{value}</p>
    </div>
  )
}

export function BoardView({
  snapshot,
  subtitle,
  now,
}: {
  snapshot: BoardSnapshot
  subtitle: string
  now: Date
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

  return (
    <div className="min-h-screen bg-[#0d1117] px-8 py-8 text-white">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F9BB46]">Sales Mission</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Papan lapangan hari ini</h1>
          <p className="mt-1 text-lg text-white/50">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-white/60">{dateLabel}</p>
          <p className="font-mono text-4xl font-bold tabular-nums">{clock}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Mission hari ini" value={snapshot.counts.todayTotal} icon={CalendarCheck} />
        <Stat label="Diterima" value={snapshot.counts.accepted} icon={CheckCircle2} />
        <Stat label="Selesai" value={snapshot.counts.completed} icon={CheckCircle2} />
        <Stat label="Mission berjalan" value={snapshot.counts.openMissions} icon={MapPin} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
          <h2 className="border-b border-white/10 px-6 py-4 text-xl font-semibold">Jadwal hari ini</h2>

          {snapshot.missions.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {snapshot.missions.map((mission) => (
                <li key={mission.id} className="flex items-center gap-5 px-6 py-4">
                  <span className="w-20 shrink-0 font-mono text-2xl font-bold tabular-nums text-white/90">
                    {mission.time ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xl font-semibold">{mission.clientLabel}</span>
                    <span className="block truncate text-base text-white/50">
                      {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold uppercase tracking-wide",
                      STATUS_TONES[mission.status] ?? "bg-white/10 text-white/70"
                    )}
                  >
                    {mission.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-10 text-xl text-white/40">Tidak ada mission terjadwal hari ini.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
          <h2 className="border-b border-white/10 px-6 py-4 text-xl font-semibold">Tim di lapangan</h2>

          {snapshot.team.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {snapshot.team.map((member) => (
                <li key={member.name} className="flex items-center gap-4 px-6 py-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-base font-bold">
                    {member.name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">{member.name}</span>
                  <span className="shrink-0 font-mono text-lg tabular-nums text-white/60">
                    {member.missionCount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-10 text-xl text-white/40">Belum ada yang bertugas hari ini.</p>
          )}
        </div>
      </section>
    </div>
  )
}
