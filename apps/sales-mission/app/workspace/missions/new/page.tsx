import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionForm } from "./mission-form"

export default async function NewMissionPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const salesOptions = await listTenantSales(access)
  // Default to today in Werkudara's timezone, not the server's.
  const defaultDate = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date())

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Missions"
      title="Plan a mission"
      description="Capture a confirmed visit before assigning the right sales team."
      action={<BackLink />}
    >
      <MissionForm salesOptions={salesOptions} defaultDate={defaultDate} />
    </WorkspacePage>
  )
}
