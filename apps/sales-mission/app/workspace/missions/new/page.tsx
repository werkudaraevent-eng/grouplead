import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings, listTeamSchedules, listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionForm } from "./mission-form"

export default async function NewMissionPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  // Typing the URL has to be refused too. Hiding the button only removes the
  // invitation; this removes the route.
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    redirect("/workspace/missions")
  }

  const now = new Date()
  const [salesOptions, fields, schedules, settings] = await Promise.all([
    listTenantSales(access),
    listFormFields(access, "mission"),
    listTeamSchedules(access, now),
    getMissionSettings(access),
  ])
  // Default to today in Werkudara's timezone, not the server's.
  const defaultDate = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date())

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission"
      title="Buat mission"
      description="Catat kunjungan yang sudah pasti, lalu tentukan sales yang berangkat."
      action={<BackLink />}
    >
      <MissionForm
        salesOptions={salesOptions}
        defaultDate={defaultDate}
        fields={fields}
        schedules={schedules}
        conflictSettings={settings}
      />
    </WorkspacePage>
  )
}
