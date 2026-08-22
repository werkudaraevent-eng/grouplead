import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listMissions } from "@/lib/missions/mission-queries"
import { MissionTable, NewMissionAction, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

export default async function MissionsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const missions = await listMissions(access)

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Missions"
      title="Missions"
      description="Track planned visits, assignment responses, and mission outcomes."
      action={<NewMissionAction />}
    >
      <section className="workspace-panel workspace-list-panel">
        <MissionTable missions={missions} now={new Date()} />
      </section>
    </WorkspacePage>
  )
}
