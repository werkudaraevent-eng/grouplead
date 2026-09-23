import { requirePermission } from "@/lib/require-permission"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { createClient } from "@/utils/supabase/server"
import {
  dailyActiveSeries,
  isUsageAdmin,
  parseUsagePeriod,
  rollupPages,
  rollupPeople,
  summarizeUsage,
  unlistedUserIds,
  usageDayKey,
  usageDayLabel,
  usageDayLongLabel,
  usageDayWindow,
  usageSinceLabel,
  windowStart,
  type UsagePersonInput,
} from "@/lib/usage/usage-stats"
import { firstUsageDay, listUsageDays, listUsageLastSeen, listUsagePages, listUsagePeople, readViewerRole } from "@/lib/usage/usage-queries"
import { UsageDailyChart } from "./usage-daily-chart"
import { UsagePages } from "./usage-pages"
import { UsagePeople } from "./usage-people"
import { UsagePeriodControl } from "./usage-period"

export const dynamic = "force-dynamic"

const number = new Intl.NumberFormat("en-US")

const SUBTITLE =
  "Who opens LeadEngine, when they were last here, and which pages are opened most. Only the page opened and when is recorded, per person per day; nothing typed, nothing shown on a page, and no location."

/**
 * Settings → Usage.
 *
 * Who opens the app and how often, read the way Salesforce's Lightning
 * Usage App, Notion's workspace analytics and Microsoft 365's active-users
 * report present theirs: people active today, in 7 and in 30 days; a bar
 * per day of the people who came, over the chosen period; one line per
 * person with when they were last here, days active, pages opened and an
 * eight-week trend; and the pages opened most over the same period. Built
 * from one row per person per day and one counter per page per day, never
 * an event stream. Sales Activity's Pengaturan → Pemakaian is the same
 * page over its own tables.
 *
 * Admins only: the Settings layout and this page ask for the Settings
 * grant, the page asks for the admin role, and row security returns the
 * rows to admins alone. The page reflows to a phone, so its root opts out
 * of the shell's 900px content floor (`data-fluid-page`).
 */
export default async function UsagePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const shell = (children: React.ReactNode) => (
    <div data-fluid-page className="min-h-[100dvh] bg-background">
      <SettingsPageHeader title="Usage" subtitle={SUBTITLE} breadcrumbs={[{ label: "Usage" }]} />
      <div className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1200px]">{children}</div>
      </div>
    </div>
  )
  const notice = (title: string, body: string) =>
    shell(
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
      </div>
    )

  const guard = await requirePermission("settings", "read")
  if (!guard.allowed) return notice("Settings access restricted", "Your role does not have permission to open Settings.")

  const supabase = await createClient()
  if (!isUsageAdmin(await readViewerRole(guard.userId, supabase))) {
    return notice("Admins only", "Usage names people, so only admins and super admins can see it.")
  }

  const params = await searchParams
  const period = parseUsagePeriod(params.period)
  const now = new Date()
  const today = usageDayKey(now)
  const from = windowStart(today, period)

  // Day rows reach eight weeks back for the people table, or the period's
  // start when that is further (90 days), so the daily chart is complete.
  const [days, pages, lastSeen, people, since] = await Promise.all([
    listUsageDays(windowStart(today, usageDayWindow(period)), supabase),
    listUsagePages(from, supabase),
    listUsageLastSeen(supabase),
    listUsagePeople(supabase),
    firstUsageDay(supabase),
  ])

  const listed = people.listed
  const unlisted = unlistedUserIds(listed, lastSeen, days)
  const everyone: UsagePersonInput[] = [...listed, ...unlisted.map((id) => people.byId.get(id) ?? { id, name: "Unknown user", avatarUrl: null })]

  const summary = summarizeUsage(days, today)
  const persons = rollupPeople(everyone, days, lastSeen, today)
  const daily = dailyActiveSeries(days, from, today).map((entry) => ({ ...entry, label: usageDayLabel(entry.day), long: usageDayLongLabel(entry.day) }))
  const pageUsage = rollupPages(pages, from, today)
  const headcount = listed.length
  const ofHeadcount = `of ${number.format(headcount)} ${headcount === 1 ? "person" : "people"}`

  const tiles = [
    { label: "Active today", value: summary.activeToday, hint: ofHeadcount },
    { label: "Active 7 days", value: summary.active7, hint: ofHeadcount },
    { label: "Active 30 days", value: summary.active30, hint: ofHeadcount },
    { label: "Pages opened", value: summary.views30, hint: "30 days, everyone" },
  ]

  return shell(
    <div className="space-y-4">
      <section aria-labelledby="usage-summary">
        <h2 id="usage-summary" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="min-w-0 rounded-xl border border-border bg-card px-4 py-3.5">
              <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{number.format(tile.value)}</dd>
              <dd className="truncate text-[11px] text-muted-foreground">{tile.hint}</dd>
            </div>
          ))}
        </dl>
        {!since && (
          <p className="mt-3 rounded-xl border border-border bg-card px-5 py-4 text-[13px] text-muted-foreground">
            Nothing recorded yet. Usage is recorded from the day this page shipped; the numbers fill in as people open LeadEngine.
          </p>
        )}
      </section>

      <section aria-labelledby="usage-daily" className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="usage-daily" className="text-[14px] font-semibold text-foreground">
              Daily active users
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">How many people opened LeadEngine each day, {ofHeadcount}.</p>
          </div>
          <UsagePeriodControl period={period} />
        </header>
        <div className="px-3 py-3 sm:px-4">
          <UsageDailyChart days={daily} />
        </div>
      </section>

      <section aria-labelledby="usage-people" className="overflow-clip rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <h2 id="usage-people" className="text-[14px] font-semibold text-foreground">
            People
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Everyone with LeadEngine access, most recently active first. Days active count 30 days, pages opened 7 days, and the trend is days active per week over 8 weeks.
          </p>
        </header>
        <UsagePeople people={persons} now={now} />
      </section>

      <section aria-labelledby="usage-pages" className="overflow-clip rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="usage-pages" className="text-[14px] font-semibold text-foreground">
              Most opened pages
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Opened by everyone in the last {period} days{pageUsage.total > 0 ? `: ${number.format(pageUsage.total)} times` : ""}. Pages are counted by kind: every lead&apos;s page is one Lead details, whichever lead it is.
            </p>
          </div>
          <UsagePeriodControl period={period} />
        </header>
        <div className="px-2 py-3 sm:px-3">
          <UsagePages rows={pageUsage.rows} all={pageUsage.all} period={period} />
        </div>
      </section>

      {since && (
        <p className="px-1 text-xs text-muted-foreground">
          Recorded since {usageSinceLabel(since)}; “Never” means not opened since that day. Days are counted in WIB (UTC+7).
        </p>
      )}
    </div>
  )
}
