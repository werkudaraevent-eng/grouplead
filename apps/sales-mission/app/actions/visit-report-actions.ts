"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, canPerformOn, getSalesMissionAccess, resolveScope, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { resolveMissionGates } from "@/lib/missions/mission-rights"
import { describeOutOfScope, reportOwners } from "@/lib/access/record-scope"
import { getMission, getMissionRole, getMissionSettings, getVisitReport, listMissionTeam } from "@/lib/missions/mission-queries"
import { canEditSubmittedReport } from "@/lib/missions/report-edit"
import { FUTURE_VISIT_MESSAGE, toVisitInstants, visitTimeInFuture } from "@/lib/missions/visit-time"
import { describeReportOpens, reportLocked } from "@/lib/missions/report-window"
import { statusBeforeCompletion } from "@/lib/missions/report-withdraw"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { reportChoiceViolation } from "@/lib/missions/report-choices"
import {
  LeadEngineError,
  createClientCompany,
  createContact,
  fetchCompanyContacts,
  recordCompanyVisit,
} from "@/lib/leadengine/client"
import { notify } from "@/lib/notifications/notification-queries"
import { contactsForCrm, describeOutcome, visitReachesCrm } from "@/lib/missions/crm-sync"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  missingConfiguredFields,
  visitReportDraftSchema,
  visitReportSubmitSchema,
  type VisitOutcome,
  type VisitReportDraft,
} from "@/lib/missions/visit-report-schema"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { getReportOptions } from "@/lib/missions/report-options"
import { isAllowedChoice, isAttachmentType, validateFieldAnswers, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"
import type { ActionResult } from "@/types/action-result"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * Write side of the visit report.
 *
 * Authorization is re-checked here, not inherited from the page: a Server
 * Action is a public endpoint reachable without ever rendering the UI that
 * calls it.
 *
 * Who may write what:
 *   - the report itself — the mission's PRIMARY, or a super admin
 *   - supporting notes — anyone assigned to the mission
 * The person who was accountable in the room is the one who records what
 * happened there. Anyone else adds a note alongside it.
 */

type ReportRow = Record<string, unknown>

function toRow(input: VisitReportDraft): ReportRow {
  return {
    visit_outcome: input.visitOutcome ?? null,
    meeting_summary: input.meetingSummary?.trim() || null,
    client_needs: input.clientNeeds,
    product_interest: input.productInterest,
    interest_level: input.interestLevel ?? null,
    opportunity_exists: input.opportunityExists,
    estimated_value: input.estimatedValue ?? null,
    competitor_mentioned: input.competitorMentioned?.trim() || null,
    next_action_type: input.nextActionType,
    next_action_owner: input.nextActionOwner ?? null,
    follow_up_date: input.followUpDate ?? null,
    actual_start: toVisitInstants(input).start,
    actual_end: toVisitInstants(input).end,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Confirms the caller may write the report, returning the tenant context and
 * the mission.
 *
 * One question with two parts, both from the matrix: does the role hold
 * `sales_mission_result` create, and does its Cakupan reach this report. The
 * report belongs to the mission's sales utama, who was in the room; a Cakupan
 * of Tim or Semua reaches past them, so a supervisor can write it up on their
 * behalf. Reading a report is checked on all three of its surfaces — the page,
 * the reporting screen, the CSV export — so writing one checking neither of
 * them was the wider hole.
 *
 * The action asked for is `create` in both the draft and the submit path.
 * `update` carries a different meaning: changing a report that was already
 * sent, which has its own rule below.
 */
async function authorizeReportWrite(missionId: string) {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }

  const mission = await getMission(access, missionId)
  if (!mission) return { error: "Aktivitas tidak ditemukan." }

  if (!(await canPerform(access, "sales_mission_result", "create"))) {
    return { error: "Anda tidak punya izin menulis laporan kunjungan." }
  }
  if (!(await canPerformOn(access, "sales_mission_result", "create", { ownerIds: reportOwners(mission) }))) {
    const [role, { scope }] = await Promise.all([getMissionRole(access, missionId), resolveScope(access, "sales_mission_result")])
    return {
      error:
        role === "SUPPORTING"
          ? "Hanya sales utama yang mengisi laporan kunjungan. Gunakan catatan pendukung."
          : describeOutOfScope(scope, "laporan"),
    }
  }

  return { access, mission }
}

/**
 * The tenant's "not before the visit" rule, for a report that does not
 * exist yet. A draft that already exists (the schedule moved after it was
 * started) may go on; what it says about the time is checked at send.
 */
async function reportNotYetOpen(access: SalesMissionAccess, mission: { scheduledStart: string | null }, hasReport: boolean): Promise<string | null> {
  if (hasReport) return null
  const settings = await getMissionSettings(access)
  if (!settings.reportAfterVisitOnly) return null
  const lock = reportLocked(mission.scheduledStart, new Date())
  return lock ? `${describeReportOpens(lock.until)}.` : null
}

/**
 * Replace the report's contacts with the submitted set.
 *
 * Delete-then-insert rather than diffing: the list is short, order is
 * meaningful, and a partial diff would leave contacts the rep had removed.
 */
async function replaceContacts(
  missions: ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>,
  reportId: string,
  companyId: string,
  contacts: VisitReportDraft["contacts"],
  /** The mission's CRM company, when it has one. Null skips the matching. */
  clientCompanyId: string | null
) {
  await missions.from("report_contacts").delete().eq("report_id", reportId)

  if (contacts.length === 0) return null

  /*
    Match what the rep wrote against the people the CRM already knows at this
    company, and record the link.

    `lead_engine_contact_id` and `link_status` have existed on this table since
    the visit-report migration and nothing has ever written to them: the columns
    were designed and the mechanism was never built, so every report contact was
    an island and no report could answer "how many decision makers have we met
    at PT X".

    Matching only, never creating. An exact name match within one company is
    safe; anything looser would attach a visit to the wrong person, and creating
    a contact from a typo is how a CRM fills with duplicates nobody cleans up.
    Registration is offered explicitly in the lead-push modal instead.
  */
  const known = new Map<string, string>()
  if (clientCompanyId) {
    try {
      for (const contact of await fetchCompanyContacts(clientCompanyId)) {
        known.set(contact.fullName.trim().toLowerCase(), contact.id)
      }
    } catch {
      // A CRM outage must not stop a report being saved. The contacts land as
      // snapshots and can be linked on the next submit.
    }
  }

  const { error } = await missions.from("report_contacts").insert(
    contacts.map((contact) => {
      const matched = known.get(contact.fullName.trim().toLowerCase()) ?? null
      return {
        report_id: reportId,
        company_id: companyId,
        full_name: contact.fullName,
        job_title: contact.jobTitle?.trim() || null,
        phone: contact.phone?.trim() || null,
        email: contact.email?.trim() || null,
        is_decision_maker: contact.isDecisionMaker,
        lead_engine_contact_id: matched,
        link_status: matched ? "LINKED" : "SNAPSHOT",
      }
    })
  )

  return error
}

/**
 * Replace the report's custom answers with the submitted set, keeping only
 * fields that exist on the form and answers that are not blank. Delete then
 * insert, as with contacts: a cleared answer must really clear.
 */
async function replaceCustomValues(
  missions: ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>,
  reportId: string,
  companyId: string,
  fields: FormField[],
  custom: Record<string, unknown>
) {
  await missions.from("report_field_values").delete().eq("report_id", reportId)
  const rows = fields
    .filter((field) => (!field.isCore || isAttachmentType(field.fieldType)) && field.isActive)
    .map((field) => ({ field, value: custom[field.reportingKey] }))
    .filter(({ value }) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0))
    .map(({ field, value }) => ({
      report_id: reportId,
      company_id: companyId,
      field_id: field.id,
      reporting_key: field.reportingKey,
      value,
    }))
  if (rows.length === 0) return null
  const { error } = await missions.from("report_field_values").insert(rows)
  return error
}

/** Autosave. Accepts an incomplete form so a draft is never lost to validation. */
export async function saveVisitReportDraft(
  missionId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await authorizeReportWrite(missionId)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const parsed = visitReportDraftSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data laporan tidak valid." }
  }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")

  // A submitted report is the record of what happened. Editing it must go
  // through resubmission so a version is kept.
  const { data: existing } = await missions
    .from("visit_reports")
    .select("id, status")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (existing?.status === "SUBMITTED") {
    return { success: false, error: "Laporan sudah dikirim. Gunakan kirim ulang untuk mengubahnya." }
  }
  const notYet = await reportNotYetOpen(access, guard.mission, Boolean(existing))
  if (notYet) return { success: false, error: notYet }

  let reportId = existing?.id as string | undefined

  if (reportId) {
    const { error } = await missions.from("visit_reports").update(toRow(parsed.data)).eq("id", reportId)
    if (error) return { success: false, error: "Draft gagal disimpan." }
  } else {
    const { data, error } = await missions
      .from("visit_reports")
      .insert({
        mission_id: missionId,
        company_id: access.companyId,
        status: "DRAFT",
        created_by: access.userId,
        ...toRow(parsed.data),
      })
      .select("id")
      .single()

    if (error || !data) return { success: false, error: "Draft gagal disimpan." }
    reportId = data.id as string
  }

  const [mission, fields] = await Promise.all([getMission(access, missionId), listFormFields(access, "visit_report")])
  const contactError = await replaceContacts(
    missions, reportId, access.companyId, parsed.data.contacts, mission?.clientCompanyId ?? null
  )
  if (contactError) return { success: false, error: "Kontak gagal disimpan." }
  await replaceCustomValues(missions, reportId, access.companyId, fields, parsed.data.custom)

  return { success: true, data: { id: reportId } }
}

