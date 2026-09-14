import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listMissions, listTenantSales } from "@/lib/missions/mission-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import {
  applyMissionQuery,
  countMissionFilters,
  facetOptions,
  filterMissions,
  isEmptyQuery,
  parseMissionQuery,
  resolveMissionFilter,
  serializeMissionQuery,
} from "@/lib/missions/mission-filter"
import { MissionFilterChips, NewMissionAction, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionTable } from "./mission-table"
import { MissionFilterBar } from "./mission-filter-bar"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { ImportMissions } from "./import-missions"

export const dynamic = "force-dynamic"

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const [missions, settings, canCreate, canDelete, people, params] = await Promise.all([
    listMissions(access),
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
    canPerform(access, "sales_mission_mission", "delete"),
    listTenantSales(access),
    searchParams,
  ])
  // Where the viewer stands on each mission: on it, clashing with their own
  // schedule, or free to join. Drives the Join button in the Aksi column.
  const annotated = annotateJoinStatus(missions, settings)

  // Counts come from the full list so a lens showing nothing still says so with
  // a zero rather than disappearing. A lens the policy makes meaningless
  // (waiting on answers, when nobody is asked) falls back to the full list.
  const lensParam = Array.isArray(params.filter) ? params.filter[0] : params.filter
  const requested = resolveMissionFilter(lensParam)
  const filter = settings.requireAssignmentConfirmation ? requested : "all"
  const counts = countMissionFilters(annotated, settings)
  const now = new Date()

  // The lens and the filter panel stack: the lens picks whose answer, the
  // panel picks which missions. Both are in the URL, so the export link
  // below carries both and exports exactly what is on screen.
  const query = parseMissionQuery(params)
  const lensed = filterMissions(annotated, filter, settings)
  const visible = applyMissionQuery(lensed, query, now)
  const facets = facetOptions(missions)

  const exportParams = serializeMissionQuery(query)
  if (filter !== "all") exportParams.set("filter", filter)
  const exportHref = exportParams.toString() ? `/workspace/missions/export?${exportParams}` : "/workspace/missions/export"

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission"
      title="Mission"
      description={
        settings.requireAssignmentConfirmation
          ? "Seluruh mission unit bisnis. Baris bertepi kuning menunggu jawaban Anda; jawab langsung dari kolom Aksi."
          : "Seluruh mission unit bisnis. Mission yang bisa Anda ikuti punya tombol Join di kolom Aksi."
      }
      action={
        <>
          {/* Exports what the chosen lens is showing, so "export" means the
              list on screen rather than everything silently. */}
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <Download className="h-4 w-4" /> Export
            </a>
          </Button>
          {canCreate && <ImportMissions />}
          {canCreate && <NewMissionAction />}
        </>
      }
    >
      <MissionFilterChips active={filter} counts={counts} policy={settings} />
      <MissionFilterBar
        query={query}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        types={facets.types}
        locations={facets.locations}
        total={lensed.length}
        shown={visible.length}
      />
      <MissionTable
        missions={visible}
        now={now}
        canCreate={canCreate}
        canDelete={canDelete}
        filter={filter}
        filtered={!isEmptyQuery(query)}
        policy={settings}
        maxSupporting={settings.maxSupporting}
        canWriteAnyReport={access.isSuperAdmin}
      />
    </WorkspacePage>
  )
}
