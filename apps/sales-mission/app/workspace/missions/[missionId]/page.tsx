import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Ban, Building2, CalendarDays, ClipboardList, ExternalLink, Mail, MapPin, Pencil, Phone, RotateCcw, UsersRound } from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { PersonAvatar } from "@/components/person-avatar"
import { getProspectByMission } from "@/lib/prospects/prospect-queries"
import { formatPhone, normalizePhone } from "@/lib/format/phone"
import {
  getCancellation,
  getLeadPush,
  getMission,
  getMissionRole,
  getMissionSettings,
  getPendingReschedule,
  getVisitReport,
  listMissionTeam,
  listSupportingNotes,
  listViewerCalendar,
  listTeamSchedules,
  listTenantSales,
} from "@/lib/missions/mission-queries"
import { annotateJoinStatus, joinBlockedReason } from "@/lib/missions/mission-join"
import { awaitsConfirmation, canRespond } from "@/lib/missions/assignment-workflow"
import {
  AssignmentResponsePanel,
  RescheduleDecision,
  type RescheduleOptions,
} from "./assignment-response"
import type { PersonSchedule } from "@/lib/missions/schedule-availability"
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
import { BackLink, JoinStatusLine, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"
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
import { CancelMissionButton } from "./cancel-mission"
import { visitReachesCrm } from "@/lib/missions/crm-sync"
import { getLastEdit } from "@/lib/audit/audit-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"

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
  if (!mission) notFound()

  // This page carries three different kinds of content, and the mission guard
  // above only covers one of them. Without these two the reporting module could
  // be revoked — hiding the Laporan screen and refusing the CSV export — and
  // every report would still be readable one mission at a time from here.
  const [role, canReadReport, canReadContacts, notes, canCreateMission] = await Promise.all([
    getMissionRole(access, missionId),
    canPerform(access, "sales_mission_result", "read"),
    canPerform(access, "sales_mission_contact", "read"),
    listSupportingNotes(access, missionId),
    canPerform(access, "sales_mission_mission", "create"),
  ])
  const [report, leadPush] = canReadReport
    ? await Promise.all([getVisitReport(access, missionId), getLeadPush(access, missionId)])
    : [null, null]
  const [team, settings, ownCalendar] = await Promise.all([
    listMissionTeam(access, missionId),
    getMissionSettings(access),
    listViewerCalendar(access),
  ])
  const [pendingReschedule, salesOptions, schedules, cancellation, lastEdit, sourceProspect] = await Promise.all([
    getPendingReschedule(access, missionId),
    listTenantSales(access),
    listTeamSchedules(access, new Date()),
    mission.status === "CANCELLED" ? getCancellation(access, missionId) : Promise.resolve(null),
    getLastEdit(access, missionId),
    getProspectByMission(access, missionId),
  ])
  const reportFields = report ? await listFormFields(access, "visit_report") : []
  const customAnswers = report
    ? reportFields
        .filter((field) => !field.isCore && field.isActive)
        .map((field) => ({ field, value: report.custom[field.reportingKey] }))
        .filter(({ value }) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0))
    : []
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

  const isAssigned = role !== null
  const isCancelled = mission.status === "CANCELLED"
  // Calling it off before it happens: the primary, whoever scheduled it, or an
  // admin. Not after the visit is over; that is history.
  const canCancel =
    !isCancelled &&
    mission.status !== "COMPLETED" &&
    (access.isSuperAdmin || role === "PRIMARY" || mission.createdBy === access.userId)
  // Details can be corrected by whoever scheduled it, the primary, or an
  // admin, while the visit is still ahead. The schedule moves elsewhere.
  const canEdit =
    !isCancelled &&
    mission.status !== "COMPLETED" &&
    (access.isSuperAdmin || role === "PRIMARY" || mission.createdBy === access.userId)
  const canWriteReport = role === "PRIMARY" || access.isSuperAdmin
  const canManageTeam = role === "PRIMARY" || access.isSuperAdmin
  const reportSubmitted = report?.status === "SUBMITTED"

  // Join eligibility is computed against the viewer's whole calendar, so it
  // needs the tenant's missions rather than this one alone.
  const joinStatus = annotateJoinStatus([mission], settings, ownCalendar)[0]?.joinStatus ?? "CLOSED"
  const blockedReason = joinBlockedReason(joinStatus, settings.maxSupporting)

  const myResponse = (team.find((member) => member.userId === access.userId)?.response ?? "PENDING") as AssignmentResponse
  // The one thing this page asks of the viewer while confirmation is on. It
  // leads the page; nothing below it is what they came here for until then.
  // Someone who scheduled the visit and put themself on it has nothing to
  // answer: their answer was the scheduling. No banner, no Terima, no Tolak.
  const selfScheduled = isAssigned && mission.createdBy === access.userId
  const askedToConfirm = isAssigned && !selfScheduled && awaitsConfirmation(myResponse, settings) && canRespond(mission.status)
  // Whether the Penugasan card has anything to offer once the answer is
  // given: an answer to change, a decline to take back, or a proposal to
  // make. Moving the slot is on the Ubah form, so it is not counted here.
  const canProposeHere = !(access.isSuperAdmin || mission.createdBy === access.userId || (role === "PRIMARY" && settings.primaryCanReschedule))
  const answerActions = selfScheduled
    ? canProposeHere
    : settings.requireAssignmentConfirmation || myResponse === "REJECTED" || canProposeHere
  // Seed the reschedule picker with the mission's own slot rather than today,
  // so the common case of nudging a visit by an hour needs one change.
  const wib = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour12: false, ...opts }).format(new Date(iso))
  const rescheduleInitial = {
    date: mission.scheduledStart
      ? new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(mission.scheduledStart))
      : new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date()),
    startTime: mission.scheduledStart ? wib(mission.scheduledStart, { hour: "2-digit", minute: "2-digit" }) : "09:30",
    endTime: mission.scheduledEnd ? wib(mission.scheduledEnd, { hour: "2-digit", minute: "2-digit" }) : "",
  }
  // The primary moves the visit directly when the tenant allows it, as does
  // an admin; everyone else proposes. The picker sees the whole team's
  // calendars either way, so nobody picks a time blind.
  const teamIds = new Set(team.map((member) => member.userId))
  const reschedule: RescheduleOptions = {
    mode: access.isSuperAdmin || (role === "PRIMARY" && settings.primaryCanReschedule) ? "move" : "propose",
    initial: rescheduleInitial,
    people: schedules.filter((person): person is PersonSchedule => teamIds.has(person.userId)),
    settings,
    location: mission.location,
  }

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission detail"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      action={<BackLink />}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {isCancelled && (
            <section className="rounded-xl border border-[var(--danger-foreground)]/25 bg-[var(--danger)] p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--danger-foreground)]">
                <Ban className="h-4 w-4" /> Mission dibatalkan
              </h2>
              {cancellation && (
                <p className="mt-1 text-sm text-[var(--danger-foreground)]">
                  {cancellation.byName}, {formatMissionSchedule(cancellation.at, new Date())}
                  {cancellation.reason ? `: “${cancellation.reason}”` : "."}
                </p>
              )}
              {canCreateMission && (
                <div className="mt-4 flex sm:justify-end">
                  <Button asChild className="h-11">
                    <Link href={`/workspace/missions/new?from=${missionId}`}>
                      <RotateCcw className="h-4 w-4" /> Jadwalkan lagi
                    </Link>
                  </Button>
                </div>
              )}
            </section>
          )}

          {askedToConfirm && (
            <AssignmentResponsePanel
              missionId={missionId}
              myResponse={myResponse}
              reschedule={reschedule}
              banner
            />
          )}

          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <StatusBadge status={mission.status} />
              <span className="font-mono text-[11px] text-muted-foreground">ID {mission.id}</span>
              {canEdit && (
                <Button asChild variant="outline" size="sm" className="ml-auto">
                  <Link href={`/workspace/missions/${missionId}/edit`}>
                    <Pencil className="h-4 w-4" /> Ubah
                  </Link>
                </Button>
              )}
            </div>

            <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Fact icon={CalendarDays} label="Jadwal" value={formatMissionSchedule(mission.scheduledStart, new Date())} />
              <Fact icon={MapPin} label="Lokasi" value={[mission.address, mission.appointment.building, mission.location].filter(Boolean).join(", ") || "Belum diisi"} />
              <Fact icon={UsersRound} label="Sales utama" value={mission.primarySalesName ?? "Belum ditugaskan"} />
            </div>

            <div className="border-t px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tujuan kunjungan</p>
              <h2 className="mt-2 text-base font-semibold leading-relaxed text-foreground">
                {mission.objective ?? "Objective belum diisi."}
              </h2>
            </div>

            {/* Provenance lives here, not in the list: who booked it is what
                you want once you are looking at the visit, not while scanning
                for one. The full history is in Riwayat aktivitas. */}
            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
              <span>Dijadwalkan oleh <span className="font-medium text-foreground">{mission.createdByName ?? "Nama tidak diketahui"}</span> · {stamp(mission.createdAt)}</span>
              {lastEdit && (
                <span>Diubah terakhir oleh <span className="font-medium text-foreground">{lastEdit.byName}</span> · {stamp(lastEdit.at)}</span>
              )}
              {sourceProspect && (
                <span>Dari prospek <Link href={`/workspace/prospects/${sourceProspect.id}`} className="font-medium text-primary hover:underline">{sourceProspect.clientCompanyName}</Link></span>
              )}
            </p>

            {canCancel && (
              <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
                <p className="text-xs text-muted-foreground">Klien membatalkan atau sales berhalangan sebelum berangkat?</p>
                <CancelMissionButton missionId={missionId} clientName={mission.clientCompanyName} />
              </div>
            )}
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
                    <dd><a href={`tel:${normalizePhone(mission.appointment.phone)}`} className="text-sm font-medium text-primary hover:underline">{formatPhone(mission.appointment.phone)}</a></dd>
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

          {/*
            The answer itself now leads the page (the banner above) while it is
            being asked. This card keeps what is left: a reschedule decision for
            the primary, and, once answered or with confirmation off, the way to
            decline or propose another time. `id` lets the list's overflow menu
            deep-link here.
          */}
          {canRespond(mission.status) && (pendingReschedule || (isAssigned && !askedToConfirm && answerActions)) && (
            <article id="jawaban" className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Penugasan</p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {settings.requireAssignmentConfirmation ? "Jawaban dan jadwal" : "Jadwal"}
                </h2>
              </div>
              <div className="space-y-5 px-5 py-5">
                {/* A proposal is decided by someone other than its author. The
                    primary decides a supporting sales' proposal; an admin
                    decides the primary's, when the tenant makes them propose. */}
                {pendingReschedule && canManageTeam && pendingReschedule.requestedById !== access.userId && (
                  <RescheduleDecision request={pendingReschedule} confirmationRequired={settings.requireAssignmentConfirmation} />
                )}

                {pendingReschedule && (!canManageTeam || pendingReschedule.requestedById === access.userId) && (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    {pendingReschedule.requestedById === access.userId
                      ? "Usulan jadwal Anda menunggu keputusan admin."
                      : `${pendingReschedule.requestedByName} mengusulkan jadwal lain. Menunggu keputusan sales utama atau admin.`}
                  </p>
                )}

                {isAssigned && !askedToConfirm && canRespond(mission.status) && (
                  <AssignmentResponsePanel
                    missionId={missionId}
                    myResponse={myResponse}
                    reschedule={reschedule}
                    confirmationRequired={settings.requireAssignmentConfirmation}
                    selfScheduled={selfScheduled}
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

        </div>

        <div className="min-w-0 space-y-4">
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
              <JoinStatusLine status={joinStatus} />
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
                  {canManageTeam && !isCancelled && member.role === "SUPPORTING" && (
                    <RemoveMemberButton missionId={missionId} userId={member.userId} name={member.name} />
                  )}
                </li>
              ))}
              {team.length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">Belum ada yang ditugaskan.</li>
              )}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-5 py-4">
              {isCancelled ? (
                <p className="text-sm text-muted-foreground">Mission dibatalkan; tim tidak bisa diubah lagi.</p>
              ) : (
                <>
                  {role === "SUPPORTING" && <LeaveButton missionId={missionId} />}
                  {role === null && <JoinButton missionId={missionId} status={joinStatus} maxSupporting={settings.maxSupporting} />}
                  {canManageTeam && <AllowJoinToggle missionId={missionId} allowJoin={mission.allowJoin} />}
                </>
              )}
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

      {/* The report is the widest thing on the page: a summary, needs, contacts,
          the CRM hand-off. It gets the full width below the two columns rather
          than the left one, where it trailed on alone under a short right column. */}
      <article className="mt-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Laporan kunjungan</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {!canReadReport
                ? "Tidak termasuk akses Anda"
                : report
                  ? reportSubmitted
                    ? "Sudah diisi"
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

            {customAnswers.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                {customAnswers.map(({ field, value }) => (
                  <ReportField
                    key={field.id}
                    label={field.label}
                    value={
                      typeof value === "boolean" ? (value ? "Ya" : "Tidak")
                      : Array.isArray(value) ? value.map(String).join(", ")
                      : String(value)
                    }
                  />
                ))}
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
                      {contact.isDecisionMaker ? <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">Pengambil keputusan</span> : null}
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

            {!leadPush && canPushLead(report) && !canWriteReport && (
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

        {/* One push per mission. Once it exists the form is gone for good and
            what remains is the record: which lead, when, by whom, owned by whom.
            The record is read here on the server so a refresh after the push
            shows it at once; the form's own "sudah dikirim" state only covers
            the moment before that refresh lands. */}
        {leadPush ? (
          <div className="border-t">
            <div className="border-b bg-muted/30 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Integrasi</p>
              <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-foreground">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--success-foreground)]" aria-hidden />
                Terkirim ke LeadEngine
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                Lead <span className="font-mono text-foreground">#{leadPush.leadId}</span> dibuat {stamp(leadPush.pushedAt)} oleh {leadPush.pushedByName}. Pemilik lead: {leadPush.ownerName}.
              </p>
              {leadEngineUrl && (
                <Button asChild variant="outline" className="h-10">
                  <a href={`${leadEngineUrl}/leads/${leadPush.leadId}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Buka lead di LeadEngine
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : report && canPushLead(report) && canWriteReport ? (
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
        ) : null}

        {/* Once submitted the report is shown in full above, so there is
            nothing left to open. */}
        {canReadReport && canWriteReport && !reportSubmitted && !isCancelled && (
          <div className="border-t bg-muted/30 px-5 py-4">
            {askedToConfirm ? (
              // A report on a visit the rep has not agreed to make yet is
              // a contradiction; the button waits for the answer above.
              <p className="text-sm text-muted-foreground">
                Terima penugasan di atas dulu, lalu laporan bisa diisi setelah kunjungan.
              </p>
            ) : (
              <Button asChild className="h-11 w-full sm:w-auto">
                <Link href={`/workspace/missions/${missionId}/report`}>
                  <ClipboardList className="h-4 w-4" />
                  {report ? "Lanjutkan laporan" : "Isi laporan kunjungan"}
                </Link>
              </Button>
            )}
          </div>
        )}
      </article>
    </WorkspacePage>
  )
}