/**
 * Throw a draft away. Opening the form and typing anything autosaves a
 * draft, which then shows up as "Laporan tertunda"; someone who only meant
 * to look, or filled the wrong mission, needs a way back to "belum diisi".
 * A submitted report is never discarded here: it is the record of a visit.
 */
export async function discardVisitReportDraft(missionId: string): Promise<ActionResult> {
  const guard = await authorizeReportWrite(missionId)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")
  const { data: existing } = await missions
    .from("visit_reports")
    .select("id, status")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (!existing) return { success: true }
  if (existing.status === "SUBMITTED") {
    return { success: false, error: "Laporan sudah dikirim dan tidak bisa dibuang." }
  }

  const reportId = existing.id as string
  await missions.from("report_contacts").delete().eq("report_id", reportId)
  await missions.from("report_field_values").delete().eq("report_id", reportId)
  const { error } = await missions.from("visit_reports").delete().eq("id", reportId).eq("company_id", access.companyId)
  if (error) return { success: false, error: "Draft gagal dibuang." }

  revalidatePath("/workspace")
  revalidatePath(paths.activities())
  revalidatePath(paths.activity(missionId))
  revalidatePath(paths.activityReport(missionId))
  return { success: true }
}

/** Final submission. Enforces the complete-report rules and stamps the author. */
/**
 * The report's two vocabularies against the admin's lists. Off-list answers
 * are fine where the admin allows them (the default for these two), and
 * refused where they switched that off.
 */
