import { redirect } from "next/navigation"
import { Download } from "@/components/icons"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings } from "@/lib/missions/mission-queries"
import { requireModule } from "@/lib/missions/nav-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { resolveSales } from "@/lib/missions/mission-filter"
import { describeReadScope } from "@/lib/access/record-scope"
import { mergeLayout, modeOf, resolveWidgets } from "@/lib/reporting/dashboard-layout"
import { readCompanyDashboard, readDashboardLayout } from "@/lib/reporting/dashboard-layout-queries"
import { labelContext, loadWidgetData, salesIdsSeen } from "@/lib/reporting/dashboard-queries"
import { parseRingkasanQuery, resolveReportDay, resolveRingkasanRange } from "@/lib/reporting/ringkasan-filter"
import { presentWidget, type WidgetView } from "@/lib/reporting/widget-view"
import { rememberedView } from "@/lib/remembered-view"
import { RememberView } from "@/components/remember-view"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { paths } from "@/lib/paths"
import { ReportTabs } from "../report-tabs"
import { DashboardEditor, type CardData } from "./dashboard-editor"
import type { WidgetMode } from "@/lib/reporting/cube"

export const dynamic = "force-dynamic"

/**
 * Ringkasan: the summary as a board of cards over one period and one set
 * of people. Each card is one question of the cube (or one of the special
 * loaders: the daily list, the funnel, the KPI strip, today's AI insight),
 * answered here on the server and handed to the board as plain data; the
 * board arranges, resizes and switches modes without asking again. Tanya
 * AI is a pane off the toolbar, not a card, so the board stays the page.
 */
export default async function ReportSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const params = await searchParams
  const remembered = await rememberedView("ringkasan", params)
  if (remembered) redirect(paths.reportSummary(remembered))

  const now = new Date()
  const query = parseRingkasanQuery(params)
  const range = resolveRingkasanRange(query, now)
  const sales = resolveSales(query.sales, access.userId)
  const day = resolveReportDay(query, range, now)

  const [people, choices, saved, companyDefault, canSeeProspects, canPublish, readScope, settings, canSeeInsight] = await Promise.all([
    listTenantSales(access),
    listReportChoices(access),
    readDashboardLayout(access),
    readCompanyDashboard(access),
    canPerform(access, "sales_mission_prospect", "read"),
    canPerform(access, "sales_mission_settings", "update"),
    getReadScope(access, "sales_mission_result"),
    getMissionSettings(access),
    canPerform(access, "sales_mission_ai", "read"),
  ])

  // Your own board if you arranged one; else the unit's default; else the
  // built-ins. The insight card exists only while the unit's switch is on
  // and the person may read Insight AI.
  const layout = mergeLayout(saved ?? companyDefault, { canSeeProspects, canSeeInsight: settings.aiInsightsEnabled && canSeeInsight })
  const { visible, hidden } = resolveWidgets(layout)

  const data = await Promise.all(visible.map((widget) => loadWidgetData(access, widget, { range, sales, day, choices, now })))
  const ctx = { ...(await labelContext(access, salesIdsSeen(data))), choices }

  const cards: CardData[] = visible.map((widget, index) => {
    const modes: readonly WidgetMode[] = widget.source === "cube" && widget.modes?.length ? widget.modes : ["umum"]
    const views: Partial<Record<WidgetMode, WidgetView>> = {}
    for (const mode of modes) views[mode] = presentWidget(widget, data[index], mode, ctx, range)
    if (!views.umum) views.umum = presentWidget(widget, data[index], modeOf(layout, widget), ctx, range)
    return { id: widget.id, config: widget, views, truncated: data[index].source === "cube" && data[index].truncated }
  })

  const exportQuery = new URLSearchParams({ from: range.from, to: range.to })

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Reporting"
      title="Laporan"
      description={[describeReadScope(readScope, "laporan"), "Ringkasan dihitung dari laporan yang sudah dikirim; draf tidak ikut. Saring periode dan sales di atas; semua kartu mengikuti."].filter(Boolean).join(" ")}
      // On a phone the exports and "Atur widget" live in the app bar's
      // overflow (announced by DashboardEditor, which owns the edit mode).
      phoneDescription={false}
      phoneAction={false}
      action={
        <>
          <Button asChild size="sm">
            <a href={`/workspace/reports/export?${exportQuery.toString()}&format=xlsx`}>
              <Download className="h-4 w-4" /> Ekspor Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/workspace/reports/export?${exportQuery.toString()}`}>CSV</a>
          </Button>
        </>
      }
    >
      <ReportTabs showInsight={settings.aiInsightsEnabled && canSeeInsight} />
      <RememberView list="ringkasan" />
      <DashboardEditor
        query={query}
        range={range}
        sales={sales}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        initialLayout={layout}
        cards={cards}
        hidden={hidden}
        canSeeProspects={canSeeProspects}
        canPublish={canPublish}
        hasCompanyDefault={companyDefault !== null}
        exportQuery={exportQuery.toString()}
        askEnabled={settings.aiAskEnabled && canSeeInsight}
      />
    </WorkspacePage>
  )
}
