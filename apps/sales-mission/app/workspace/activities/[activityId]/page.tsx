import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertCircle, Ban, Building2, CalendarDays, ClipboardList, ExternalLink, History, Mail, MapPin, Pencil, Phone, RotateCcw, Share, UsersRound } from "@/components/icons"
import { canEditSubmittedReport, describeEditWindow } from "@/lib/missions/report-edit"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { labelOf } from "@/lib/missions/report-choices"
import { parsePhotoAnswer } from "@/lib/photos/photo-answer"
import { describeTiming, formatVisitWindow } from "@/lib/missions/visit-time"
import { PhotoGallery } from "@/components/photo-gallery"
import { AudioList } from "@/components/audio-list"
import { parseAudioAnswer } from "@/lib/audio/audio-answer"
import { isAttachmentType } from "@/lib/missions/form-fields"
import { ReportActions } from "./report-actions"
import { ShareOfferBar, ShareOfferCard, type ShareOffer } from "./share-offer"
import { DeskShareNotice } from "./desk-share-notice"
import { FollowUpPanel } from "./follow-up-panel"
import { listMissionFollowUps } from "@/lib/missions/follow-up-queries"
import { choicesFor, kindOf } from "@/lib/missions/report-choices"
import { renderReportShare, reportShareValues } from "@/lib/missions/report-share"
import { formatNumber } from "@/lib/format/number"
import { signPhotoUrls } from "@/lib/photos/photo-storage"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { resolveMissionGates } from "@/lib/missions/mission-rights"
import { requireModule } from "@/lib/missions/nav-access"
import { PersonAvatar } from "@/components/person-avatar"
import { getProspectByMission } from "@/lib/prospects/prospect-queries"
import { describeReportOpens, reportLocked } from "@/lib/missions/report-window"
import { describeDueDate } from "@/lib/prospects/prospect-schema"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { formatPhone, normalizePhone } from "@/lib/format/phone"
import { describeAssessment, describeDisc, discCode } from "@/lib/contacts/disc"
import {
  getCancellation,
  getLeadPush,
  listReportVersions,
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
  canPushLead,
} from "@/lib/missions/visit-report-schema"
import { BackLink, JoinStatusLine, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { ResponsiveMenu } from "@/components/responsive-menu"
import { eventFromMission } from "@/lib/calendar/ics"
import { googleCalendarLink } from "@/lib/calendar/google-link"
import { requestOrigin } from "@/lib/request-origin"
import { FormActionBar } from "@/components/form-action-bar"
import { AcceptAssignmentButton, AssignmentOverflowMenu } from "@/app/workspace/activities/assignment-actions-menu"
import {
  AllowJoinToggle,
  JoinButton,
  LeaveButton,
  RemoveMemberButton,
} from "@/app/workspace/activities/join-controls"
import { PushLeadPanel } from "./push-lead"
import { SupportingNotes } from "./supporting-notes"
import { CrmSyncStatus } from "./crm-sync-status"
import { CancelMissionButton } from "./cancel-mission"
import { ActivityPhoneMenu } from "./activity-phone-menu"
import { visitReachesCrm } from "@/lib/missions/crm-sync"
import { getLastEdit } from "@/lib/audit/audit-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { Suspense } from "react"
import { ScrollToSection } from "@/components/scroll-to-section"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

/**
 * One fact as a property row (Linear and Notion properties, HubSpot's
 * "About" panel): a leading icon, the label in the muted ink, the value
 * in the regular body weight, each row as tall as its own value. Rows,
 * not columns: an address that runs to five lines then lengthens one
 * row, not the whole strip. Weight marks hierarchy only once per card
 * (the title), so the values are regular, and the label is sentence case
 * label-medium, not the tracked capitals Material 3 retired with
 * "overline".
 */
function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-5 py-3 sm:grid-cols-[1rem_7rem_minmax(0,1fr)]">
      <Icon className="h-4 w-4 self-center text-muted-foreground" aria-hidden="true" />
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-start-2 text-sm leading-relaxed text-foreground sm:col-start-3">{value}</dd>
    </div>
  )
}

