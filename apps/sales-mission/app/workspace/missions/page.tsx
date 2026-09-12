import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listMissions } from "@/lib/missions/mission-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import {
  countMissionFilters,
  filterMissions,
  resolveMissionFilter,
} from "@/lib/missions/mission-filter"
import {
  MissionFilterChips,
  MissionTable,
  NewMissionAction,
  WorkspacePage,
} from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { ImportMissions } from "./import-missions"

export const dynamic = "force-dynamic"

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const [missions, settings, canCreate, params] = await Promise.all([
    listMissions(access),
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
    searchParams,
  ])
  // "Tim" column shows where the viewer stands: already on it, clashing with
  // their own schedule, or open to join.
  const annotated = annotateJoinStatus(missions, settings)

  // Counts come from the full list so a lens showing nothing still says so with
  // a zero rather than disappearing.
  const filter = resolveMissionFilter(params.filter)
  const counts = countMissionFilters(annotated)
  const visible = filterMissions(annotated, filter)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission"
      title="Mission"
      description="Seluruh mission unit bisnis. Kolom Jawaban menunjukkan siapa yang masih ditunggu, kolom Tim menunjukkan mana yang bisa Anda ikuti."
      action={
        <>
          {/* Exports what the chosen lens is showing, so "export" means the
              list on screen rather than everything silently. */}
          <Button asChild variant="outline" size="sm">
            <a href={filter === "all" ? "/workspace/missions/export" : `/workspace/missions/export?filter=${filter}`}>
              <Download className="h-4 w-4" /> Export
            </a>
          </Button>
          {canCreate && <ImportMissions />}
          {canCreate && <NewMissionAction />}
        </>
      }
    >
      <MissionFilterChips active={filter} counts={counts} />
      <MissionTable missions={visible} now={new Date()} canCreate={canCreate} filter={filter} />
    </WorkspacePage>
  )
}
