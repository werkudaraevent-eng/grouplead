import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  dailyActiveSeries,
  parseUsagePeriod,
  rollupPages,
  rollupPeople,
  summarizeUsage,
  unlistedUserIds,
  usageDayLabel,
  usageDayLongLabel,
  usageDayWindow,
  windowStart,
  type UsagePersonInput,
} from "@/lib/usage/usage-stats"
import { firstUsageDay, listUsageDays, listUsageLastSeen, listUsagePages, resolveUsageNames } from "@/lib/usage/usage-queries"
import { createClient } from "@/utils/supabase/server"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { ListBars } from "@/app/workspace/reports/ringkasan/charts/plain"
import { paths } from "@/lib/paths"
import { UsageActiveChart } from "./usage-active-chart"
import { UsagePeople } from "./usage-people"
import { UsagePeriodControl } from "./usage-period"

export const dynamic = "force-dynamic"

const number = new Intl.NumberFormat("id-ID")

/**
 * Pengaturan → Pemakaian.
 *
 * Who opens the app and how often, read the way Salesforce's Lightning
 * Usage App, Notion's workspace analytics and Microsoft 365's active-users
 * report present theirs: people active today, in 7 and in 30 days; a bar
 * per day of the people who came, over the chosen period; one line per
 * person with when they were last here, days active, pages opened and an
 * eight-week trend; and the pages opened most over the same period. Built
 * from one row per person per day and one counter per page per day, never
 * an event stream.
 *
 * Admin only, like Riwayat perubahan: the rows name people.
 */
export default async function UsagePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const shell = (children: React.ReactNode) => (
    <WorkspacePage
      eyebrow="Sales Activity / Pengaturan"
      title="Pemakaian"
      description="Siapa yang membuka Sales Activity, kapan terakhir, dan halaman mana yang paling sering dibuka. Yang dicatat hanya halaman yang dibuka dan kapan, per orang per hari; isi ketikan dan lokasi tidak dicatat."
      action={<BackLink href={paths.settings.index} />}
    >
      {children}
    </WorkspacePage>
  )

  if (!(await canPerform(access, "sales_mission_settings", "read"))) {
    return shell(<EmptyState title="Tidak punya izin" description="Pemakaian hanya dapat dilihat oleh admin Sales Activity." />)
  }

  const params = await searchParams
  const period = parseUsagePeriod(params.period)
  const now = new Date()
  const today = missionDayKey(now)
  const from = windowStart(today, period)
  const supabase = await createClient()

  // Day rows reach eight weeks back for the people table, or the period's
  // start when that is further (90 days), so the daily chart is complete.
  const [days, pages, lastSeen, tenantPeople, since] = await Promise.all([
    listUsageDays(access, windowStart(today, usageDayWindow(period)), supabase),
    listUsagePages(access, from, supabase),
    listUsageLastSeen(access, supabase),
    listTenantSales(access),
    firstUsageDay(access, supabase),
  ])

  const listed: UsagePersonInput[] = tenantPeople.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))
  const unlisted = unlistedUserIds(listed, lastSeen, days)
  const unlistedNames = await resolveUsageNames(unlisted, supabase)
  const people: UsagePersonInput[] = [
    ...listed,
    ...unlisted.map((id) => ({ id, name: unlistedNames.get(id)?.name ?? "Nama tidak diketahui", avatarUrl: unlistedNames.get(id)?.avatarUrl ?? null })),
  ]

  const summary = summarizeUsage(days, today)
  const persons = rollupPeople(people, days, lastSeen, today)
  const daily = dailyActiveSeries(days, from, today).map((entry) => ({ ...entry, label: usageDayLabel(entry.day), long: usageDayLongLabel(entry.day) }))
  const pageUsage = rollupPages(pages, from, today)
  const headcount = listed.length
  const sinceLabel = since
    ? new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(new Date(`${since}T12:00:00+07:00`))
    : null

  const tiles = [
    { label: "Aktif hari ini", value: summary.activeToday, hint: `dari ${number.format(headcount)} orang` },
    { label: "Aktif 7 hari", value: summary.active7, hint: `dari ${number.format(headcount)} orang` },
    { label: "Aktif 30 hari", value: summary.active30, hint: `dari ${number.format(headcount)} orang` },
    { label: "Pembukaan halaman", value: summary.views30, hint: "30 hari, semua orang" },
  ]

  return shell(
    <div className="max-w-5xl space-y-4">
      <section aria-labelledby="usage-summary">
        <h2 id="usage-summary" className="sr-only">Ringkasan</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border bg-card px-4 py-3.5">
              <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{number.format(tile.value)}</dd>
              <dd className="truncate text-[11px] text-muted-foreground">{tile.hint}</dd>
            </div>
          ))}
        </dl>
        {!since && (
          <p className="mt-3 rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
            Belum ada catatan. Pemakaian dicatat sejak fitur ini ada; angka di sini terisi begitu orang membuka aplikasi.
          </p>
        )}
      </section>

      <section aria-labelledby="usage-daily" className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id="usage-daily" className="text-base font-semibold text-foreground">Pengguna aktif per hari</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Berapa orang membuka aplikasi tiap hari, dari {number.format(headcount)} orang.</p>
          </div>
          <UsagePeriodControl period={period} />
        </header>
        <div className="px-3 py-3 sm:px-4">
          <UsageActiveChart days={daily} />
        </div>
      </section>

      <section aria-labelledby="usage-people" className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 id="usage-people" className="text-base font-semibold text-foreground">Per orang</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Semua orang dengan akses Sales Activity, yang terakhir aktif paling atas. Hari aktif dihitung 30 hari, pembukaan 7 hari, tren per minggu selama 8 minggu.
          </p>
        </header>
        <UsagePeople people={persons} now={now} />
      </section>

      <section aria-labelledby="usage-pages" className="overflow-clip rounded-xl border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id="usage-pages" className="text-base font-semibold text-foreground">Halaman paling dibuka</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pembukaan oleh semua orang, {period} hari terakhir{pageUsage.total > 0 ? `: ${number.format(pageUsage.total)} kali` : ""}. Detail aktivitas mana pun dihitung sebagai satu halaman.
            </p>
          </div>
          <UsagePeriodControl period={period} />
        </header>
        <div className="px-3 py-3 sm:px-4">
          <ListBars rows={pageUsage.rows} all={pageUsage.all} unit="count" drill={null} range={{ from, to: today }} sales={[]} />
        </div>
      </section>

      {sinceLabel && (
        <p className="px-1 text-xs text-muted-foreground">
          Dicatat sejak {sinceLabel}; “Belum pernah” berarti belum membuka aplikasi sejak tanggal itu. Hari dihitung dalam WIB.
        </p>
      )}
    </div>
  )
}
