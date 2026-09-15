import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { personInScope } from "@/lib/access/record-scope"
import { getMission, getMissionSettings, listMissionTeam, listTeamSchedules, listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionForm, type MissionPrefill } from "./mission-form"
import { getProspect } from "@/lib/prospects/prospect-queries"

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; prospect?: string }>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  // Typing the URL has to be refused too. Hiding the button only removes the
  // invitation; this removes the route.
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    redirect("/workspace/missions")
  }

  const now = new Date()
  const [people, fields, schedules, settings, missionCtx] = await Promise.all([
    listTenantSales(access),
    listFormFields(access, "mission"),
    listTeamSchedules(access, now),
    getMissionSettings(access),
    resolveScope(access, "sales_mission_mission"),
  ])
  // Naming the sales utama hands them the mission, so the choice stays
  // inside the viewer's Cakupan ubah: themself on Sendiri, their chain on
  // Tim, anyone on Semua. Supporting sales are invited, not handed anything.
  const salesOptions = people.map((person) => ({ ...person, canLead: person.canLead && personInScope(missionCtx, person.id) }))
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
        address: source.address ?? "",
        appointmentNotes: source.appointment.notes ?? "",
      }
    }
  }

  // Confirmed from the prospect list: the visit is scheduled here, with the
  // company, contact and address already filled. Saving marks the prospect.
  let prospectId: string | undefined
  if (params.prospect && /^[0-9a-f-]{36}$/i.test(params.prospect) && (await canPerform(access, "sales_mission_prospect", "read"))) {
    const prospect = await getProspect(access, params.prospect)
    if (prospect && !prospect.missionId) {
      prospectId = prospect.id
      prefill = {
        clientCompanyName: prospect.clientCompanyName,
        clientCompanyId: prospect.clientCompanyId,
        missionType: "",
        location: prospect.location ?? "",
        objective: "",
        primarySalesId: prospect.ownerId && salesOptions.some((option) => option.id === prospect.ownerId) ? prospect.ownerId : "",
        supportingSalesIds: [],
        contactSalutation: prospect.contactSalutation ?? "",
        contactId: "",
        contactName: prospect.contactName ?? "",
        contactJobTitle: prospect.contactJobTitle ?? "",
        contactDivision: prospect.contactDivision ?? "",
        contactPhone: prospect.contactPhone ?? "",
        contactEmail: prospect.contactEmail ?? "",
        building: "",
        address: prospect.address ?? "",
        appointmentNotes: prospect.notes ?? "",
      }
    }
  }

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission"
      title={prospectId ? "Jadwalkan kunjungan" : prefill ? "Jadwalkan lagi" : "Buat mission"}
      description={
        prospectId
          ? `Janji temu dengan ${prefill?.clientCompanyName} disepakati. Data prospek sudah terisi; tentukan jadwal dan tim yang berangkat, lalu prospek otomatis menjadi Confirmed.`
          : prefill
          ? `Kunjungan ke ${prefill.clientCompanyName} dibuat ulang dengan data yang sama. Tentukan tanggal barunya.`
          : "Catat kunjungan yang sudah pasti, lalu tentukan sales yang berangkat."
      }
      action={<BackLink />}
    >
      <MissionForm
        prospectId={prospectId}
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
