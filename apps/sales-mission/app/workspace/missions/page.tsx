import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings, listMissions } from "@/lib/missions/mission-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { MissionTable, NewMissionAction, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

export default async function MissionsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [missions, settings] = await Promise.all([listMissions(access), getMissionSettings(access)])
  // "Tim" column shows where the viewer stands: already on it, clashing with
  // their own schedule, or open to join.
  const annotated = annotateJoinStatus(missions, settings)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Missions"
      title="Missions"
      description="Seluruh mission unit bisnis. Kolom Tim menunjukkan mana yang bisa Anda ikuti."
      action={<NewMissionAction />}
    >
      <MissionTable missions={annotated} now={new Date()} />
    </WorkspacePage>
  )
}
