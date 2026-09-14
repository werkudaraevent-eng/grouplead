import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, CheckCircle2, ClipboardList, MapPin } from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings, getMissionSummary, listMissions } from "@/lib/missions/mission-queries"
import { needsMyAnswer } from "@/lib/missions/mission-filter"
import { reportOwed, visitState } from "@/lib/missions/visit-state"
import { Button } from "@/components/ui/button"
import type { ConfirmationPolicy } from "@/lib/missions/assignment-workflow"
import { AcceptAssignmentButton, AssignmentOverflowMenu } from "@/app/workspace/missions/assignment-actions-menu"
import { cn } from "@/lib/utils"
import {
  MISSION_TIME_ZONE,
  formatMissionSchedule,
  formatMissionTime,
  type MissionListItem,
} from "@/lib/missions/mission-schema"
import { missionDayKey, missionsOnDay } from "@/lib/missions/mission-calendar"
import { EmptyState, NewMissionAction, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

/**
 * "Hari ini" — the field rep's landing screen.
 *
 * This used to open on a row of stat cards, which answers a manager's question
 * ("how many missions are open") to someone standing outside a client's office
 * asking their own ("where am I going next"). Today's visits now lead as large
 * tap targets; the counts stay, demoted to a strip at the bottom for the
 * appointment team and admins who do want them.
 */

/**
 * Today's visit: sized for a thumb, read at arm's length.
 *
 * When the visit still needs the rep's answer, the answer is on the card. A
 * rep standing outside the client's office should not have to open a page and
 * scroll to say yes to the visit they are about to make.
 */
function TodayCard({ mission, policy }: { mission: MissionListItem; policy: ConfirmationPolicy }) {
  const people = [mission.primarySalesName ?? "Belum ditugaskan"]
  if (mission.supportingCount > 0) people.push(`+${mission.supportingCount} tim`)
  const asksMe = needsMyAnswer(mission, policy)

  return (
    <div
      className={cn(
        "rounded-xl border bg-card",
        asksMe && "border-l-4 border-l-[var(--warning-foreground)]"
      )}
    >
      <Link
        href={`/workspace/missions/${mission.id}`}
        className="flex gap-4 p-4 transition-colors hover:bg-muted/50 sm:p-5"
      >
        <span className="shrink-0 text-2xl font-bold tabular-nums text-primary sm:text-3xl">
          {formatMissionTime(mission.scheduledStart)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="block min-w-0 truncate text-base font-semibold text-foreground">
              {mission.clientCompanyName}
            </span>
            <StatusBadge status={mission.status} />
          </span>

          <span className="mt-1 block truncate text-sm text-muted-foreground">{mission.missionType}</span>

          {mission.location && (
            <span className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{mission.location}</span>
            </span>
          )}

          <span className="mt-1 block truncate text-sm text-muted-foreground">{people.join(" · ")}</span>
        </span>
      </Link>

      {asksMe && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <span className="text-sm font-medium text-[var(--warning-foreground)]">Menunggu jawabanmu</span>
          <span className="flex items-center gap-2">
            <AssignmentOverflowMenu missionId={mission.id} />
            <AcceptAssignmentButton missionId={mission.id} size="default" className="h-11" />
          </span>
        </div>
      )}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList
  label: string
  value: number
  tone: string
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold tabular-nums text-foreground">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </article>
  )
}

export default async function MissionHomePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  const [canRead, canCreate] = await Promise.all([
    canPerform(access, "sales_mission_mission", "read"),
    canPerform(access, "sales_mission_mission", "create"),
  ])

  // This page is where requireModule sends anyone refused elsewhere, so it can
  // never guard itself — the redirect would loop. It checks the permission by
  // hand instead and skips the queries entirely: a role without mission access
  // being bounced here onto a list of every mission in the tenant would undo
  // the guard that sent them.
  if (!canRead) {
    return (
      <WorkspacePage eyebrow="Sales Mission" title="Hari ini" description={dateLabel}>
        <EmptyState
          title="Mission tidak termasuk akses Anda"
          description="Peran Anda tidak mencakup jadwal kunjungan. Menu lain di samping tetap bisa dibuka."
        />
      </WorkspacePage>
    )
  }

  // Two months back covers every report anyone could still owe, and forward
  // is open so "berikutnya" is never cut off.
  const [summary, missions, settings] = await Promise.all([
    getMissionSummary(access),
    listMissions(access, { since: new Date(now.getTime() - 60 * 86_400_000) }),
    getMissionSettings(access),
  ])
  const today = missionDayKey(now)

  // Same day-bucketing the calendar uses, so "today" means the same thing in
  // both places — Jakarta wall-clock, not the server's timezone.
  const todaysMissions = missionsOnDay(missions, today)

  // Everything still ahead, minus today's, which already lead the page.
  // Compare as instants: scheduled_start ends in "+00:00" while toISOString()
  // ends in "Z", so a string comparison would not agree.
  const nowMs = now.getTime()
  const scheduled = missions.filter((mission) => mission.scheduledStart !== null)
  const upcoming = scheduled
    .filter(
      (mission) =>
        Date.parse(mission.scheduledStart as string) >= nowMs &&
        missionDayKey(new Date(mission.scheduledStart as string)) !== today
    )
    .slice(0, 5)

  // Visits that happened and were not written down, for whoever writes them.
  // Sorted oldest first: the one from last week is the one to chase.
  const owedReports = missions
    .filter((mission) => reportOwed(visitState(mission, now)) && (mission.viewerRole === "PRIMARY" || access.isSuperAdmin))
    .sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""))
    .slice(0, 8)

  // Owed answers on visits other than today's, which already carry the button.
  const awaiting = missions.filter(
    (mission) => needsMyAnswer(mission, settings) && !todaysMissions.some((item) => item.id === mission.id)
  )

  return (
    <WorkspacePage
      eyebrow="Sales Mission"
      title="Hari ini"
      description={dateLabel}
      action={canCreate ? <NewMissionAction /> : undefined}
    >
      <section aria-label="Mission hari ini">
        {todaysMissions.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {todaysMissions.map((mission) => (
              <TodayCard key={mission.id} mission={mission} policy={settings} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center" role="status">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <CalendarDays className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base font-semibold text-foreground">Tidak ada kunjungan hari ini</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {upcoming.length > 0
                ? "Jadwal terdekatmu ada di bawah."
                : canCreate
                  ? "Belum ada jadwal yang akan datang. Rencanakan kunjungan berikutnya."
                  : "Belum ada jadwal yang akan datang untukmu."}
            </p>
          </div>
        )}
      </section>

      {/*
        Answers owed on visits that are not today. Today's carry the button on
        their own card; these would otherwise be a chip in a list two clicks
        away, which is how a Tuesday visit stayed unanswered until Tuesday.
      */}
      {owedReports.length > 0 && (
        <section className="mt-6" aria-label="Laporan tertunda">
          <h2 className="mb-2 text-base font-semibold text-foreground">Laporan tertunda</h2>
          <div className="overflow-hidden rounded-xl border border-l-4 border-l-[var(--warning-foreground)] bg-card">
            <div className="divide-y">
              {owedReports.map((mission) => (
                <div key={mission.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <Link href={`/workspace/missions/${mission.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {formatMissionSchedule(mission.scheduledStart, now)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                  <Button asChild size="sm" className="sm:self-center">
                    <Link href={`/workspace/missions/${mission.id}/report`}>
                      <ClipboardList className="h-4 w-4" /> {mission.reportStatus === "NONE" ? "Isi laporan" : "Lanjutkan laporan"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="mt-6" aria-label="Penugasan menunggu jawaban">
          <h2 className="mb-2 text-base font-semibold text-foreground">Menunggu jawabanmu</h2>
          <div className="overflow-hidden rounded-xl border border-l-4 border-l-[var(--warning-foreground)] bg-card">
            <div className="divide-y">
              {awaiting.map((mission) => (
                <div key={mission.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <Link href={`/workspace/missions/${mission.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {formatMissionSchedule(mission.scheduledStart, now)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[mission.location, mission.missionType].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                  <span className="flex items-center justify-end gap-2">
                    <AssignmentOverflowMenu missionId={mission.id} />
                    <AcceptAssignmentButton missionId={mission.id} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6" aria-label="Mission berikutnya">
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Berikutnya</h2>
            <Link
              href="/workspace/missions"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Semua mission
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="divide-y">
              {upcoming.map((mission) => (
                <Link
                  key={mission.id}
                  href={`/workspace/missions/${mission.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5"
                >
                  <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMissionSchedule(mission.scheduledStart, now)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {mission.clientCompanyName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") ||
                        mission.missionType}
                    </span>
                  </span>
                  <StatusBadge status={mission.status} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mt-6" aria-label="Ringkasan mission">
        <h2 className="mb-2 text-base font-semibold text-foreground">Ringkasan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            icon={ClipboardList}
            label="Mission berjalan"
            value={summary.open}
            tone="bg-primary/10 text-primary"
          />
          <Metric
            icon={CalendarDays}
            label="Terjadwal hari ini"
            value={summary.today}
            tone="bg-[var(--warning)] text-[var(--warning-foreground)]"
          />
          <Metric
            icon={CheckCircle2}
            label="Selesai"
            value={summary.completed}
            tone="bg-[var(--success)] text-[var(--success-foreground)]"
          />
        </div>
      </section>
    </WorkspacePage>
  )
}
