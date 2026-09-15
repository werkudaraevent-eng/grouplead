"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission, getMissionRole, getVisitReport, listMissionTeam } from "@/lib/missions/mission-queries"
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
import { validateFieldAnswers, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"
import type { ActionResult } from "@/types/action-result"

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
    updated_at: new Date().toISOString(),
  }
}

/**
 * Confirms the caller may write the report, returning the tenant context.
 *
 * Two independent questions, both required. The mission role answers "were you
 * the one in the room"; the `sales_mission_result` module answers "does your
 * role author reports at all". Reading a report is checked on all three of its
 * surfaces — the page, the reporting screen, the CSV export — so writing one
 * checking neither of them was the wider hole.
 *
 * The action asked for is `create` in both the draft and the submit path: this
 * app has no surface for editing somebody else's report, so there is no second
 * meaning for `update` to carry, and splitting them would only invent a config
 * ("create but not update") that silently breaks autosave.
 */
async function authorizeReportWrite(missionId: string) {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return {
      error:
        role === "SUPPORTING"
          ? "Hanya sales utama yang mengisi laporan kunjungan. Gunakan catatan pendukung."
          : ("Anda tidak ditugaskan pada mission ini." as const),
    }
  }

  if (!(await canPerform(access, "sales_mission_result", "create"))) {
    return { error: "Anda tidak punya izin menulis laporan kunjungan." as const }
  }

  return { access }
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
    .filter((field) => !field.isCore && field.isActive)
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
  revalidatePath("/workspace/missions")
  revalidatePath(`/workspace/missions/${missionId}`)
  revalidatePath(`/workspace/missions/${missionId}/report`)
  return { success: true }
}

/** Final submission. Enforces the complete-report rules and stamps the author. */
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
        reason: existing?.status === "NEEDS_CLARIFICATION" ? "Kirim ulang setelah klarifikasi" : "Kirim ulang",
      })
    }

    const { error } = await missions.from("visit_reports").update(row).eq("id", reportId)
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

  // The visit is done and recorded; move the mission on.
  await missions
    .from("missions")
    .update({ status: "COMPLETED", updated_at: now })
    .eq("id", missionId)
    .eq("company_id", access.companyId)

  // The visit happened whether or not the CRM hears about it, so this runs
  // after the report is safely stored and never fails the submit. The outcome
  // is written on the report for the mission page to show, and to retry.
  await syncVisitToCrm(access, missionId, reportId)

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
    { missionId, clientName: mission?.clientCompanyName ?? "Mission" }
  )

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath(`/workspace/missions/${missionId}`)

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
    if (!visitReachesCrm(report.visitOutcome as VisitOutcome)) {
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
      outcome: describeOutcome(report.visitOutcome as VisitOutcome),
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
  revalidatePath(`/workspace/missions/${missionId}`)
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
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) {
    return { success: false, error: "Anda tidak punya izin menulis catatan pada mission." }
  }

  const trimmed = note.trim()
  if (!trimmed) return { success: false, error: "Catatan tidak boleh kosong." }
  if (trimmed.length > 5000) return { success: false, error: "Catatan terlalu panjang." }

  const role = await getMissionRole(access, missionId)
  if (!role && !access.isSuperAdmin) {
    return { success: false, error: "Anda tidak ditugaskan pada mission ini." }
  }

  const supabase = await createClient()
  const { error } = await supabase.schema("sales_mission").from("supporting_notes").insert({
    mission_id: missionId,
    company_id: access.companyId,
    author_id: access.userId,
    note: trimmed,
  })

  if (error) return { success: false, error: "Catatan gagal disimpan." }

  revalidatePath(`/workspace/missions/${missionId}`)
  return { success: true }
}
