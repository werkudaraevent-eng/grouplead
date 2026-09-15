import { notFound, redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { canEditSubmittedReport } from "@/lib/missions/report-edit"
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

export const dynamic = "force-dynamic"

export default async function VisitReportPage({ params, searchParams }: { params: Promise<{ missionId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  if (!mission) notFound()

  const [role, report, options, salesOptions, settings, team, fields] = await Promise.all([
    getMissionRole(access, missionId),
    getVisitReport(access, missionId),
    getReportOptions(),
    listTenantSales(access),
    getMissionSettings(access),
    listMissionTeam(access, missionId),
    listFormFields(access, "visit_report"),
  ])

  const canWrite = role === "PRIMARY" || access.isSuperAdmin

  // Typing the URL must not get around the answer the detail page asks for.
  // A report on a visit the rep has not agreed to make is a contradiction.
  const myResponse = team.find((member) => member.userId === access.userId)?.response ?? "PENDING"
  if (role === "PRIMARY" && awaitsConfirmation(myResponse as AssignmentResponse, settings) && !report) {
    redirect(`/workspace/missions/${missionId}`)
  }

  // A submitted report is already rendered in full on the detail page. The
  // form opens on it only as an explicit edit (?edit=1) by someone the
  // tenant's rule allows: its author inside the window, or an admin.
  let editing: { leadPushed: boolean } | null = null
  if (report?.status === "SUBMITTED") {
    const { edit } = await searchParams
    const isAdmin = access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update"))
    const verdict = canEditSubmittedReport({
      isAdmin,
      isPrimary: role === "PRIMARY",
      submittedAt: report.submittedAt,
      now: new Date(),
      windowDays: settings.reportEditWindowDays,
    })
    if (edit !== "1" || !verdict.allowed) redirect(`/workspace/missions/${missionId}`)
    editing = { leadPushed: Boolean(await getLeadPush(access, missionId)) }
  }

  // Supporting sales get a clear explanation rather than a disabled form they
  // cannot use. The person accountable in the room writes the report.
  if (!canWrite && !report) {
    return (
      <WorkspacePage
        eyebrow="Sales Mission / Laporan kunjungan"
        title={mission.clientCompanyName}
        description="Laporan kunjungan"
        action={<BackLink href={`/workspace/missions/${missionId}`} />}
      >
        <EmptyState
          title="Laporan diisi oleh sales utama"
          description={
            role === "SUPPORTING"
              ? "Anda terdaftar sebagai sales pendukung. Tambahkan catatan pendukung dari halaman detail mission."
              : "Anda tidak ditugaskan pada mission ini."
          }
        />
      </WorkspacePage>
    )
  }

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Laporan kunjungan"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      action={<BackLink href={`/workspace/missions/${missionId}`} />}
    >
      <VisitReportForm
        missionId={missionId}
        clientName={mission.clientCompanyName}
        report={report}
        appointmentContact={contactFromAppointment(mission.appointment)}
        editing={editing}
        options={options}
        salesOptions={salesOptions}
        fields={fields}
      />
    </WorkspacePage>
  )
}
