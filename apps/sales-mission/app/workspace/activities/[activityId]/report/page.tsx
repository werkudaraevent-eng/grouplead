import { notFound, redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { resolveMissionGates } from "@/lib/missions/mission-rights"
import { describeOutOfScope } from "@/lib/access/record-scope"
import { canEditSubmittedReport } from "@/lib/missions/report-edit"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { requireModule } from "@/lib/missions/nav-access"
import {
  getLeadPush,
  getMission,
  getMissionRole,
  getMissionSettings,
  getVisitReport,
  listMissionTeam,
  listTenantSales,
} from "@/lib/missions/mission-queries"
import { awaitsConfirmation } from "@/lib/missions/assignment-workflow"
import { listFormFields } from "@/lib/missions/form-field-queries"
import type { AssignmentResponse } from "@/lib/missions/mission-schema"
import { getReportOptions } from "@/lib/missions/report-options"
import { contactFromAppointment } from "@/lib/missions/visit-report-schema"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { VisitReportForm } from "./visit-report-form"
import { paths } from "@/lib/paths"
import { describeReportOpens, reportLocked } from "@/lib/missions/report-window"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"

export const dynamic = "force-dynamic"

export default async function VisitReportPage({ params, searchParams }: { params: Promise<{ activityId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const { activityId: missionId } = await params
  const mission = await getMission(access, missionId)
  if (!mission) notFound()

  const [role, report, options, salesOptions, settings, team, fields, choices] = await Promise.all([
    getMissionRole(access, missionId),
    getVisitReport(access, missionId),
    getReportOptions(),
    listTenantSales(access),
    getMissionSettings(access),
    listMissionTeam(access, missionId),
    listFormFields(access, "visit_report"),
    listReportChoices(access),
  ])

  // The matrix decides: result:create, within the Cakupan that reaches the
  // report's author. The sales utama owns it; a supervisor reaches it.
  const gates = await resolveMissionGates(access, mission, role, settings)
  const canWrite = gates.canWriteReport

  // Typing the URL must not get around the answer the detail page asks for.
  // A report on a visit the rep has not agreed to make is a contradiction.
  const myResponse = team.find((member) => member.userId === access.userId)?.response ?? "PENDING"
  if (role === "PRIMARY" && awaitsConfirmation(myResponse as AssignmentResponse, settings) && !report) {
    redirect(paths.activity(missionId))
  }

  // A submitted report is already rendered in full on the detail page. The
  // form opens on it only as an explicit edit (?edit=1) by someone the
  // tenant's rule allows: its author inside the window, or a supervisor.
  let editing: { leadPushed: boolean } | null = null
  if (report?.status === "SUBMITTED") {
    const { edit } = await searchParams
    const verdict = canEditSubmittedReport({
      supervises: gates.supervisesReport,
      isAuthor: gates.isAuthor,
      submittedAt: report.submittedAt,
      now: new Date(),
      windowDays: settings.reportEditWindowDays,
    })
    if (edit !== "1" || !verdict.allowed) redirect(paths.activity(missionId))
    editing = { leadPushed: Boolean(await getLeadPush(access, missionId)) }
  }

  // Supporting sales get a clear explanation rather than a disabled form they
  // cannot use. The person accountable in the room writes the report.
  if (!canWrite && !report) {
    return (
      <WorkspacePage
        eyebrow="Sales Activity / Laporan kunjungan"
        title={mission.clientCompanyName}
        description="Laporan kunjungan"
        action={<BackLink href={paths.activity(missionId)} />}
      >
        <EmptyState
          title={role === "SUPPORTING" ? "Laporan diisi oleh sales utama" : "Laporan ini di luar jangkauan Anda"}
          description={
            role === "SUPPORTING"
              ? "Anda terdaftar sebagai sales pendukung. Tambahkan catatan pendukung dari halaman detail aktivitas."
              : describeOutOfScope(gates.resultCtx.scope, "laporan")
          }
        />
      </WorkspacePage>
    )
  }

  // Not before the visit: the form opens at the start of the scheduled day.
  // Typing the URL early gets the same answer the detail page gives.
  const lock = settings.reportAfterVisitOnly && !report ? reportLocked(mission.scheduledStart, new Date()) : null
  if (lock) {
    return (
      <WorkspacePage
        eyebrow="Sales Activity / Laporan kunjungan"
        title={mission.clientCompanyName}
        description="Laporan kunjungan"
        action={<BackLink href={paths.activity(missionId)} />}
      >
        <EmptyState
          title={describeReportOpens(lock.until)}
          description={`Kunjungan ini dijadwalkan ${formatMissionSchedule(mission.scheduledStart, new Date())}. Kalau kunjungannya dimajukan, pindahkan jadwalnya dulu dari halaman aktivitas supaya tim tahu.`}
        />
      </WorkspacePage>
    )
  }

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Laporan kunjungan"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      // On a phone the section chips stick right under the app bar; a
      // second line of facts above them would stay on screen for the whole form.
      phoneDescription={false}
      action={<BackLink href={paths.activity(missionId)} />}
    >
      <VisitReportForm
        missionId={missionId}
        clientName={mission.clientCompanyName}
        schedule={{ start: mission.scheduledStart, end: mission.scheduledEnd }}
        afterVisitOnly={settings.reportAfterVisitOnly}
        report={report}
        appointmentContact={contactFromAppointment(mission.appointment)}
        editing={editing}
        choices={choices}
        options={options}
        salesOptions={salesOptions}
        fields={fields}
      />
    </WorkspacePage>
  )
}
