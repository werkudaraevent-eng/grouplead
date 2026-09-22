import { redirect } from "next/navigation"
import Link from "next/link"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { createClient } from "@/utils/supabase/server"
import { insightDayLabel, insightDayName, insightHistoryWindow, listInsightDays, readInsight, wibDayOf } from "@/lib/ai/insights"
import { buildInsightView, canSeeInsight, insightScopeNote, resolveInsightScope } from "@/lib/ai/insight-view"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"
import { ReportTabs } from "../report-tabs"
import { BriefView } from "./brief-view"

export const dynamic = "force-dynamic"
// The brief is written by a server action invoked from this page, and a reasoning model needs more than the default function budget.
export const maxDuration = 120

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Insight: the day's AI brief, read whole.
 *
 * M3 list-detail. On a desk the days that have a brief are a fixed pane on
 * the left and the brief itself takes the rest, the pattern every mail and
 * notes app uses for "a short list of things, one of them open"; below the
 * expanded width the pane collapses into a row of day chips above the
 * brief, because two panes on a phone means neither is readable. The day
 * lives in the URL (`?day=`), so a brief can be linked to, and today is
 * always the first choice whether or not it has been written yet.
 */
export default async function ReportInsightPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")
  // The tab only exists where the brief does; a stale link lands on the summary.
  if (!(await canSeeInsight(access))) redirect(paths.reportSummary())

  const params = await searchParams
  const now = new Date()
  const today = wibDayOf(now)
  const window = insightHistoryWindow(today)
  const asked = typeof params.day === "string" && DAY_PATTERN.test(params.day) ? params.day : today
  const day = asked >= window.from && asked <= today ? asked : today

  const { scope, userId } = await resolveInsightScope(access)
  const supabase = await createClient()
  const [days, record, canRegenerate, readScope] = await Promise.all([
    listInsightDays(supabase, access.companyId, scope, userId, window),
    readInsight(supabase, access.companyId, day, scope, userId),
    canPerform(access, "sales_mission_settings", "update"),
    getReadScope(access, "sales_mission_result"),
  ])
  const view = record ? await buildInsightView(access, record) : null
  const scopeNote = insightScopeNote(scope)
  // Today leads whether or not it has a row yet: it is written on open.
  const options = [today, ...days.filter((stored) => stored !== today)]

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Reporting"
      title="Laporan"
      description={[
        describeReadScope(readScope, "laporan"),
        "Brief harian yang ditulis AI dari laporan yang masuk: apa yang perlu ditindak, apa yang terdengar di lapangan, dan rekomendasinya.",
      ]
        .filter(Boolean)
        .join(" ")}
      phoneDescription={false}
      phoneAction={false}
    >
      <ReportTabs showInsight />

      {/* List-detail: 280–320px for the list, the rest for the brief. */}
      <div className="lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Desk: the days as a list. */}
        <nav aria-label="Hari" className="max-lg:hidden">
          <ol className="overflow-hidden rounded-xl border bg-card">
            {options.map((option) => (
              <li key={option} className="border-b last:border-b-0">
                <Link
                  href={paths.reportInsight(option === today ? undefined : { day: option })}
                  aria-current={option === day ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col justify-center px-4 py-2 text-sm transition-colors hover:bg-muted",
                    option === day ? "bg-[var(--tonal)] text-[var(--tonal-foreground)] hover:bg-[var(--tonal)]" : "text-foreground"
                  )}
                >
                  <span className="font-medium">{insightDayName(option, today)}</span>
                  <span className={cn("text-xs", option === day ? "text-[var(--tonal-foreground)]/80" : "text-muted-foreground")}>{insightDayLabel(option)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {/* Phone and tablet: the same days as a chip row above the brief. */}
        <nav aria-label="Hari" className="mb-3 lg:hidden">
          <ol className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
            {options.map((option) => (
              <li key={option} className="shrink-0">
                <Link
                  href={paths.reportInsight(option === today ? undefined : { day: option })}
                  aria-current={option === day ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors",
                    option === day ? "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted"
                  )}
                >
                  {insightDayName(option, today)}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <header className="mb-3">
            <h2 className="text-base font-semibold text-foreground">{insightDayName(day, today)}</h2>
            <p className="text-sm text-muted-foreground">
              {`Brief AI · ${insightDayLabel(day)}`}
              {scopeNote ? ` · ${scopeNote}` : ""}
            </p>
          </header>
          <BriefView initial={view} day={day} isToday={day === today} canRegenerate={canRegenerate} scopeNote={scopeNote} />
        </div>
      </div>
    </WorkspacePage>
  )
}
