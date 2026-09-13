import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Building2, CalendarDays, ClipboardList, Mail, MapPin, Phone, UsersRound } from "lucide-react"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { PersonAvatar } from "@/components/person-avatar"
import {
  getMission,
  getMissionRole,
  getMissionSettings,
  getPendingReschedule,
  getVisitReport,
  listMissionTeam,
  listMissions,
  listSupportingNotes,
  listTenantSales,
} from "@/lib/missions/mission-queries"
import { annotateJoinStatus, joinBlockedReason } from "@/lib/missions/mission-join"
import { canRespond } from "@/lib/missions/assignment-workflow"
import {
  AssignmentResponsePanel,
  RescheduleDecision,
} from "./assignment-response"
import {
  formatContactName,
  formatMissionSchedule,
  hasAppointmentDetails,
  MISSION_TIME_ZONE,
  type AssignmentResponse,
} from "@/lib/missions/mission-schema"
import {
  INTEREST_LEVEL_LABELS,
  NEXT_ACTION_LABELS,
  VISIT_OUTCOME_LABELS,
  canPushLead,
} from "@/lib/missions/visit-report-schema"
import { BackLink, JoinStatusChip, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import {
  AllowJoinToggle,
  JoinButton,
  LeaveButton,
  RemoveMemberButton,
} from "@/app/workspace/missions/join-controls"
import { PushLeadPanel } from "./push-lead"
import { SupportingNotes } from "./supporting-notes"
import { CrmSyncStatus } from "./crm-sync-status"
import { visitReachesCrm } from "@/lib/missions/crm-sync"

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
  await requireModule(access, "sales_mission_mission")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  // getMission is tenant-scoped, so a mission in another tenant is
  // indistinguishable from one that does not exist. That is the intent.
  if (!mission) notFound()

  // This page carries three different kinds of content, and the mission guard
  // above only covers one of them. Without these two the reporting module could
  // be revoked — hiding the Laporan screen and refusing the CSV export — and
  // every report would still be readable one mission at a time from here.
  const [role, canReadReport, canReadContacts, notes] = await Promise.all([
    getMissionRole(access, missionId),
    canPerform(access, "sales_mission_result", "read"),
    canPerform(access, "sales_mission_contact", "read"),
    listSupportingNotes(access, missionId),
  ])
  const report = canReadReport ? await getVisitReport(access, missionId) : null
  const [team, settings, allMissions] = await Promise.all([
    listMissionTeam(access, missionId),
    getMissionSettings(access),
    listMissions(access),
  ])
  const [pendingReschedule, salesOptions] = await Promise.all([
    getPendingReschedule(access, missionId),
    listTenantSales(access),
  ])
  const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

  const isAssigned = role !== null
  const canWriteReport = role === "PRIMARY" || access.isSuperAdmin
  const canManageTeam = role === "PRIMARY" || access.isSuperAdmin
  const reportSubmitted = report?.status === "SUBMITTED"

  // Join eligibility is computed against the viewer's whole calendar, so it
  // needs the tenant's missions rather than this one alone.
  const joinStatus = annotateJoinStatus(allMissions, settings).find((item) => item.id === missionId)?.joinStatus ?? "CLOSED"
  const blockedReason = joinBlockedReason(joinStatus, settings.maxSupporting)

  const myResponse = (team.find((member) => member.userId === access.userId)?.response ?? "PENDING") as AssignmentResponse
  // Seed the reschedule form with the mission's own day rather than today, so
  // the common case of nudging a visit by an hour needs one field changed.
  const defaultRescheduleDate = mission.scheduledStart
    ? new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(mission.scheduledStart))
    : new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date())

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
              <Fact icon={CalendarDays} label="Jadwal" value={formatMissionSchedule(mission.scheduledStart, new Date())} />
              <Fact icon={MapPin} label="Lokasi" value={mission.location ?? "Belum diisi"} />
              <Fact icon={UsersRound} label="Sales utama" value={mission.primarySalesName ?? "Belum ditugaskan"} />
            </div>

            <div className="border-t px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tujuan kunjungan</p>
              <h2 className="mt-2 text-base font-semibold leading-relaxed text-foreground">
                {mission.objective ?? "Objective belum diisi."}
              </h2>
            </div>
          </article>

          {/*
            The rep reads this before walking in. It is often the only place the
            appointment team's context reaches them, so it sits high on the page
            rather than below the assignment controls.
          */}
          {canReadContacts && hasAppointmentDetails(mission.appointment) && (
            <article className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Janji temu</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {formatContactName(mission.appointment) ?? "Kontak belum diisi"}
                </h2>
                {(mission.appointment.jobTitle || mission.appointment.division) && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[mission.appointment.jobTitle, mission.appointment.division].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              <dl className="divide-y">
                {mission.appointment.phone && (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <dt className="sr-only">Telepon</dt>
                    {/* Tappable: a rep standing at reception should not retype it. */}
                    <dd><a href={`tel:${mission.appointment.phone}`} className="text-sm font-medium text-primary hover:underline">{mission.appointment.phone}</a></dd>
                  </div>
                )}
                {mission.appointment.email && (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <dt className="sr-only">Email</dt>
                    <dd><a href={`mailto:${mission.appointment.email}`} className="text-sm font-medium text-primary hover:underline">{mission.appointment.email}</a></dd>
                  </div>
                )}
                {mission.appointment.building && (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <dt className="sr-only">Gedung</dt>
                    <dd className="text-sm text-foreground">{mission.appointment.building}</dd>
                  </div>
                )}
              </dl>

              {mission.appointment.notes && (
                <div className="border-t bg-muted/30 px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Sudah dibicarakan saat membuat janji
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {mission.appointment.notes}
                  </p>
                </div>
              )}
            </article>
          )}

          {(isAssigned || pendingReschedule) && (
            <article className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Penugasan</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">Jawaban dan jadwal</h2>
              </div>
              <div className="space-y-5 px-5 py-5">
                {pendingReschedule && canManageTeam && <RescheduleDecision request={pendingReschedule} />}

                {pendingReschedule && !canManageTeam && (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    {pendingReschedule.requestedByName} meminta jadwal ulang. Menunggu keputusan sales utama atau admin.
                  </p>
                )}

                {isAssigned && canRespond(mission.status) && (
                  <AssignmentResponsePanel
                    missionId={missionId}
                    myResponse={myResponse}
                    defaultDate={defaultRescheduleDate}
                  />
                )}

                {isAssigned && !canRespond(mission.status) && (
                  <p className="text-sm text-muted-foreground">
                    Mission ini sudah tidak menerima perubahan jawaban.
                  </p>
                )}
              </div>
            </article>
          )}

          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Laporan kunjungan</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {!canReadReport
                    ? "Tidak termasuk akses Anda"
                    : report
                      ? reportSubmitted
                        ? "Sudah dikirim"
                        : "Draft tersimpan"
                      : "Belum diisi"}
                </h2>
              </div>
              {report && <StatusBadge status={report.status} />}
            </div>

            {!canReadReport ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Peran Anda tidak mencakup laporan kunjungan. Detail mission dan tim tetap terlihat.
              </p>
            ) : report ? (
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

                {canReadContacts && report.contacts.length > 0 && (
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

                {reportSubmitted && report.visitOutcome && (
                  <CrmSyncStatus
                    missionId={missionId}
                    syncedAt={report.crmSyncedAt}
                    error={report.crmSyncError}
                    reachesCrm={visitReachesCrm(report.visitOutcome)}
                    canRetry={canWriteReport}
                  />
                )}

                {canPushLead(report) && !canWriteReport && (
                  <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Laporan ini menandai adanya peluang. Sales utama dapat mengirimkannya ke LeadEngine.
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

            {report && canPushLead(report) && canWriteReport && (
              <div className="border-t">
                <div className="border-b bg-muted/30 px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Integrasi</p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">Kirim ke LeadEngine</h3>
                </div>
                <PushLeadPanel
                  missionId={missionId}
                  clientName={mission.clientCompanyName}
                  salesOptions={salesOptions}
                  defaultProjectName={mission.objective?.slice(0, 120) || `${mission.missionType} — ${mission.clientCompanyName}`}
                  leadEngineUrl={leadEngineUrl}
                />
              </div>
            )}

            {/* Once submitted the report is shown in full above, so there is
                nothing left to open. */}
            {canReadReport && canWriteReport && !reportSubmitted && (
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
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tim mission</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {team.length} orang
                  <span className="ml-1 font-normal text-muted-foreground">
                    (maks {settings.maxSupporting} pendukung)
                  </span>
                </h2>
              </div>
              <JoinStatusChip status={joinStatus} />
            </div>

            <ul className="divide-y">
              {team.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  <PersonAvatar name={member.name} avatarUrl={member.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{member.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {member.role === "PRIMARY" ? "Sales utama" : "Sales pendukung"}
                    </span>
                  </span>
                  {canManageTeam && member.role === "SUPPORTING" && (
                    <RemoveMemberButton missionId={missionId} userId={member.userId} name={member.name} />
                  )}
                </li>
              ))}
              {team.length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">Belum ada yang ditugaskan.</li>
              )}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-5 py-4">
              {role === "SUPPORTING" && <LeaveButton missionId={missionId} />}
              {role === null && <JoinButton missionId={missionId} status={joinStatus} maxSupporting={settings.maxSupporting} />}
              {canManageTeam && <AllowJoinToggle missionId={missionId} allowJoin={mission.allowJoin} />}
            </div>

            {role === null && blockedReason && (
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">{blockedReason}</p>
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
