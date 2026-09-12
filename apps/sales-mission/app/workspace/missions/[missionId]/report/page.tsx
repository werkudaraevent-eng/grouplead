import { notFound, redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMission, getMissionRole, getVisitReport, listTenantSales } from "@/lib/missions/mission-queries"
import { getReportOptions } from "@/lib/missions/report-options"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { VisitReportForm } from "./visit-report-form"

export const dynamic = "force-dynamic"

export default async function VisitReportPage({ params }: { params: Promise<{ missionId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_result")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  if (!mission) notFound()

  const [role, report, options, salesOptions] = await Promise.all([
    getMissionRole(access, missionId),
    getVisitReport(access, missionId),
    getReportOptions(),
    listTenantSales(access),
  ])

  const canWrite = role === "PRIMARY" || access.isSuperAdmin

  // A submitted report is already rendered in full on the detail page. Showing
  // the form again would mean a screen that accepts typing and silently
  // discards it, since autosave is off once submitted.
  if (report?.status === "SUBMITTED") redirect(`/workspace/missions/${missionId}`)

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
        options={options}
        salesOptions={salesOptions}
      />
    </WorkspacePage>
  )
}
