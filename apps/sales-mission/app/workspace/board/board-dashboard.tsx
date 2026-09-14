import Link from "next/link"
import { CalendarCheck, CheckCircle2, ClipboardList, MapPin } from "lucide-react"
import type { BoardMission, BoardSnapshot } from "@/lib/board/board-snapshot"
import type { BoardPanel } from "@/lib/board/board-options"
import { describeAudit, groupAuditEvents, type AuditRow } from "@/lib/audit/describe-audit"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusBadge } from "@/app/workspace/workspace-page"
import { cn } from "@/lib/utils"

/**
 * The board inside the app.
 *
 * Same data as the screen, on the app's own surfaces: page tone under cards,
 * the type scale every other page uses, status as a dot and a label. This
 * is a dashboard read at arm's length by someone who can click, so it links
 * into missions and shows the activity feed the screen leaves out.
 */

const DAY_START = 7 * 60
const DAY_END = 19 * 60
const PX_PER_HOUR = 40

function Metric({ icon: Icon, label, value, tone }: { icon: typeof ClipboardList; label: string; value: number; tone: string }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}>
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block text-2xl font-bold tabular-nums text-foreground">{value}</span>
      </span>
    </article>
  )
}

function toLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:00`
}

/** One day as an hour timeline; each visit a block placed by its minutes. */
function DayTimeline({ missions, nowMinute, isToday }: { missions: BoardMission[]; nowMinute: number; isToday: boolean }) {
  const hours = (DAY_END - DAY_START) / 60
  // Overlapping visits share the width, side by side, so two reps at 10:00
  // both stay readable instead of one hiding the other.
  const lanes: BoardMission[][] = []
  for (const mission of missions) {
    const lane = lanes.find((items) => items.every((item) => item.endMinute <= mission.startMinute || item.startMinute >= mission.endMinute))
    if (lane) lane.push(mission)
    else lanes.push([mission])
  }
  const laneOf = new Map<string, number>()
  lanes.forEach((lane, index) => lane.forEach((mission) => laneOf.set(mission.id, index)))
  const laneCount = Math.max(1, lanes.length)

  return (
    <div className="relative" style={{ height: hours * PX_PER_HOUR }}>
      {Array.from({ length: hours + 1 }, (_, index) => {
        const minute = DAY_START + index * 60
        return (
          <div key={minute} className="absolute left-0 right-0 border-t border-border/60" style={{ top: index * PX_PER_HOUR }}>
            <span className="absolute -top-2 left-0 w-10 text-[10px] tabular-nums text-muted-foreground">{toLabel(minute)}</span>
          </div>
        )
      })}
      {isToday && nowMinute >= DAY_START && nowMinute <= DAY_END && (
        <div aria-hidden="true" className="absolute left-10 right-0 z-10 border-t-2 border-[var(--danger-foreground)]" style={{ top: ((nowMinute - DAY_START) / 60) * PX_PER_HOUR }}>
          <span className="absolute -left-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--danger-foreground)]" />
        </div>
      )}
      {missions.map((mission) => {
        const top = ((Math.max(mission.startMinute, DAY_START) - DAY_START) / 60) * PX_PER_HOUR
        const height = ((Math.min(mission.endMinute, DAY_END) - Math.max(mission.startMinute, DAY_START)) / 60) * PX_PER_HOUR
        if (height <= 0) return null
        const lane = laneOf.get(mission.id) ?? 0
        const done = mission.status === "COMPLETED" || mission.status === "CANCELLED"
        return (
          <Link
            key={mission.id}
            href={`/workspace/missions/${mission.id}`}
            className={cn(
              "absolute overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight transition-colors hover:brightness-95",
              done ? "border-border bg-muted text-muted-foreground" : "border-primary/40 bg-primary/10 text-foreground"
            )}
            style={{
              top,
              height: Math.max(height, 24),
              left: `calc(2.75rem + ${(lane / laneCount) * 100}% - ${(lane / laneCount) * 2.75}rem)`,
              width: `calc(${100 / laneCount}% - ${2.75 / laneCount}rem - 4px)`,
            }}
          >
            <span className="block truncate font-semibold">{mission.time} · {mission.clientLabel}</span>
            {height >= 36 && (
              <span className="block truncate text-muted-foreground">
                {[mission.primarySalesName, mission.location].filter(Boolean).join(" · ")}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

export function BoardDashboard({
  snapshot,
  panels,
  activity,
  people,
  now,
}: {
  snapshot: BoardSnapshot
  panels: BoardPanel[]
  activity: AuditRow[]
  people: Array<{ name: string; avatarUrl: string | null }>
  now: Date
}) {
  const show = (panel: BoardPanel) => panels.includes(panel)
  const week = snapshot.range === "week"
  const nowMinute = minuteOfDay(now)
  const avatar = (name: string) => people.find((person) => person.name === name)?.avatarUrl ?? null
  const events = groupAuditEvents(activity).slice(0, 8)

  return (
    <div className="space-y-4">
      {show("counts") && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan">
          <Metric icon={CalendarCheck} label={week ? "Mission minggu ini" : "Mission hari ini"} value={snapshot.counts.todayTotal} tone="bg-primary/10 text-primary" />
          <Metric icon={CheckCircle2} label="Diterima" value={snapshot.counts.accepted} tone="bg-[var(--success)] text-[var(--success-foreground)]" />
          <Metric icon={CheckCircle2} label="Selesai" value={snapshot.counts.completed} tone="bg-[var(--success)] text-[var(--success-foreground)]" />
          <Metric icon={MapPin} label="Mission berjalan" value={snapshot.counts.openMissions} tone="bg-[var(--warning)] text-[var(--warning-foreground)]" />
        </section>
      )}

      <section className={cn("grid gap-4", show("schedule") && show("team") && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        {show("schedule") && (
          <article className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">{week ? "Jadwal minggu ini" : "Jadwal hari ini"}</h2>
              <span className="text-xs text-muted-foreground">{snapshot.missions.length} kunjungan</span>
            </header>
            {!week ? (
              snapshot.missions.length > 0 ? (
                <div className="px-5 py-5">
                  <DayTimeline missions={snapshot.missions} nowMinute={nowMinute} isToday />
                </div>
              ) : (
                <p className="px-5 py-10 text-sm text-muted-foreground">Tidak ada mission terjadwal hari ini.</p>
              )
            ) : (
              <div className="grid divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
                {snapshot.days.map((day) => (
                  <div key={day.date} className={cn("min-w-0", day.isToday && "bg-primary/5")}>
                    <h3 className={cn("border-b px-3 py-2 text-xs font-semibold", day.isToday ? "text-primary" : "text-muted-foreground")}>
                      {day.label} <span className="ml-1 tabular-nums">{day.missions.length}</span>
                    </h3>
                    <ul className="space-y-1.5 p-2">
                      {day.missions.map((mission) => (
                        <li key={mission.id}>
                          <Link
                            href={`/workspace/missions/${mission.id}`}
                            className="block rounded-md border bg-card px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
                          >
                            <span className="block truncate font-semibold text-foreground">{mission.time} · {mission.clientLabel}</span>
                            <span className="block truncate text-muted-foreground">{mission.primarySalesName ?? mission.location ?? mission.missionType}</span>
                          </Link>
                        </li>
                      ))}
                      {day.missions.length === 0 && <li className="px-2 py-3 text-xs text-muted-foreground">Kosong</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {show("team") && (
          <aside className="overflow-hidden rounded-xl border bg-card">
            <header className="border-b px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Tim di lapangan</h2>
            </header>
            {snapshot.team.length > 0 ? (
              <ul className="divide-y">
                {snapshot.team.map((member) => (
                  <li key={member.name} className="flex items-center gap-3 px-5 py-3">
                    <PersonAvatar name={member.name} avatarUrl={avatar(member.name)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.next ? `Berikutnya ${member.next}` : "Semua kunjungan selesai"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{member.missionCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-sm text-muted-foreground">{week ? "Belum ada yang bertugas minggu ini." : "Belum ada yang bertugas hari ini."}</p>
            )}
          </aside>
        )}
      </section>

      {show("activity") && (
        <article className="overflow-hidden rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Aktivitas terbaru</h2>
            <Link href="/workspace/settings/activity" className="text-xs font-semibold text-primary hover:underline">Lihat semua</Link>
          </header>
          {events.length > 0 ? (
            <ul className="divide-y">
              {events.map((event) => {
                const described = describeAudit(event.lead)
                return (
                  <li key={event.lead.txId} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1 text-foreground">
                      <span className="font-semibold">{event.lead.actorName ?? "Sistem"}</span> {described.sentence}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(event.lead.createdAt)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
          )}
        </article>
      )}

      {/* A status legend keeps the timeline honest about what its tones mean. */}
      {show("schedule") && !week && snapshot.missions.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-primary/40 bg-primary/10" /> Terjadwal</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border bg-muted" /> Selesai atau dibatalkan</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[var(--danger-foreground)]" /> Sekarang</span>
          <span className="ml-auto inline-flex items-center gap-2"><StatusBadge status="ACCEPTED" /> dipakai di daftar mission</span>
        </p>
      )}
    </div>
  )
}