function vocabularyViolation(fields: FormField[], key: "client_needs" | "product_interest", values: string[], fallback: readonly string[]): string | null {
  const field = fields.find((item) => item.reportingKey === key)
  const bad = values.find((value) => !isAllowedChoice(fields, key, value, fallback))
  return bad ? `"${bad}" tidak ada dalam daftar ${field?.label ?? key}.` : null
}

export async function submitVisitReport(
  missionId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await authorizeReportWrite(missionId)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const parsed = visitReportSubmitSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Laporan belum lengkap." }
  }

  // A report on a visit that has not happened: refused whether the form
  // was reached early or the date was typed ahead.
  const rules = await getMissionSettings(access)
  if (rules.reportAfterVisitOnly) {
    const lock = reportLocked(guard.mission.scheduledStart, new Date())
    if (lock) return { success: false, error: `${describeReportOpens(lock.until)}.` }
    if (visitTimeInFuture(parsed.data, new Date())) return { success: false, error: FUTURE_VISIT_MESSAGE }
  }

  const vocabularyFields = await listFormFields(access, "visit_report")
  const options = await getReportOptions()
  const vocabularyError =
    vocabularyViolation(vocabularyFields, "client_needs", parsed.data.clientNeeds, options.clientNeeds) ??
    vocabularyViolation(vocabularyFields, "product_interest", parsed.data.productInterest, options.productInterest)
  if (vocabularyError) return { success: false, error: vocabularyError }

  // The three fixed choices, against the tenant's set: the codes must exist
  // and the rules their kinds impose must hold.
  const choiceError = reportChoiceViolation(await listReportChoices(access), {
    visitOutcome: parsed.data.visitOutcome,
    interestLevel: parsed.data.interestLevel,
    nextActionType: parsed.data.nextActionType,
    opportunityExists: parsed.data.opportunityExists,
    contactCount: parsed.data.contacts.length,
    nextActionOwner: parsed.data.nextActionOwner,
    followUpDate: parsed.data.followUpDate,
  })
  if (choiceError) return { success: false, error: choiceError }

  // The admin's form rules, on top of the code's. Checked here as well as in
  // the form, because a Server Action is a public endpoint.
  const fields = await listFormFields(access, "visit_report")
  const missing = missingConfiguredFields(parsed.data, fields)
  if (missing.length > 0) {
    const label = fields.find((field) => field.reportingKey === missing[0])?.label ?? missing[0]
    return { success: false, error: `${label} wajib diisi.` }
  }
  const customCheck = validateFieldAnswers(fields, parsed.data.custom as Record<string, FieldAnswer>)
  if (!customCheck.ok) {
    return { success: false, error: Object.values(customCheck.errors)[0] ?? "Isian tambahan belum lengkap." }
  }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")

  const { data: existing } = await missions
    .from("visit_reports")
    .select("id, status")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  const now = new Date().toISOString()
  const row = {
    ...toRow(parsed.data),
    status: "SUBMITTED",
    submitted_by: access.userId,
    submitted_at: now,
    // A resubmission answers the question that was asked, so the note is cleared.
    clarification_note: null,
  }

  let reportId = existing?.id as string | undefined

  // Changing a report that was already sent. Allowed for its author inside
  // the tenant's window and for a supervisor (result:update within Cakupan)
  // at any time, never without a reason, and the submission time stays the
  // original so the window does not restart with every edit.
  const isEdit = existing?.status === "SUBMITTED"
  let keepSubmittedAt: string | null = null
  if (isEdit && reportId) {
    const [{ data: sent }, settings, role] = await Promise.all([
      missions.from("visit_reports").select("submitted_at").eq("id", reportId).single(),
      getMissionSettings(access),
      getMissionRole(access, missionId),
    ])
    const gates = await resolveMissionGates(access, guard.mission, role, settings)
    keepSubmittedAt = (sent?.submitted_at as string | null) ?? null
    const verdict = canEditSubmittedReport({
      supervises: gates.supervisesReport,
      isAuthor: gates.isAuthor,
      submittedAt: keepSubmittedAt,
      now: new Date(),
      windowDays: settings.reportEditWindowDays,
    })
    if (!verdict.allowed) {
      return { success: false, error: "Laporan ini sudah tidak bisa diubah sendiri. Minta atasan yang berwenang membukanya." }
    }
    if (!parsed.data.changeReason?.trim()) {
      return { success: false, error: "Tulis alasan perubahan singkat." }
    }
  }

  if (reportId) {
    // Keep the outgoing state before overwriting. History is append-only, so a
    // correction never erases what was previously reported.
    const { data: previous } = await missions.from("visit_reports").select("*").eq("id", reportId).single()
    if (previous) {
      const { count } = await missions
        .from("visit_report_versions")
        .select("id", { count: "exact", head: true })
        .eq("report_id", reportId)

      await missions.from("visit_report_versions").insert({
        report_id: reportId,
        company_id: access.companyId,
        version: (count ?? 0) + 1,
        snapshot: previous,
        changed_by: access.userId,
        reason: isEdit
          ? parsed.data.changeReason!.trim()
          : existing?.status === "NEEDS_CLARIFICATION" ? "Kirim ulang setelah klarifikasi" : "Kirim ulang",
      })
    }

    const { error } = await missions
      .from("visit_reports")
      .update(isEdit && keepSubmittedAt ? { ...row, submitted_at: keepSubmittedAt } : row)
      .eq("id", reportId)
    if (error) return { success: false, error: "Laporan gagal dikirim." }
  } else {
    const { data, error } = await missions
      .from("visit_reports")
      .insert({ mission_id: missionId, company_id: access.companyId, created_by: access.userId, ...row })
      .select("id")
      .single()

    if (error || !data) return { success: false, error: "Laporan gagal dikirim." }
    reportId = data.id as string
  }

  const submitMission = await getMission(access, missionId)
  const contactError = await replaceContacts(
    missions, reportId, access.companyId, parsed.data.contacts, submitMission?.clientCompanyId ?? null
  )
  if (contactError) return { success: false, error: "Kontak gagal disimpan." }
  await replaceCustomValues(missions, reportId, access.companyId, fields, parsed.data.custom)

  // The visit is done and recorded; move the mission on. An edit changes
  // the record, not the fact that the visit happened, so it leaves the
  // mission, its history and the team's inbox alone.
  if (!isEdit) {
    await missions
      .from("missions")
      .update({ status: "COMPLETED", updated_at: now })
      .eq("id", missionId)
      .eq("company_id", access.companyId)
  }

  // The visit happened whether or not the CRM hears about it, so this runs
  // after the report is safely stored and never fails the submit. The outcome
  // is written on the report for the mission page to show, and to retry.
  await syncVisitToCrm(access, missionId, reportId)

  if (!isEdit) {
    await missions.from("status_history").insert({
      mission_id: missionId,
      company_id: access.companyId,
      to_status: "COMPLETED",
      changed_by: access.userId,
      reason: "Laporan kunjungan dikirim",
    })

    // The team hears that the visit is on record, so supporting sales know their
    // notes have been read and folded in.
    const [team, mission] = await Promise.all([
      listMissionTeam(access, missionId),
      getMission(access, missionId),
    ])
    await notify(
      access,
      "RESULT_SUBMITTED",
      team.map((member) => member.userId),
      { missionId, clientName: mission?.clientCompanyName ?? "Aktivitas" }
    )
  }

  revalidatePath("/workspace")
  revalidatePath(paths.activities())
  revalidatePath(paths.activity(missionId))

  return { success: true, data: { id: reportId } }
}

