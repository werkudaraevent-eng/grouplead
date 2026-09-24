import { redirect } from "next/navigation"
import { listIntroKey } from "@/lib/hints/hint-key"
import { Download } from "@/components/icons"
import { getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { requireModule } from "@/lib/missions/nav-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { EMPTY_REPORT_QUERY, isEmptyReportQuery, parseReportQuery, serializeReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { countReports, listReportsPage } from "@/lib/reporting/report-list-queries"
import { canSeeInsight } from "@/lib/ai/insight-view"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { PageChrome } from "@/components/page-chrome"
import { RememberView } from "@/components/remember-view"
import { openListView } from "@/lib/remembered-view"
import { listSavedViews } from "@/lib/lists/list-view-queries"
import { ListViewProvider } from "@/components/list-view/list-view-provider"
import { paths } from "@/lib/paths"
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

  const opened = await openListView("reports", params)
  if (opened.query) redirect(paths.reportList(opened.query))
  const now = new Date()
  const query = parseReportQuery(params)
  const { page, size, sort } = parseReportPageParams(params)

  const [choices, salesOptions, insightTab, saved] = await Promise.all([
    listReportChoices(access),
    listTenantSales(access),
    canSeeInsight(access),
    listSavedViews(access, "reports"),
  ])
  const [{ items, total }, unfilteredCount] = await Promise.all([
    listReportsPage(access, { query, sort, page, size, now }, choices),
    // "X dari Y": X is every match, not this page's rows; Y is the list with no facets.
    isEmptyReportQuery(query) ? Promise.resolve(null) : countReports(access, { query: EMPTY_REPORT_QUERY, sort, now }),
  ])

  const exportParams = serializeReportQuery(query)
  exportParams.set("sort", sort)
  const people = salesOptions.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))
  const exportHref = `/workspace/reports/export?${exportParams.toString()}&format=xlsx`
  const exportLabel = `Ekspor${total > 0 ? ` (${total})` : ""}`

  return (
    <WorkspacePage
      fill
      introKey={listIntroKey("reports")}
      title="Laporan"
      description={[describeReadScope(await getReadScope(access, "sales_mission_result"), "laporan"), "Setiap laporan kunjungan yang ditulis sales, terbaru dulu. Saring, urutkan, lalu buka aktivitasnya."].filter(Boolean).join(" ")}
      // On a phone the tabs sit right under the app bar and Ekspor waits in
      // its overflow; the empty state teaches what the sentence says. On a
      // desk it shows until the person closes it (`introKey`).
      phoneDescription={false}
      phoneAction={false}
      action={
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}>
            <Download className="h-4 w-4" /> {exportLabel}
          </a>
        </Button>
      }
    >
      <PageChrome menu={[{ label: exportLabel, href: exportHref }]} />
      <ReportTabs showInsight={insightTab} />
      <RememberView list="reports" />
      <ListViewProvider list="reports" views={saved.views} available={saved.available} fresh={opened.fresh}>
        <ReportFilterBar query={query} choices={choices} people={people} total={unfilteredCount ?? total} shown={total} />
        <ReportTable reports={items} pagination={{ page, size, total, sort }} filtered={!isEmptyReportQuery(query)} today={missionDayKey(now)} />
      </ListViewProvider>
    </WorkspacePage>
  )
}
