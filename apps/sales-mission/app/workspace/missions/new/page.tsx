import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission, getMissionSettings, listMissionTeam, listTeamSchedules, listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionForm, type MissionPrefill } from "./mission-form"

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string }>
}) {
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
  const params = await searchParams

  // Default to today in Werkudara's timezone, not the server's. The calendar
  // passes the day that was clicked, which is what Google Calendar and
  // Outlook do when you click an empty day: the event starts there.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(now)
  const defaultDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today

  // "Jadwalkan lagi" on a cancelled mission: everything but the date carries
  // over. The rep only reads it if it belongs to their tenant, which getMission
  // already enforces.
  let prefill: MissionPrefill | undefined
  if (params.from && /^[0-9a-f-]{36}$/i.test(params.from)) {
    const source = await getMission(access, params.from)
    if (source) {
      const team = await listMissionTeam(access, params.from)
      prefill = {
        clientCompanyName: source.clientCompanyName,
        clientCompanyId: source.clientCompanyId,
        missionType: source.missionType,
        location: source.location ?? "",
        objective: source.objective ?? "",
        primarySalesId: team.find((member) => member.role === "PRIMARY")?.userId ?? "",
        supportingSalesIds: team.filter((member) => member.role === "SUPPORTING").map((member) => member.userId),
        contactSalutation: source.appointment.salutation ?? "",
        contactId: source.appointment.contactId ?? "",
        contactName: source.appointment.name ?? "",
        contactJobTitle: source.appointment.jobTitle ?? "",
        contactDivision: source.appointment.division ?? "",
        contactPhone: source.appointment.phone ?? "",
        contactEmail: source.appointment.email ?? "",
        building: source.appointment.building ?? "",
        appointmentNotes: source.appointment.notes ?? "",
      }
    }
  }

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission"
      title={prefill ? "Jadwalkan lagi" : "Buat mission"}
      description={
        prefill
          ? `Kunjungan ke ${prefill.clientCompanyName} dibuat ulang dengan data yang sama. Tentukan tanggal barunya.`
          : "Catat kunjungan yang sudah pasti, lalu tentukan sales yang berangkat."
      }
      action={<BackLink />}
    >
      <MissionForm
        salesOptions={salesOptions}
        defaultDate={defaultDate}
        fields={fields}
        schedules={schedules}
        conflictSettings={settings}
        prefill={prefill}
      />
    </WorkspacePage>
  )
}