/**
 * Register the company and the people met in LeadEngine.
 *
 * This is what makes the CRM a database of everyone visited, not only of
 * everyone who produced a lead. Before this, a company visited three times
 * with no opportunity had no record in LeadEngine at all: the only path into
 * the CRM was the lead-push modal, and most visits never open it.
 *
 * Three writes, each safe to repeat:
 *   - the company, find-or-create on its normalised name. Owner is the primary
 *     sales only when the company is new; an existing owner is never changed
 *     from here. Changing an owner is the push modal's job, with its warning.
 *   - each contact met, find-or-create within that company, filling blanks.
 *   - one "meeting" entry on the company timeline, one per mission.
 *
 * A visit where nobody was met does none of this; see visitReachesCrm.
 */
async function syncVisitToCrm(
  access: SalesMissionAccess,
  missionId: string,
  reportId: string
): Promise<void> {
  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")

  const record = async (patch: { crm_synced_at: string | null; crm_sync_error: string | null }) => {
    await missions.from("visit_reports").update(patch).eq("id", reportId)
  }

  try {
    const [mission, report] = await Promise.all([
      getMission(access, missionId),
      getVisitReport(access, missionId),
    ])
    if (!mission || !report?.visitOutcome) return
    const choices = await listReportChoices(access)
    if (!visitReachesCrm(report.visitOutcome as VisitOutcome, choices)) {
      // Not a failure. Left null so the page can say "tidak dikirim" without
      // offering a retry that would do the same nothing.
      return
    }

    const primary = (await listMissionTeam(access, missionId)).find((member) => member.role === "PRIMARY")

    let clientCompanyId = mission.clientCompanyId
    if (!clientCompanyId) {
      const { company } = await createClientCompany({
        name: mission.clientCompanyName,
        ownerId: primary?.userId ?? access.userId,
        city: mission.location,
        industry: mission.industry ?? null,
      })
      clientCompanyId = company.id
      // Link the mission so the next screen (and the push modal) finds it.
      await missions
        .from("missions")
        .update({ client_company_id: clientCompanyId })
        .eq("id", missionId)
        .eq("company_id", access.companyId)
      // And the prospect this visit came from, if it was still unlinked, so
      // the next visit to the same company starts from a known CRM record.
      await missions
        .from("prospects")
        .update({ client_company_id: clientCompanyId })
        .eq("mission_id", missionId)
        .eq("company_id", access.companyId)
        .is("client_company_id", null)
    }

    for (const contact of contactsForCrm(report.contacts)) {
      const { contact: crm } = await createContact({
        clientCompanyId,
        fullName: contact.fullName,
        jobTitle: contact.jobTitle || null,
        phone: contact.phone || null,
        email: contact.email || null,
        ownerId: primary?.userId ?? access.userId,
      })
      await missions
        .from("report_contacts")
        .update({ lead_engine_contact_id: crm.id, link_status: "LINKED" })
        .eq("company_id", access.companyId)
        .eq("report_id", reportId)
        .eq("full_name", contact.fullName)
    }

    await recordCompanyVisit({
      clientCompanyId,
      missionId,
      visitedOn: mission.scheduledStart
        ? new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(mission.scheduledStart))
        : new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date()),
      salesName: primary?.name ?? access.displayName,
      outcome: describeOutcome(report.visitOutcome as VisitOutcome, choices),
      contactNames: contactsForCrm(report.contacts).map((contact) => contact.fullName),
      city: mission.location,
    })

    await record({ crm_synced_at: new Date().toISOString(), crm_sync_error: null })
  } catch (error) {
    await record({
      crm_synced_at: null,
      crm_sync_error:
        error instanceof LeadEngineError ? error.message : "LeadEngine tidak dapat dihubungi.",
    })
  }
}

