import { notFound, redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { resolveMissionGates } from "@/lib/missions/mission-rights"
import { describeOutOfScope, personInScope } from "@/lib/access/record-scope"
import { requireModule } from "@/lib/missions/nav-access"
import {
  getMission,
  getMissionRole,
  getMissionSettings,
  listMissionTeam,
  listTeamSchedules,
  listTenantSales,
} from "@/lib/missions/mission-queries"
import { getMissionFieldValues, listFormFields } from "@/lib/missions/form-field-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { updateMission } from "@/app/actions/mission-actions"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { MissionForm, type MissionPrefill } from "@/app/workspace/activities/new/mission-form"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

/**
 * Ubah mission.
 *
 * The create form, filled in. Same fields, same validation, same order the
 * admin configured, so there is one form to learn. What it will not do is
 * move the schedule: that is Pindahkan jadwal on the detail page, which
 * tells the team and, under confirmation, re-asks them.
 */
export default async function EditMissionPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId: missionId } = await params
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const [mission, role, settings] = await Promise.all([getMission(access, missionId), getMissionRole(access, missionId), getMissionSettings(access)])
  if (!mission) notFound()

  const gates = await resolveMissionGates(access, mission, role, settings)
  const closed = mission.status === "COMPLETED" || mission.status === "CANCELLED"

  if (!gates.canEdit) {
    // Say which rule refused, in the matrix's own words: a closed mission is
    // history; an open one is outside the Cakupan the role holds.
    return (
      <WorkspacePage eyebrow="Sales Activity / Aktivitas" title="Ubah aktivitas" action={<BackLink href={paths.activity(missionId)} />}>
        <EmptyState
          title="Aktivitas ini tidak bisa diubah"
          description={
            closed
              ? "Aktivitas yang sudah selesai atau dibatalkan adalah riwayat; tidak diubah lagi."
              : describeOutOfScope(gates.missionCtx.scope, "mission")
          }
        />
      </WorkspacePage>
    )
  }

  const now = new Date()
  const [team, fields, salesOptions, schedules, customValues] = await Promise.all([
    listMissionTeam(access, missionId),
    listFormFields(access, "mission"),
    listTenantSales(access),
    listTeamSchedules(access, now),
    getMissionFieldValues(access, missionId),
  ])

  const wib = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(iso))

  const prefill: MissionPrefill = {
    clientCompanyName: mission.clientCompanyName,
    clientCompanyId: mission.clientCompanyId,
    missionType: mission.missionType,
    location: mission.location ?? "",
    objective: mission.objective ?? "",
    primarySalesId: team.find((member) => member.role === "PRIMARY")?.userId ?? "",
    supportingSalesIds: team.filter((member) => member.role === "SUPPORTING").map((member) => member.userId),
    contactSalutation: mission.appointment.salutation ?? "",
    contactId: mission.appointment.contactId ?? "",
    contactName: mission.appointment.name ?? "",
    contactJobTitle: mission.appointment.jobTitle ?? "",
    contactDivision: mission.appointment.division ?? "",
    contactPhone: mission.appointment.phone ?? "",
    contactEmail: mission.appointment.email ?? "",
    building: mission.appointment.building ?? "",
    address: mission.address ?? "",
    appointmentNotes: mission.appointment.notes ?? "",
  }

  const schedule = {
    date: mission.scheduledStart ? day(mission.scheduledStart) : day(now.toISOString()),
    startTime: mission.scheduledStart ? wib(mission.scheduledStart) : "09:30",
    endTime: mission.scheduledEnd ? wib(mission.scheduledEnd) : "",
  }

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Aktivitas"
      title="Ubah aktivitas"
      description={`Perbaiki detail kunjungan ke ${mission.clientCompanyName}. Kalau jadwalnya ikut berubah, tim diberi tahu saat disimpan.`}
      action={<BackLink href={paths.activity(missionId)} />}
    >
      <MissionForm
        // The current sales utama stays choosable even when out of reach, so
        // the form can be saved without silently reassigning the visit.
        salesOptions={salesOptions.map((person) => ({
          ...person,
          canLead: person.canLead && (personInScope(gates.missionCtx, person.id) || person.id === prefill.primarySalesId),
        }))}
        defaultDate={schedule.date}
        fields={fields}
        schedules={schedules}
        conflictSettings={settings}
        prefill={prefill}
        edit={{
          missionId,
          action: updateMission.bind(null, missionId),
          schedule,
          customValues,
          canMoveSchedule: gates.scheduleMode === "move",
        }}
      />
    </WorkspacePage>
  )
}
