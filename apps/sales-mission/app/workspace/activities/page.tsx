import { redirect } from "next/navigation"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listTenantSales, listViewerCalendar } from "@/lib/missions/mission-queries"
import { annotateReportRights } from "@/lib/missions/mission-rights"
import { countMissions, listMissionFacets, listMissionsPage, parsePageParams } from "@/lib/missions/mission-page-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { EMPTY_QUERY, isEmptyQuery, parseMissionQuery, resolveMissionFilter, serializeMissionQuery, type MissionFilter } from "@/lib/missions/mission-filter"
import { QuickFilterChips, WorkspacePage } from "@/app/workspace/workspace-page"
import { RememberView } from "@/components/remember-view"
import { rememberedView } from "@/lib/remembered-view"
import { MissionTable } from "./mission-table"
import { MissionFilterBar } from "./mission-filter-bar"
import { Button } from "@/components/ui/button"
import { Download } from "@/components/icons"
import { ImportMissions } from "./import-missions"
import { ActivitiesPhoneMenu } from "./activities-phone-menu"
import { SelectionModeProvider } from "@/components/selection-mode"
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
  // A bare open of the list reopens the view this person left it in.
  const remembered = await rememberedView("activities", params)
  if (remembered) redirect(paths.activities(remembered))
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
  // "X dari Y" in the filter bar: Y is the same lens with no facets, the
  // meaning Prospek and Laporan give it, so the pair never reads "N dari N".
  const unfilteredCount = isEmptyQuery(query) ? pageResult.total : await countMissions(access, { query: EMPTY_QUERY, sort, now, lens: filter })

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
      // The coach marks on Join and on the FAB teach what this sentence says;
      // on a phone it would cost two lines before the first record.
      phoneDescription={false}
      phoneAction={false}
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
      primaryAction={canCreate ? { href: paths.newActivity(), label: "Aktivitas baru", hint: { key: "fab-activity", title: "Jadwalkan kunjungan", body: "Aktivitas baru: pilih klien, jadwal, lokasi, dan sales utama. Kalender tim tampil supaya jamnya tidak bentrok.", learnHref: paths.guideSection("aktivitas") } } : undefined}
    >
      <RememberView list="activities" />
      <SelectionModeProvider>
      <ActivitiesPhoneMenu exportHref={exportHref} exportCount={pageResult.total} canCreate={canCreate} canDelete={canDelete} />
      <MissionFilterBar
        quick={<QuickFilterChips view={{ query, lens: filter, sort }} counts={{ all: allCount, mine: mineCount, team: teamCount }} policy={settings} defaultSort="upcoming" />}
        query={query}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        types={facets.types}
        locations={facets.locations}
        industries={facets.industries}
        total={unfilteredCount}
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
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
      />
      </SelectionModeProvider>
    </WorkspacePage>
  )
}
