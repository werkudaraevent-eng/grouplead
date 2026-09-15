import { redirect } from "next/navigation"
import { Download } from "@/components/icons"
import { getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { requireModule } from "@/lib/missions/nav-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { isEmptyReportQuery, parseReportQuery, serializeReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { listReportsPage } from "@/lib/reporting/report-list-queries"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { ReportTabs } from "./report-tabs"
import { ReportFilterBar } from "./report-filter-bar"
import { ReportTable } from "./report-table"

export const dynamic = "force-dynamic"

/**
 * Daftar laporan: every visit report as a row, filtered and sorted in the
 * database, each opening the mission it belongs to at its report card. The
 * summary over them is the other tab.
 */
export default async function ReportListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const params = await searchParams
  // The summary used to live at this address with ?from&to. A bookmark
  // carrying only those lands on the summary, where it still means the same.
  const keys = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== "")
  if (keys.length > 0 && keys.every((key) => key === "from" || key === "to")) {
    const legacy = new URLSearchParams()
    for (const key of keys) legacy.set(key, String(params[key]))
    redirect(`/workspace/reports/ringkasan?${legacy.toString()}`)
  }

  const now = new Date()
  const query = parseReportQuery(params)
  const { page, size, sort } = parseReportPageParams(params)

  const [choices, salesOptions] = await Promise.all([listReportChoices(access), listTenantSales(access)])
  const { items, total } = await listReportsPage(access, { query, sort, page, size, now }, choices)

  const exportParams = serializeReportQuery(query)
  exportParams.set("sort", sort)
  const people = salesOptions.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Reporting"
      title="Laporan"
      description={[describeReadScope(await getReadScope(access, "sales_mission_result"), "laporan"), "Setiap laporan kunjungan yang ditulis sales, terbaru dulu. Saring, urutkan, lalu buka missionnya."].filter(Boolean).join(" ")}
      action={
        <Button asChild variant="outline" size="sm">
          <a href={`/workspace/reports/export?${exportParams.toString()}&format=xlsx`}>
            <Download className="h-4 w-4" /> Ekspor{total > 0 ? ` (${total})` : ""}
          </a>
        </Button>
      }
    >
      <ReportTabs />
      <ReportFilterBar query={query} choices={choices} people={people} total={total} shown={items.length} />
      <ReportTable reports={items} pagination={{ page, size, total, sort }} filtered={!isEmptyReportQuery(query)} today={missionDayKey(now)} />
    </WorkspacePage>
  )
}
