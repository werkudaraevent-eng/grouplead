import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Send,
  Sparkles,
  Clock,
  Target,
  UserCheck,
  Users,
} from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { listReportRecords } from "@/lib/reporting/report-queries"
import { buildKpiReport, currentMonthRange, type Breakdown } from "@/lib/reporting/kpi"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { getProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { ON_TIME_GRACE_MINUTES } from "@/lib/missions/visit-time"
import { FunnelCard } from "../funnel-card"
import { ReportTabs } from "../report-tabs"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Target
  label: string
  value: string
  hint?: string
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
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </article>
  )
}

function BreakdownCard({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: Breakdown[]
  emptyText: string
}) {
  const max = rows.reduce((highest, row) => Math.max(highest, row.submitted), 0)

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y">
          {rows.slice(0, 8).map((row) => (
            <li key={row.key} className="px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.label}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{row.submitted}</span>
              </div>
              {/* Bar makes the distribution readable at a glance; the number
                  stays for anyone who needs the exact figure. */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max === 0 ? 0 : (row.submitted / max) * 100}%` }}
                />
              </div>
              {row.opportunities > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">{row.opportunities} peluang</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </article>
  )
}

/**
 * Ringkasan: the KPIs over the visit reports, for a date range. The list
 * of the reports themselves is the other tab.
 */
export default async function ReportSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const now = new Date()
  const params = await searchParams
  const fallback = currentMonthRange(now)

  // An unparseable range falls back to this month rather than showing an empty
  // report that looks like "no activity".
  const range = {
    from: params.from && DATE_PATTERN.test(params.from) ? params.from : fallback.from,
    to: params.to && DATE_PATTERN.test(params.to) ? params.to : fallback.to,
  }

  const [records, funnel, choices] = await Promise.all([
    listReportRecords(access),
    (await canPerform(access, "sales_mission_prospect", "read")) ? getProspectFunnel(access, range) : Promise.resolve(null),
    listReportChoices(access),
  ])
  const report = buildKpiReport(records, now, range, choices)
  const currency = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 })

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Reporting"
      title="Laporan"
      description="Ringkasan dihitung dari laporan kunjungan yang sudah dikirim. Draf tidak ikut."
      action={
        <>
          <Button asChild size="sm">
            <a href={`/workspace/reports/export?from=${range.from}&to=${range.to}&format=xlsx`}>
              <Download className="h-4 w-4" /> Ekspor Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/workspace/reports/export?from=${range.from}&to=${range.to}`}>CSV</a>
          </Button>
        </>
      }
    >
      <ReportTabs />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card px-5 py-4" action="/workspace/reports/ringkasan">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="from">Dari</label>
          <input id="from" name="from" type="date" defaultValue={range.from} className="h-10 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="to">Sampai</label>
          <input id="to" name="to" type="date" defaultValue={range.to} className="h-10 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        </div>
        <Button type="submit" size="sm" className="h-10">Terapkan</Button>
        <Link href="/workspace/reports/ringkasan" className="text-sm font-medium text-primary hover:underline">Bulan ini</Link>
      </form>

      {report.summary.resultsSubmitted === 0 ? (
        <EmptyState
          title="Belum ada laporan pada rentang ini"
          description="Angka di sini muncul begitu sales mengirim laporan kunjungan. Coba lebarkan rentang tanggalnya."
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={CheckCircle2} label="Laporan dikirim" value={String(report.summary.resultsSubmitted)} tone="bg-primary/10 text-primary" />
            <Metric icon={Sparkles} label="Peluang" value={String(report.summary.opportunities)} hint={`Rp ${currency.format(report.summary.estimatedValueTotal)} estimasi`} tone="bg-[var(--success)] text-[var(--success-foreground)]" />
            <Metric icon={Target} label="Next action terbuka" value={String(report.summary.openNextActions)} hint={report.summary.overdueNextActions > 0 ? `${report.summary.overdueNextActions} lewat tanggal` : "Semua masih dalam tenggat"} tone="bg-[var(--warning)] text-[var(--warning-foreground)]" />
            <Metric icon={Users} label="Kontak ditemukan" value={String(report.summary.contactsDiscovered)} tone="bg-secondary text-secondary-foreground" />
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={UserCheck} label="Bertemu pengambil keputusan" value={`${report.summary.decisionMakerRate}%`} hint="dari laporan yang dikirim" tone="bg-primary/10 text-primary" />
            <Metric icon={Send} label="Lead dikirim ke CRM" value={String(report.summary.leadsPushed)} tone="bg-[var(--success)] text-[var(--success-foreground)]" />
            <Metric icon={AlertTriangle} label="Perlu klarifikasi" value={String(report.summary.needsClarification)} tone="bg-[var(--danger)] text-[var(--danger-foreground)]" />
            <Metric
              icon={Clock}
              label="Tepat waktu"
              value={report.summary.onTimeRate === null ? "—" : `${report.summary.onTimeRate}%`}
              hint={report.summary.onTimeRate === null ? "Belum ada laporan yang mencatat jam kunjungan" : `toleransi ${ON_TIME_GRACE_MINUTES} menit${report.summary.averageVisitMinutes ? ` · rata-rata ${report.summary.averageVisitMinutes} menit per kunjungan` : ""}`}
              tone="bg-secondary text-secondary-foreground"
            />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <BreakdownCard title="Per sales" rows={report.bySales} emptyText="Belum ada data." />
            <BreakdownCard title="Per klien" rows={report.byCompany} emptyText="Belum ada data." />
            <BreakdownCard title="Per tipe aktivitas" rows={report.byMissionType} emptyText="Belum ada data." />
            <BreakdownCard title="Per tingkat minat" rows={report.byInterest} emptyText="Belum ada data." />
          </section>
        </>
      )}

      {funnel && (
        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <FunnelCard counts={funnel} />
        </section>
      )}
    </WorkspacePage>
  )
}
