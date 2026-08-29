"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionRole } from "@/lib/missions/mission-queries"
import {
  visitReportDraftSchema,
  visitReportSubmitSchema,
  type VisitReportDraft,
} from "@/lib/missions/visit-report-schema"
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

/** Confirms the caller may write the report, returning the tenant context. */
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
  contacts: VisitReportDraft["contacts"]
) {
  await missions.from("report_contacts").delete().eq("report_id", reportId)

  if (contacts.length === 0) return null

  const { error } = await missions.from("report_contacts").insert(
    contacts.map((contact) => ({
      report_id: reportId,
      company_id: companyId,
      full_name: contact.fullName,
      job_title: contact.jobTitle?.trim() || null,
      phone: contact.phone?.trim() || null,
      email: contact.email?.trim() || null,
      is_decision_maker: contact.isDecisionMaker,
    }))
  )

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

  const contactError = await replaceContacts(missions, reportId, access.companyId, parsed.data.contacts)
  if (contactError) return { success: false, error: "Kontak gagal disimpan." }

  return { success: true, data: { id: reportId } }
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

  const contactError = await replaceContacts(missions, reportId, access.companyId, parsed.data.contacts)
  if (contactError) return { success: false, error: "Kontak gagal disimpan." }

  // The visit is done and recorded; move the mission on.
  await missions
    .from("missions")
    .update({ status: "COMPLETED", updated_at: now })
    .eq("id", missionId)
    .eq("company_id", access.companyId)

  await missions.from("status_history").insert({
    mission_id: missionId,
    company_id: access.companyId,
    to_status: "COMPLETED",
    changed_by: access.userId,
    reason: "Laporan kunjungan dikirim",
  })

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true, data: { id: reportId } }
}

/** Anyone assigned to the mission may add their own note. */
export async function addSupportingNote(missionId: string, note: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

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
