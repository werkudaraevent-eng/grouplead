import { redirect } from "next/navigation"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listTenantSales, listViewerCalendar } from "@/lib/missions/mission-queries"
import { annotateReportRights } from "@/lib/missions/mission-rights"
import { countMissions, listMissionFacets, listMissionsPage, parsePageParams } from "@/lib/missions/mission-page-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { isEmptyQuery, parseMissionQuery, resolveMissionFilter, serializeMissionQuery, type MissionFilter } from "@/lib/missions/mission-filter"
import { MissionFilterChips, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionTable } from "./mission-table"
import { MissionFilterBar } from "./mission-filter-bar"
import { Button } from "@/components/ui/button"
import { Download } from "@/components/icons"
import { ImportMissions } from "./import-missions"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const params = await searchParams
  const now = new Date()
  const query = parseMissionQuery(params)
  const { page, size, sort } = parsePageParams(params)

  const [settings, canCreate, canDelete, people, facets, ownCalendar] = await Promise.all([
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
    canPerform(access, "sales_mission_mission", "delete"),
    listTenantSales(access),
    listMissionFacets(access),
    listViewerCalendar(access),
  ])

  // The lens picks whose answer; the panel picks which missions. A lens the
  // policy makes meaningless (waiting on answers, when nobody is asked)
  // falls back to the full list.
  const lensParam = Array.isArray(params.filter) ? params.filter[0] : params.filter
  const requested = resolveMissionFilter(lensParam)
  const filter: MissionFilter = settings.requireAssignmentConfirmation ? requested : "all"

  const base = { query, sort, now }
  const [pageResult, mineCount, teamCount] = await Promise.all([
    listMissionsPage(access, { ...base, lens: filter, page, size }),
    settings.requireAssignmentConfirmation ? countMissions(access, { ...base, lens: "mine" }) : Promise.resolve(0),
    settings.requireAssignmentConfirmation ? countMissions(access, { ...base, lens: "team" }) : Promise.resolve(0),
  ])
  const allCount = filter === "all" ? pageResult.total : await countMissions(access, { ...base, lens: "all" })

  // Join eligibility is judged against the viewer's own calendar, which is
  // loaded once rather than derived from whichever rows made this page.
  const visible = annotateJoinStatus(pageResult.items, settings, ownCalendar)

  const exportParams = serializeMissionQuery(query)
  if (filter !== "all") exportParams.set("filter", filter)
  if (sort !== "upcoming") exportParams.set("sort", sort)
  const exportHref = exportParams.toString() ? paths.activitiesExport(exportParams) : paths.activitiesExport()

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Aktivitas"
      title="Aktivitas"
      description={[
        describeReadScope(await getReadScope(access, "sales_mission_mission"), "mission") ?? "Seluruh aktivitas unit bisnis.",
        settings.requireAssignmentConfirmation
          ? "Baris bertepi kuning menunggu jawaban Anda; jawab langsung dari tombol di barisnya."
          : "Aktivitas yang bisa Anda ikuti punya tombol Join di barisnya.",
      ].join(" ")}
      action={
        <>
          {/* Exports everything the filters match, not the page on screen. */}
          <Button asChild variant="outline" size="sm" title={`Export ${pageResult.total} aktivitas yang cocok dengan filter`}>
            <a href={exportHref}>
              <Download className="h-4 w-4" /> Export{pageResult.total > 0 ? ` (${pageResult.total})` : ""}
            </a>
          </Button>
          {canCreate && <ImportMissions />}
        </>
      }
      primaryAction={canCreate ? { href: paths.newActivity(), label: "Aktivitas baru" } : undefined}
    >
      <MissionFilterChips active={filter} counts={{ all: allCount, mine: mineCount, team: teamCount }} policy={settings} />
      <MissionFilterBar
        query={query}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        types={facets.types}
        locations={facets.locations}
        total={allCount}
        shown={pageResult.total}
      />
      <MissionTable
        missions={await annotateReportRights(access, visible)}
        now={now}
        canCreate={canCreate}
        canDelete={canDelete}
        filter={filter}
        filtered={!isEmptyQuery(query)}
        policy={settings}
        maxSupporting={settings.maxSupporting}
        pagination={{ page, size, total: pageResult.total, sort }}
      />
    </WorkspacePage>
  )
}