/** One key fact in the report's highlights strip: label above value, on a tonal tile so the row reads as one band. */
function Highlight({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}

export default async function MissionDetailPage({ params }: { params: Promise<{ activityId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const { activityId: missionId } = await params
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
  const choices = report ? await listReportChoices(access) : null
  // The follow-ups this visit spawned, when the unit tracks them.
  const followUps = report && settings.followUpEnabled ? await listMissionFollowUps(access, missionId, choices) : []
  const customAnswers = report
    ? reportFields
        .filter((field) => (!field.isCore || field.fieldType === "PHOTO") && field.isActive)
        .map((field) => ({ field, value: report.custom[field.reportingKey] }))
        .filter(({ value }) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0))
    : []
  // The WhatsApp message for a sent report, and its first photo when the
  // template asks for one: the "visit_photos" field first, else any photo field.
  const share = report && report.status === "SUBMITTED" ? renderReportShare(settings.reportShareTemplate, reportShareValues({ mission, report, choices, team: team.map((member) => member.name) })) : null
  const photoAnswers = customAnswers.filter(({ field }) => field.fieldType === "PHOTO").map(({ field, value }) => ({ key: field.reportingKey, photos: parsePhotoAnswer(value) }))
  const firstPhoto = share?.withPhoto ? (photoAnswers.find((item) => item.key === "visit_photos" && item.photos.length > 0) ?? photoAnswers.find((item) => item.photos.length > 0))?.photos[0] ?? null : null
  const sharePhotoUrl = firstPhoto ? ((await signPhotoUrls(access, [firstPhoto.path])).get(firstPhoto.path) ?? null) : null
  // The photo travels under a name that says what it is, not the camera's number.
  const sharePhotoName = firstPhoto
    ? `${mission.clientCompanyName.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "kunjungan"}-${mission.scheduledStart ? missionDayKey(new Date(mission.scheduledStart)) : "laporan"}.${(firstPhoto.name.split(".").pop() || "jpg").toLowerCase()}`
    : null
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  const leadEngineUrl = process.env.NEXT_PUBLIC_LEADENGINE_URL?.trim() || null

  const isAssigned = role !== null
  const isCancelled = mission.status === "CANCELLED"
  // What this viewer may do here comes from the matrix: the grant on the
  // module and the Cakupan that says whose missions it reaches. Cancelling
  // and editing stop once the visit is history; managing the team does not.
  const gates = await resolveMissionGates(access, mission, role, settings)
  const { canCancel, canEdit, canWriteReport, canManageTeam, supervisesReport, isAuthor } = gates
  const reportSubmitted = report?.status === "SUBMITTED"
  // Changing a sent report: its author inside the tenant's window, a
  // supervisor whenever. The card says which, and until when.
  const editVerdict = report && reportSubmitted
    ? canEditSubmittedReport({ supervises: supervisesReport, isAuthor, submittedAt: report.submittedAt, now: new Date(), windowDays: settings.reportEditWindowDays })
    : null
  const editHint = editVerdict && isAuthor ? describeEditWindow(editVerdict, settings.reportEditWindowDays) : null
  const versions = report && canReadReport ? await listReportVersions(access, report.id) : []
  const primaryName = team.find((member) => member.role === "PRIMARY")?.name ?? null

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
  const canProposeHere = gates.scheduleMode !== "move"
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
  // Whoever the gates say may move the visit does so directly; everyone
  // else proposes. The picker sees the whole team's calendars either way, so
  // nobody picks a time blind.
  const teamIds = new Set(team.map((member) => member.userId))
  const reschedule: RescheduleOptions = {
    mode: gates.scheduleMode,
    initial: rescheduleInitial,
    people: schedules.filter((person): person is PersonSchedule => teamIds.has(person.userId)),
    settings,
    location: mission.location,
  }

  // On a phone the page has one bar at the bottom and one thing on it: the
  // next step for this viewer in this state. Answer first, then the report,
  // then joining, then editing. Everything else stays in its card, and the
  // top bar's overflow menu carries the links worth reaching without a scroll.
  // Not before the visit: under the tenant's rule the report opens at the
  // start of the scheduled day, and until then the button is a date.
  const reportLock = settings.reportAfterVisitOnly && !report ? reportLocked(mission.scheduledStart, new Date()) : null
  const baseAction: "answer" | "report" | "join" | "edit" | null = isCancelled
    ? null
    : askedToConfirm
      ? "answer"
      : canReadReport && canWriteReport && !reportSubmitted && !reportLock
        ? "report"
        : role === null && joinStatus === "JOINABLE"
          ? "join"
          : canEdit
            ? "edit"
            : null
  // Right after sending, the author's next step is the share: a success card
  // on the report and the bottom bar's one button, until it is shared or
  // put off. The unit can turn the offer off; the header button stays.
  const shareOffer: ShareOffer | null =
    share && report && isAuthor && settings.reportSharePrompt && !report.whatsappSharedAt && !isCancelled
      ? { missionId, text: share.text, photo: firstPhoto && sharePhotoUrl && sharePhotoName ? { url: sharePhotoUrl, name: sharePhotoName } : null }
      : null
  const compactAction: "answer" | "report" | "join" | "edit" | "share" | null =
    shareOffer && baseAction !== "answer" && baseAction !== "report" ? "share" : baseAction
  /** The phone's bottom bar for one next step; the share offer has its own bar. */
  const bar = (action: "answer" | "report" | "join" | "edit") => (
      <div className="flex items-center gap-2">
        {action === "answer" && (
          <>
            <AssignmentOverflowMenu missionId={missionId} />
            <AcceptAssignmentButton missionId={missionId} size="default" className="h-12 flex-1" />
          </>
        )}
        {action === "report" && (
          <Button asChild className="h-12 flex-1">
            <Link href={paths.activityReport(missionId)}>
              <ClipboardList className="h-4 w-4" /> {report ? "Lanjutkan laporan" : "Isi laporan kunjungan"}
            </Link>
          </Button>
        )}
        {action === "join" && (
          <JoinButton missionId={missionId} status={joinStatus} maxSupporting={settings.maxSupporting} clientName={mission.clientCompanyName} emphasis="filled" size="default" className="h-12 flex-1" />
        )}
        {action === "edit" && (
          <Button asChild variant="outline" className="h-12 flex-1">
            <Link href={paths.activityEdit(missionId)}>
              <Pencil className="h-4 w-4" /> Ubah aktivitas
            </Link>
          </Button>
        )}
        {canEdit && action !== "edit" && action !== "answer" && (
          <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0">
            <Link href={paths.activityEdit(missionId)} aria-label="Ubah aktivitas">
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
  )

  // "Tambah ke kalender": Google's template link opens a pre-filled event;
  // the .ics is for the iPhone Calendar and Outlook. Only a scheduled,
  // uncancelled visit has anything to add.
  const { origin, host } = await requestOrigin()
  const calendarEvent = isCancelled ? null : eventFromMission(mission, { url: `${origin}${paths.activity(missionId)}`, host })
  const calendarItems = calendarEvent
    ? [
        { label: "Google Calendar", href: googleCalendarLink(calendarEvent) },
        { label: "Unduh .ics (iPhone, Outlook)", href: paths.activityIcs(missionId) },
      ]
    : []
  const chromeMenu = [
    canEdit && compactAction !== "edit" ? { label: "Ubah aktivitas", href: paths.activityEdit(missionId) } : null,
    ...calendarItems.map((item) => ({ label: item.label === "Google Calendar" ? "Tambah ke Google Calendar" : "Tambah ke kalender (.ics)", href: item.href })),
    canReadReport ? { label: "Laporan kunjungan", href: paths.activity(missionId, { fokus: "laporan" }) } : null,
    leadPush && leadEngineUrl ? { label: "Buka lead di LeadEngine", href: `${leadEngineUrl}/leads/${leadPush.leadId}` } : null,
  ].filter((item): item is { label: string; href: string } => Boolean(item))

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Detail aktivitas"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.industry, mission.location].filter(Boolean).join(" · ")}
      // The facts card right under it carries the same three facts as rows.
      phoneDescription={false}
      action={<BackLink />}
    >
      {/* ?fokus=laporan from the lists: scroll the shell's panel, never the window. */}
      <Suspense fallback={null}><ScrollToSection /></Suspense>
      <ActivityPhoneMenu links={chromeMenu} cancel={canCancel ? { missionId, clientName: mission.clientCompanyName } : undefined} />
      {/* Two columns from lg; below that one column whose order is the
          rep's, not the layout's: facts, the answer, the report, then the
          contact, the team and the notes (`max-lg:order-*`; the column
          wrappers dissolve with `contents`). */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 max-lg:contents lg:space-y-4">
          {isCancelled && (
            <section className="rounded-xl border border-[var(--danger-foreground)]/25 bg-[var(--danger)] p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--danger-foreground)]">
                <Ban className="h-4 w-4" /> Aktivitas dibatalkan
              </h2>
              {cancellation && (
                <p className="mt-1 text-sm text-[var(--danger-foreground)]">
                  {cancellation.byName}, {formatMissionSchedule(cancellation.at, new Date())}
                  {cancellation.reason ? `: “${cancellation.reason}”` : "."}
                </p>
              )}
              {/* Postponed rather than off: the promise, then the replacement once it exists. */}
              {mission.rescheduledToId ? (
                <p className="mt-2 text-sm text-[var(--danger-foreground)]">
                  Sudah dijadwalkan ulang.{" "}
                  <Link href={paths.activity(mission.rescheduledToId)} className="font-semibold underline underline-offset-2">
                    Buka aktivitas barunya
                  </Link>
                </p>
              ) : mission.rescheduleDue ? (
                <p className="mt-2 text-sm font-medium text-[var(--danger-foreground)]">
                  Ditunda, jadwal menyusul: hubungi klien lagi {describeDueDate(mission.rescheduleDue, missionDayKey(new Date())).text}.
                </p>
              ) : null}
              {canCreateMission && !mission.rescheduledToId && (
                <div className="mt-4 flex sm:justify-end">
                  <Button asChild className="h-11">
                    <Link href={paths.newActivity({ from: missionId })}>
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

          <article className="overflow-hidden rounded-xl border bg-card max-lg:order-1">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <StatusBadge status={mission.status} />
              {/* For support tickets, read at a desk; on a phone it is two lines nobody reads. */}
              <span className="font-mono text-[11px] text-muted-foreground max-lg:hidden">ID {mission.id}</span>
              <span className="ml-auto flex items-center gap-2">
                {calendarItems.length > 0 && (
                  <ResponsiveMenu
                    title="Tambah ke kalender"
                    items={calendarItems}
                    trigger={
                      <Button variant="outline" size="sm" className="max-lg:hidden">
                        <CalendarDays className="h-4 w-4" /> Tambah ke kalender
                      </Button>
                    }
                  />
                )}
                {/* On a phone the bottom bar and the overflow menu carry Ubah. */}
                {canEdit && (
                  <Button asChild variant="outline" size="sm" className="max-lg:hidden">
                    <Link href={paths.activityEdit(missionId)}>
                      <Pencil className="h-4 w-4" /> Ubah
                    </Link>
                  </Button>
                )}
              </span>
            </div>

            <dl className="divide-y py-1">
              <Fact icon={CalendarDays} label="Jadwal" value={formatMissionSchedule(mission.scheduledStart, new Date())} />
              <Fact icon={MapPin} label="Lokasi" value={[mission.address, mission.appointment.building, mission.location].filter(Boolean).join(", ") || "Belum diisi"} />
              <Fact icon={UsersRound} label="Sales utama" value={mission.primarySalesName ?? "Belum ditugaskan"} />
              {mission.industry && <Fact icon={Building2} label="Industri" value={mission.industry} />}
              <Fact icon={ClipboardList} label="Tujuan" value={mission.objective ?? "Objective belum diisi."} />
            </dl>

            {/* Provenance lives here, not in the list: who booked it is what
                you want once you are looking at the visit, not while scanning
                for one. The full history is in Riwayat perubahan. */}
            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground">
              <span>Dijadwalkan oleh <span className="font-medium text-foreground">{mission.createdByName ?? "Nama tidak diketahui"}</span> · {stamp(mission.createdAt)}</span>
              {lastEdit && (
                <span>Diubah terakhir oleh <span className="font-medium text-foreground">{lastEdit.byName}</span> · {stamp(lastEdit.at)}</span>
              )}
              {sourceProspect && (
                <span>Dari prospek <Link href={`/workspace/prospects/${sourceProspect.id}`} className="font-medium text-primary hover:underline">{sourceProspect.clientCompanyName}</Link></span>
              )}
            </p>

            {/* On a phone this is "Batalkan aktivitas" in the overflow menu. */}
            {canCancel && (
              <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 max-lg:hidden">
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
            <article className="overflow-hidden rounded-xl border bg-card max-lg:order-4">
              <div className="border-b px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground">Janji temu</p>
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
                  <p className="text-xs font-semibold text-muted-foreground">
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
            <article id="jawaban" className="scroll-mt-16 overflow-hidden rounded-xl border bg-card max-lg:order-2">
              <div className="border-b px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground">Penugasan</p>
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
                      : `${pendingReschedule.requestedByName} mengusulkan jadwal lain. Menunggu keputusan pemilik aktivitas atau atasannya.`}
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
                    Aktivitas ini sudah tidak menerima perubahan jawaban.
                  </p>
                )}
              </div>
            </article>
          )}

        </div>

        <div className="min-w-0 max-lg:contents lg:space-y-4">
          <aside className="rounded-xl border bg-card max-lg:order-5">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Tim aktivitas</p>
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
                <p className="text-sm text-muted-foreground">Aktivitas dibatalkan; tim tidak bisa diubah lagi.</p>
              ) : (
                <>
                  {role === "SUPPORTING" && <LeaveButton missionId={missionId} />}
                  {role === null && (
                    <JoinButton
                      missionId={missionId}
                      status={joinStatus}
                      maxSupporting={settings.maxSupporting}
                      clientName={mission.clientCompanyName}
                      emphasis="filled"
                      // One filled Join per screen: below lg the bottom bar has it.
                      className={compactAction === "join" ? "max-lg:hidden" : undefined}
                    />
                  )}
                  {canManageTeam && <AllowJoinToggle missionId={missionId} allowJoin={mission.allowJoin} />}
                </>
              )}
            </div>

            {role === null && blockedReason && (
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">{blockedReason}</p>
            )}
          </aside>

          <aside className="overflow-hidden rounded-xl border bg-card max-lg:order-6">
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold text-muted-foreground">Catatan pendukung</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Pengamatan tim</h2>
            </div>
            <SupportingNotes missionId={missionId} notes={notes} canAdd={isAssigned || access.isSuperAdmin} />
          </aside>
        </div>

      {/* The report is the widest thing on the page: a summary, needs, contacts,
          the CRM hand-off. It gets the full width below the two columns rather
          than the left one, where it trailed on alone under a short right column.
          On a phone it comes third, right after the answer. */}
      <article id="laporan" className="scroll-mt-16 overflow-hidden rounded-xl border bg-card max-lg:order-3 lg:col-span-2 lg:scroll-mt-24">
        {/* Title and status first, actions on their own row: on a desk they sit to the right, on a phone under the title, one line, the rest behind ⋮. */}
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Laporan kunjungan</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold text-foreground">
              {!canReadReport
                ? "Tidak termasuk akses Anda"
                : report
                  ? reportSubmitted
                    ? "Sudah diisi"
                    : report.status === "NEEDS_CLARIFICATION"
                      ? "Dikembalikan untuk klarifikasi"
                      : "Draft tersimpan"
                  : "Belum diisi"}
              {report && <StatusBadge status={report.status} />}
            </h2>
          </div>
          {report && (
            <ReportActions
              missionId={missionId}
              authorName={primaryName}
              leadPushed={Boolean(leadPush)}
              share={share ? { text: share.text, photo: firstPhoto && sharePhotoUrl && sharePhotoName ? { url: sharePhotoUrl, name: sharePhotoName } : null } : null}
              editHref={reportSubmitted && editVerdict?.allowed && !isCancelled ? paths.activityReport(missionId, { edit: true }) : null}
              canClarify={reportSubmitted && supervisesReport && !isAuthor && !isCancelled}
              canWithdraw={reportSubmitted && Boolean(editVerdict?.allowed) && !isCancelled}
            />
          )}
        </div>

        {!canReadReport ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Peran Anda tidak mencakup laporan kunjungan. Detail aktivitas dan tim tetap terlihat.
          </p>
        ) : report ? (
          <div className="space-y-5 px-5 py-5">
            {share && <DeskShareNotice />}
            {shareOffer && <ShareOfferCard offer={shareOffer} />}
            {report.whatsappSharedAt && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Share className="h-3.5 w-3.5" /> Dibagikan ke WhatsApp{report.whatsappSharedByName ? ` oleh ${report.whatsappSharedByName}` : ""} · {stamp(report.whatsappSharedAt)}
              </p>
            )}
            {report.status === "NEEDS_CLARIFICATION" && report.clarificationNote && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warning-foreground)]/20 bg-[var(--warning)] px-4 py-3 text-sm text-[var(--warning-foreground)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Admin meminta klarifikasi</p>
                  <p className="mt-1 whitespace-pre-wrap">{report.clarificationNote}</p>
                </div>
              </div>
            )}
            {(editHint || versions.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {versions.length > 0 && (
                  <details className="min-w-0">
                    <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-foreground">
                      <History className="h-3.5 w-3.5" /> Diubah {versions.length}×
                      {versions[0].changedByName ? ` · terakhir oleh ${versions[0].changedByName}` : ""} · {stamp(versions[0].createdAt)}
                    </summary>
                    <ol className="mt-2 space-y-1.5 border-l-2 pl-3">
                      {versions.map((item) => (
                        <li key={item.version}>
                          <span className="text-foreground">{item.reason || "Tanpa alasan"}</span>
                          <span className="block">{item.changedByName ?? "Seseorang"} · {stamp(item.createdAt)} · versi {item.version} disimpan</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {editHint && <span>{editHint}</span>}
              </div>
            )}
            {/* Highlights first, as a CRM record page opens: the four facts a reader wants before the prose. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Highlight label="Hasil" value={report.visitOutcome ? labelOf(choices, "visit_outcome", report.visitOutcome) : "—"} />
              <Highlight label="Tingkat minat" value={report.interestLevel ? labelOf(choices, "interest_level", report.interestLevel) : "—"} />
              <Highlight
                label="Peluang"
                value={report.opportunityExists ? (report.estimatedValue ? `Rp ${formatNumber(report.estimatedValue)}` : "Ada") : "Tidak ada"}
                hint={report.opportunityExists && report.estimatedValue ? "estimasi nilai" : null}
              />
              <Highlight
                label="Waktu kunjungan"
                value={report.actualStart ? formatVisitWindow(report.actualStart, report.actualEnd) : "—"}
                hint={report.actualStart ? describeTiming(report.actualStart, mission.scheduledStart)?.text.toLowerCase() ?? null : null}
              />
            </div>

            {/* The next action as a task that lives: the chain, the open one to log, the next step. */}
            {settings.followUpEnabled && reportSubmitted ? (
              <FollowUpPanel
                missionId={missionId}
                followUps={followUps}
                channels={choicesFor(choices, "follow_up_channel").map((choice) => ({ code: choice.code, label: choice.label, kind: choice.kind }))}
                outcomes={choicesFor(choices, "follow_up_outcome").map((choice) => ({ code: choice.code, label: choice.label, kind: choice.kind }))}
                actionTypes={choicesFor(choices, "next_action_type")
                  .filter((choice) => kindOf(choices, "next_action_type", choice.code) !== "none")
                  .map((choice) => ({ code: choice.code, label: choice.label, kind: choice.kind }))}
                people={salesOptions.map((person) => ({ id: person.id, name: person.name }))}
                viewerId={access.userId}
                canManage={isAuthor || supervisesReport}
                today={missionDayKey(new Date())}
                fromReport={
                  kindOf(choices, "next_action_type", report.nextActionType) !== "none"
                    ? {
                        actionLabel: labelOf(choices, "next_action_type", report.nextActionType),
                        ownerName: report.nextActionOwner ? (salesOptions.find((person) => person.id === report.nextActionOwner)?.name ?? null) : null,
                        dueDate: report.followUpDate,
                      }
                    : null
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ReportField label="Next action" value={labelOf(choices, "next_action_type", report.nextActionType)} />
                <ReportField label="Penanggung jawab" value={report.nextActionOwner ? (salesOptions.find((person) => person.id === report.nextActionOwner)?.name ?? "—") : "—"} />
                <ReportField label="Follow-up" value={report.followUpDate ?? "—"} />
              </div>
            )}

            {/* What was said: prose at a readable measure, then the lists. */}
            {(report.meetingSummary || report.clientNeeds.length > 0 || report.productInterest.length > 0 || report.competitorMentioned || customAnswers.some(({ field }) => !isAttachmentType(field.fieldType))) && (
              <div className="space-y-4 border-t pt-5">
                {report.meetingSummary && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Ringkasan</p>
                    <p className="mt-1 max-w-[72ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground">{report.meetingSummary}</p>
                  </div>
                )}
                {report.clientNeeds.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Kebutuhan klien</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {report.clientNeeds.map((need) => (
                        <span key={need} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{need}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.productInterest.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Produk yang diminati</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {report.productInterest.map((product) => (
                        <span key={product} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{product}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.competitorMentioned && <ReportField label="Kompetitor disebut" value={report.competitorMentioned} />}
                {customAnswers.some(({ field }) => !isAttachmentType(field.fieldType)) && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {customAnswers.filter(({ field }) => !isAttachmentType(field.fieldType)).map(({ field, value }) => (
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
              </div>
            )}

            {canReadContacts && report.contacts.length > 0 && (
              <div className="border-t pt-5">
                <p className="text-xs font-semibold text-muted-foreground">Ketemu siapa</p>
                <ul className="mt-2 space-y-1.5">
                  {report.contacts.map((contact, index) => (
                    <li key={index} className="text-sm text-foreground">
                      {contact.fullName}
                      {contact.jobTitle ? <span className="text-muted-foreground"> · {contact.jobTitle}</span> : null}
                      {contact.isDecisionMaker ? <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">Pengambil keputusan</span> : null}
                      {settings.contactDiscEnabled && contact.discPrimary ? (
                        <>
                          {/* The reading as a tonal badge beside the name, the way Crystal Knows sits beside a HubSpot contact; the approach line under it so the next rep can act on it without opening the report. */}
                          <span className="ml-2 rounded-md bg-[var(--tonal)] px-1.5 py-0.5 text-xs font-semibold text-[var(--tonal-foreground)]" title={describeDisc(contact.discPrimary, contact.discSecondary)}>
                            DISC {discCode(contact.discPrimary, contact.discSecondary)}
                          </span>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {contact.discNote?.trim() || describeDisc(contact.discPrimary, contact.discSecondary)}
                            {contact.discAssessedByName ? <span className="text-muted-foreground/80"> · {describeAssessment(contact.discAssessedByName, contact.discAssessedAt)}</span> : null}
                          </p>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {customAnswers.some(({ field }) => isAttachmentType(field.fieldType)) && (
              <div className="space-y-4 border-t pt-5">
                {customAnswers.filter(({ field }) => field.fieldType === "PHOTO").map(({ field, value }) => (
                  <PhotoGallery key={field.id} access={access} label={field.label} photos={parsePhotoAnswer(value)} />
                ))}
                {customAnswers.filter(({ field }) => field.fieldType === "AUDIO").map(({ field, value }) => (
                  <AudioList key={field.id} access={access} label={field.label} recordings={parseAudioAnswer(value)} />
                ))}
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
              ? reportLock
                ? `${describeReportOpens(reportLock.until)}, pada hari kunjungannya. Kunjungan dimajukan? Pindahkan jadwalnya dulu.`
                : "Isi laporan setelah kunjungan selesai."
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
              <p className="text-xs font-semibold text-muted-foreground">Integrasi</p>
              <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-foreground">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--success-foreground)]" aria-hidden />
                Terkirim ke LeadEngine
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                Lead <span className="font-mono text-foreground">#{leadPush.leadId}</span> dibuat {stamp(leadPush.pushedAt)} oleh {leadPush.pushedByName}. Pemilik lead: {leadPush.ownerName}.
                {leadPush.category && <> Kategori: <span className="font-medium text-foreground">{leadPush.category}</span>{leadPush.gradeLead ? <>, grade {leadPush.gradeLead}</> : null}.</>}
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
              <p className="text-xs font-semibold text-muted-foreground">Integrasi</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Kirim ke LeadEngine</h3>
            </div>
            <PushLeadPanel
              missionId={missionId}
              clientName={mission.clientCompanyName}
              industry={mission.industry ?? null}
              salesOptions={salesOptions}
              defaultProjectName={mission.objective?.slice(0, 120) || `${mission.missionType} — ${mission.clientCompanyName}`}
              leadEngineUrl={leadEngineUrl}
            />
          </div>
        ) : null}

        {/* Once submitted the report is shown in full above, so there is
            nothing left to open. */}
        {/* While the tenant's rule keeps the report closed, the body above
            says when it opens; a footer repeating it said it twice. */}
        {canReadReport && canWriteReport && !reportSubmitted && !isCancelled && !reportLock && (
          <div className="border-t bg-muted/30 px-5 py-4">
            {askedToConfirm ? (
              // A report on a visit the rep has not agreed to make yet is
              // a contradiction; the button waits for the answer above.
              <p className="text-sm text-muted-foreground">
                Terima penugasan di atas dulu, lalu laporan bisa diisi setelah kunjungan.
              </p>
            ) : (
              <Button asChild className="h-11 w-full sm:w-auto">
                <Link href={paths.activityReport(missionId)}>
                  <ClipboardList className="h-4 w-4" />
                  {report ? "Lanjutkan laporan" : "Isi laporan kunjungan"}
                </Link>
              </Button>
            )}
          </div>
        )}
      </article>
      </section>

      {compactAction === "share" && shareOffer ? (
        <ShareOfferBar offer={shareOffer} fallback={baseAction ? <FormActionBar until="lg">{bar(baseAction)}</FormActionBar> : null} />
      ) : compactAction && compactAction !== "share" ? (
        <FormActionBar until="lg">{bar(compactAction)}</FormActionBar>
      ) : null}
    </WorkspacePage>
  )
}
