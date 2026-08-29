import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { CalendarDays, ClipboardList, MapPin, UsersRound } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import {
  getMission,
  getMissionRole,
  getVisitReport,
  listSupportingNotes,
} from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import {
  INTEREST_LEVEL_LABELS,
  NEXT_ACTION_LABELS,
  VISIT_OUTCOME_LABELS,
  canPushLead,
} from "@/lib/missions/visit-report-schema"
import { BackLink, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { SupportingNotes } from "./supporting-notes"

export const dynamic = "force-dynamic"

function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}

export default async function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  // getMission is tenant-scoped, so a mission in another tenant is
  // indistinguishable from one that does not exist. That is the intent.
  if (!mission) notFound()

  const [role, report, notes] = await Promise.all([
    getMissionRole(access, missionId),
    getVisitReport(access, missionId),
    listSupportingNotes(access, missionId),
  ])

  const isAssigned = role !== null
  const canWriteReport = role === "PRIMARY" || access.isSuperAdmin
  const reportSubmitted = report?.status === "SUBMITTED"

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission detail"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      action={<BackLink />}
    >
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <StatusBadge status={mission.status} />
              <span className="font-mono text-[11px] text-muted-foreground">ID {mission.id}</span>
            </div>

            <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Fact icon={CalendarDays} label="Schedule" value={formatMissionSchedule(mission.scheduledStart, new Date())} />
              <Fact icon={MapPin} label="Location" value={mission.location ?? "Belum diisi"} />
              <Fact icon={UsersRound} label="Primary sales" value={mission.primarySalesName ?? "Belum ditugaskan"} />
            </div>

            <div className="border-t px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Objective</p>
              <h2 className="mt-2 text-base font-semibold leading-relaxed text-foreground">
                {mission.objective ?? "Objective belum diisi."}
              </h2>
            </div>
          </article>

          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Laporan kunjungan</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {report ? (reportSubmitted ? "Sudah dikirim" : "Draft tersimpan") : "Belum diisi"}
                </h2>
              </div>
              {report && <StatusBadge status={report.status} />}
            </div>

            {report ? (
              <div className="space-y-5 px-5 py-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <ReportField label="Hasil" value={report.visitOutcome ? VISIT_OUTCOME_LABELS[report.visitOutcome] : "—"} />
                  <ReportField label="Tingkat minat" value={report.interestLevel ? INTEREST_LEVEL_LABELS[report.interestLevel] : "—"} />
                  <ReportField label="Next action" value={NEXT_ACTION_LABELS[report.nextActionType]} />
                  <ReportField label="Follow-up" value={report.followUpDate ?? "—"} />
                </div>

                {report.meetingSummary && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ringkasan</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{report.meetingSummary}</p>
                  </div>
                )}

                {report.clientNeeds.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Kebutuhan klien</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {report.clientNeeds.map((need) => (
                        <span key={need} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{need}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.contacts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ketemu siapa</p>
                    <ul className="mt-2 space-y-1.5">
                      {report.contacts.map((contact, index) => (
                        <li key={index} className="text-sm text-foreground">
                          {contact.fullName}
                          {contact.jobTitle ? <span className="text-muted-foreground"> · {contact.jobTitle}</span> : null}
                          {contact.isDecisionMaker ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">Pengambil keputusan</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {canPushLead(report) && (
                  <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Laporan ini menandai adanya peluang. Pengiriman ke LeadEngine tersedia di fase berikutnya.
                  </p>
                )}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {canWriteReport
                  ? "Isi laporan setelah kunjungan selesai."
                  : "Laporan diisi oleh sales utama."}
              </p>
            )}

            {/* Once submitted the report is shown in full above, so there is
                nothing left to open. */}
            {canWriteReport && !reportSubmitted && (
              <div className="border-t bg-muted/30 px-5 py-4">
                <Button asChild className="h-11 w-full sm:w-auto">
                  <Link href={`/workspace/missions/${missionId}/report`}>
                    <ClipboardList className="h-4 w-4" />
                    {report ? "Lanjutkan laporan" : "Isi laporan kunjungan"}
                  </Link>
                </Button>
              </div>
            )}
          </article>
        </div>

        <div className="space-y-4">
          <aside className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Assignment</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Supporting sales</h2>
            </div>
            {mission.supportingSalesNames.length > 0 ? (
              <ul className="divide-y">
                {mission.supportingSalesNames.map((name) => (
                  <li key={name} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                      {name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                    <span className="truncate font-medium text-foreground">{name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Tidak ada sales pendukung untuk mission ini.</p>
            )}
          </aside>

          <aside className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Catatan pendukung</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Pengamatan tim</h2>
            </div>
            <SupportingNotes missionId={missionId} notes={notes} canAdd={isAssigned || access.isSuperAdmin} />
          </aside>
        </div>
      </section>
    </WorkspacePage>
  )
}