/**
 * Try the CRM registration again after it failed on submit.
 *
 * Same guard as submitting: the person who wrote the report is the one who
 * can push its facts onward. Nothing about the report changes.
 */
export async function retryCrmSync(missionId: string): Promise<ActionResult> {
  const guard = await authorizeReportWrite(missionId)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const report = await getVisitReport(access, missionId)
  if (!report || report.status !== "SUBMITTED") {
    return { success: false, error: "Laporan belum dikirim." }
  }

  await syncVisitToCrm(access, missionId, report.id)

  const after = await getVisitReport(access, missionId)
  revalidatePath(paths.activity(missionId))
  return after?.crmSyncError
    ? { success: false, error: after.crmSyncError }
    : { success: true }
}

/**
 * Anyone assigned to the mission may add their own note.
 *
 * Gated on the mission module rather than the report module: a note is the
 * mission's own thread, written by the supporting sales who by design cannot
 * write the report at all.
 */
export async function addSupportingNote(missionId: string, note: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) {
    return { success: false, error: "Anda tidak punya izin menulis catatan pada aktivitas." }
  }

  const trimmed = note.trim()
  if (!trimmed) return { success: false, error: "Catatan tidak boleh kosong." }
  if (trimmed.length > 5000) return { success: false, error: "Catatan terlalu panjang." }

  const role = await getMissionRole(access, missionId)
  if (!role && !access.isSuperAdmin) {
    return { success: false, error: "Anda tidak ditugaskan pada aktivitas ini." }
  }

  const supabase = await createClient()
  const { error } = await supabase.schema("sales_mission").from("supporting_notes").insert({
    mission_id: missionId,
    company_id: access.companyId,
    author_id: access.userId,
    note: trimmed,
  })

  if (error) return { success: false, error: "Catatan gagal disimpan." }

  revalidatePath(paths.activity(missionId))
  return { success: true }
}

