import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, Plus } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSummary, listMissions } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { NewMissionAction, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

function MetricCard({
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
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-[17px] w-[17px]" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </article>
  )
}

const QUICK_LINKS = [
  { href: "/workspace/missions/new", icon: Plus, title: "Plan a mission", hint: "Schedule a confirmed visit", tone: "bg-primary/10 text-primary" },
  { href: "/workspace/missions", icon: ClipboardList, title: "Review missions", hint: "Track planned visits", tone: "bg-[var(--warning)] text-[var(--warning-foreground)]" },
  { href: "/workspace/calendar", icon: CalendarDays, title: "View calendar", hint: "See your field schedule", tone: "bg-[var(--success)] text-[var(--success-foreground)]" },
]

export default async function MissionHomePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [summary, missions] = await Promise.all([getMissionSummary(access), listMissions(access)])
  const now = new Date()
  const upcoming = missions.filter((mission) => mission.scheduledStart).slice(0, 5)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Overview"
      title="Mission workspace"
      description="Plan confirmed visits, coordinate sales, and keep field results moving."
      action={<NewMissionAction />}
    >
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Mission summary">
        <MetricCard icon={ClipboardList} label="Open missions" value={summary.open} tone="bg-primary/10 text-primary" />
        <MetricCard icon={CalendarDays} label="Today" value={summary.today} tone="bg-[var(--warning)] text-[var(--warning-foreground)]" />
        <MetricCard icon={CheckCircle2} label="Completed" value={summary.completed} tone="bg-[var(--success)] text-[var(--success-foreground)]" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <article className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Field schedule</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Upcoming missions</h2>
            </div>
            <Link href="/workspace/missions" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              All missions <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcoming.length > 0 ? (
            <div className="divide-y">
              {upcoming.map((mission) => (
                <Link key={mission.id} href={`/workspace/missions/${mission.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatMissionSchedule(mission.scheduledStart, now)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}
                    </span>
                  </span>
                  <StatusBadge status={mission.status} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Belum ada mission terjadwal. Mulai dengan merencanakan kunjungan pertama.
            </p>
          )}
        </article>

        <article className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quick start</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Keep moving</h2>
          </div>
          <div className="divide-y">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${link.tone}`}>
                  <link.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{link.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{link.hint}</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </article>
      </section>
    </WorkspacePage>
  )
}