/**
 * A supervisor sends a sent report back to its author with a note. The
 * report keeps its content and moves to NEEDS_CLARIFICATION: the author sees
 * the note on the form, fixes it, and sends again, which files the current
 * version in the history. Never for a draft; there is nothing to return.
 *
 * Supervisor means Laporan kunjungan → Ubah with a Cakupan that reaches the
 * author. The author does not send a report back to themself.
 */
/**
 * "Tarik kembali laporan": a sent report goes back to draft, with its
 * content, and the mission back to the status it had before Selesai.
 *
 * For a report sent by mistake (a test, the wrong visit) or one that
 * needs more than an edit. The right to do it is the right to edit a sent
 * report: the author inside the tenant's window, a supervisor at any
 * time. Never silent: the sent version is archived with the reason, the
 * status history records the move back, and the team is told. A lead
 * already pushed to the CRM stays there; the CRM has its own owner.
 */
export async function withdrawVisitReport(missionId: string, reason: string): Promise<ActionResult> {
  const guard = await authorizeReportWrite(missionId)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, mission } = guard

  const trimmed = reason.trim()
  if (trimmed.length < 5) return { success: false, error: "Tulis alasan penarikan singkat." }
  if (trimmed.length > 500) return { success: false, error: "Alasan maksimal 500 karakter." }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")
  const { data: existing } = await missions
    .from("visit_reports")
    .select("*")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()
  if (!existing) return { success: false, error: "Laporan belum ada." }
  if (existing.status !== "SUBMITTED") return { success: false, error: "Hanya laporan yang sudah dikirim yang bisa ditarik kembali." }

  const [settings, role] = await Promise.all([getMissionSettings(access), getMissionRole(access, missionId)])
  const gates = await resolveMissionGates(access, mission, role, settings)
  const verdict = canEditSubmittedReport({
    supervises: gates.supervisesReport,
    isAuthor: gates.isAuthor,
    submittedAt: (existing.submitted_at as string | null) ?? null,
    now: new Date(),
    windowDays: settings.reportEditWindowDays,
  })
  if (!verdict.allowed) {
    return { success: false, error: "Laporan ini sudah tidak bisa ditarik sendiri. Minta atasan yang berwenang." }
  }

  const reportId = existing.id as string
  const now = new Date().toISOString()

  // The sent version is kept before anything moves, as every edit keeps it.
  const { count } = await missions.from("visit_report_versions").select("id", { count: "exact", head: true }).eq("report_id", reportId)
  await missions.from("visit_report_versions").insert({
    report_id: reportId,
    company_id: access.companyId,
    version: (count ?? 0) + 1,
    snapshot: existing,
    changed_by: access.userId,
    reason: `Ditarik kembali: ${trimmed}`,
  })

  const { error } = await missions
    .from("visit_reports")
    .update({ status: "DRAFT", submitted_at: null, submitted_by: null, clarification_note: null, updated_at: now })
    .eq("id", reportId)
    .eq("company_id", access.companyId)
  if (error) return { success: false, error: "Laporan gagal ditarik kembali." }

  // The mission goes back to where the send took it from.
  const { data: history } = await missions
    .from("status_history")
    .select("from_status, to_status, created_at")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
  const previous = statusBeforeCompletion(
    (history ?? []).map((row) => ({ fromStatus: (row.from_status as string | null) ?? null, toStatus: row.to_status as string, createdAt: row.created_at as string }))
  )
  if (mission.status === "COMPLETED") {
    await missions.from("missions").update({ status: previous, updated_at: now }).eq("id", missionId).eq("company_id", access.companyId)
    await missions.from("status_history").insert({
      mission_id: missionId,
      company_id: access.companyId,
      from_status: "COMPLETED",
      to_status: previous,
      changed_by: access.userId,
      reason: `Laporan ditarik kembali: ${trimmed}`,
    })
  }

  const team = await listMissionTeam(access, missionId)
  await notify(
    access,
    "RESULT_WITHDRAWN",
    [...team.map((member) => member.userId), mission.createdBy],
    { missionId, clientName: mission.clientCompanyName }
  )

  revalidatePath("/workspace")
  revalidatePath(paths.activities())
  revalidatePath(paths.activity(missionId))
  revalidatePath(paths.reports)
  return { success: true }
}

export async function requestReportClarification(missionId: string, note: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_result", "read"))) {
    return { success: false, error: "Anda tidak punya akses ke laporan kunjungan." }
  }
  const [mission, role, settings] = await Promise.all([getMission(access, missionId), getMissionRole(access, missionId), getMissionSettings(access)])
  if (!mission) return { success: false, error: "Aktivitas tidak ditemukan." }
  const gates = await resolveMissionGates(access, mission, role, settings)
  if (!gates.supervisesReport || gates.isAuthor) {
    return { success: false, error: "Hanya atasan yang berwenang atas laporan ini yang bisa meminta klarifikasi." }
  }

  const trimmed = note.trim()
  if (trimmed.length < 5) return { success: false, error: "Tulis apa yang perlu diperbaiki." }
  if (trimmed.length > 500) return { success: false, error: "Catatan maksimal 500 karakter." }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")
  const { data: existing } = await missions
    .from("visit_reports")
    .select("id, status")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()
  if (!existing) return { success: false, error: "Laporan belum ada." }
  if (existing.status !== "SUBMITTED") return { success: false, error: "Hanya laporan yang sudah dikirim yang bisa dikembalikan." }

  const { error } = await missions
    .from("visit_reports")
    .update({ status: "NEEDS_CLARIFICATION", clarification_note: trimmed, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("company_id", access.companyId)
  if (error) return { success: false, error: "Permintaan gagal disimpan." }

  const team = await listMissionTeam(access, missionId)
  await notify(
    access,
    "NEEDS_CLARIFICATION",
    team.filter((member) => member.role === "PRIMARY").map((member) => member.userId),
    { missionId, clientName: mission?.clientCompanyName ?? "Aktivitas" }
  )

  revalidatePath("/workspace")
  revalidatePath(paths.activities())
  revalidatePath(paths.activity(missionId))
  return { success: true }
}
