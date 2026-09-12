"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission, getMissionRole, getVisitReport } from "@/lib/missions/mission-queries"
import { canPushLead } from "@/lib/missions/visit-report-schema"
import {
  LeadEngineError,
  createClientCompany,
  createContact,
  createLead,
  enrichContact,
  fetchCompanyContacts,
  fetchCompanyContext,
  fetchPipelines,
  searchClientCompanies,
  type ClientCompanyContext,
  type LeadEngineCompany,
  type LeadEnginePipeline,
} from "@/lib/leadengine/client"
import type { ActionResult } from "@/types/action-result"

/**
 * Sending a mission's opportunity to LeadEngine as a lead.
 *
 * The gate is deliberately narrow. A pipeline filled with every conversation
 * that happened is worse than one that misses a few: conversion rates collapse
 * artificially and the forecast stops being usable. So a push requires a
 * submitted report that explicitly claims an opportunity, plus a project name
 * and a next action typed by a human.
 */

const pushLeadSchema = z.object({
  /** Names the rep ticked for registration. Anything else is left alone. */
  registerContactNames: z.array(z.string().trim().min(1)).default([]),
  /** CRM contact ids the rep ticked for gap-filling. */
  enrichContactIds: z.array(z.string().uuid()).default([]),
  projectName: z.string().trim().min(1, "Nama proyek wajib diisi").max(300),
  pipelineId: z.string().uuid("Pilih pipeline tujuan"),
  pipelineStageId: z.string().uuid().nullish(),
  ownerUserId: z.string().uuid("Pilih pemilik lead"),
  estimatedValue: z.number().nonnegative().nullish(),
  remark: z.string().trim().max(4000).optional().or(z.literal("")),
  clientCompanyId: z.string().uuid().nullish(),
})

export interface PushPrecheck {
  eligible: boolean
  reason?: string
  alreadyPushed: { leadId: string } | null
  pipelines: LeadEnginePipeline[]
  companyContext: ClientCompanyContext | null
  /** Owner the modal preselects — the CRM's current holder when there is one. */
  suggestedOwnerId: string | null
  suggestedOwnerName: string | null
  integrationError: string | null
  /** The typed name, when this mission was never linked to a CRM company. */
  unlinkedCompanyName: string | null
  /**
   * Possible CRM matches for that name. Offered before anything is created so a
   * rep who typed "Suconfindo" can link to an existing "PT Sucofindo" instead of
   * adding a near-duplicate nobody reconciles later.
   */
  companySuggestions: LeadEngineCompany[]
  /**
   * People named in the visit report that the CRM has no record of.
   *
   * Offered here and nowhere else. Registering a contact the moment a report is
   * submitted would turn every typo into a permanent record, and a contact list
   * nobody trusts is worse than a short one. This modal already asks a human to
   * confirm before anything is written to the CRM, so it is the one gate the
   * decision belongs behind.
   */
  unlinkedContacts: Array<{ fullName: string; jobTitle: string | null; phone: string | null; email: string | null }>
  /**
   * Contacts the CRM already has, where this visit knows something it does not.
   *
   * Roughly four in ten contacts in this CRM have no job title and no phone, so
   * a visit is often the first time anyone finds out. Only gaps are offered:
   * a field the CRM already has a value for never appears here, and the endpoint
   * refuses to overwrite one even if asked.
   */
  contactEnrichments: Array<{ contactId: string; fullName: string; fills: string[] }>
}

/**
 * Everything the modal needs before it opens.
 *
 * Loaded server-side in one call so a rep on a weak connection sees a complete
 * form or a clear reason, never a form that fills in halfway.
 *
 * Carries the same two guards as the push it precedes, not a looser pair. What
 * it returns — the report's eligibility, whether the mission was already sent,
 * the CRM's current account manager and that client's open leads — is exactly
 * the pipeline intelligence the push is guarded for. A precheck anyone could
 * call would answer those questions for every mission in the tenant, one id at
 * a time, without writing anything. The modal only ever opens for someone who
 * has both grants, so matching them costs nothing.
 */
export async function getPushPrecheck(missionId: string): Promise<PushPrecheck> {
  const empty: PushPrecheck = {
    eligible: false,
    alreadyPushed: null,
    pipelines: [],
    companyContext: null,
    suggestedOwnerId: null,
    suggestedOwnerName: null,
    integrationError: null,
    unlinkedCompanyName: null,
    companySuggestions: [],
    unlinkedContacts: [],
    contactEnrichments: [],
  }

  const access = await getSalesMissionAccess()
  if (!access) return { ...empty, reason: "Anda tidak punya akses Sales Mission." }

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { ...empty, reason: "Hanya sales utama yang bisa mengirim lead dari mission ini." }
  }

  if (!(await canPerform(access, "sales_mission_result", "create"))) {
    return { ...empty, reason: "Anda tidak punya izin mengirim lead." }
  }

  const [mission, report] = await Promise.all([
    getMission(access, missionId),
    getVisitReport(access, missionId),
  ])

  if (!mission) return { ...empty, reason: "Mission tidak ditemukan." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .schema("sales_mission")
    .from("lead_pushes")
    .select("lead_engine_lead_id")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (existing) {
    return { ...empty, alreadyPushed: { leadId: existing.lead_engine_lead_id as string } }
  }

  if (!report || !canPushLead(report)) {
    return {
      ...empty,
      reason: report
        ? "Laporan harus dikirim dan menandai adanya peluang sebelum bisa dikirim ke LeadEngine."
        : "Isi dan kirim laporan kunjungan lebih dulu.",
    }
  }

  // A network failure here must not look like ineligibility — the rep would
  // think the mission is the problem.
  try {
    const pipelines = await fetchPipelines()
    const companyContext = mission.clientCompanyId
      ? await fetchCompanyContext(mission.clientCompanyId)
      : null

    let companySuggestions: LeadEngineCompany[] = []
    if (!mission.clientCompanyId) {
      // A failed lookup here must not block the push — the rep can still send
      // the lead, and the company gets registered from the typed name.
      try {
        companySuggestions = await searchClientCompanies(mission.clientCompanyName)
      } catch {
        companySuggestions = []
      }
    }

    return {
      eligible: true,
      alreadyPushed: null,
      pipelines,
      companyContext,
      suggestedOwnerId: companyContext?.currentOwner?.userId ?? access.userId,
      suggestedOwnerName: companyContext?.currentOwner?.name ?? access.displayName,
      integrationError: null,
      unlinkedCompanyName: mission.clientCompanyId ? null : mission.clientCompanyName,
      companySuggestions,
      // Only meaningful once the mission has a CRM company to attach them to.
      // replaceContacts already linked whoever matched, so anything still
      // unlinked is genuinely new.
      unlinkedContacts: mission.clientCompanyId
        ? report.contacts
            .filter((contact) => !contact.leadEngineContactId)
            .map((contact) => ({
              fullName: contact.fullName,
              jobTitle: contact.jobTitle ?? null,
              phone: contact.phone ?? null,
              email: contact.email ?? null,
            }))
        : [],
      contactEnrichments: await buildEnrichments(mission, report),
    }
  } catch (error) {
    const message = error instanceof LeadEngineError ? error.message : "LeadEngine tidak dapat dihubungi."
    return { ...empty, eligible: false, integrationError: message }
  }
}


const FIELD_LABELS: Record<string, string> = { jobTitle: "jabatan", phone: "telepon", email: "email" }

/**
 * What this visit knows that the CRM does not, per linked contact.
 *
 * Sources are the mission's appointment contact and the report's contacts, both
 * of which carry a CRM id once they were picked or matched. Everything is
 * compared against the CRM's current values, so a gap that somebody else filled
 * in the meantime stops being offered.
 */
async function buildEnrichments(
  mission: { clientCompanyId: string | null; appointment: { contactId: string | null; jobTitle: string | null; phone: string | null; email: string | null } },
  report: { contacts: Array<{ fullName: string; jobTitle?: string; phone?: string; email?: string; leadEngineContactId: string | null }> }
): Promise<Array<{ contactId: string; fullName: string; fills: string[] }>> {
  if (!mission.clientCompanyId) return []

  let known: Awaited<ReturnType<typeof fetchCompanyContacts>>
  try {
    known = await fetchCompanyContacts(mission.clientCompanyId)
  } catch {
    // Offering nothing is the safe failure: the push still goes through.
    return []
  }

  const byId = new Map(known.map((contact) => [contact.id, contact]))
  const candidates = new Map<string, { jobTitle: string; phone: string; email: string }>()

  if (mission.appointment.contactId) {
    candidates.set(mission.appointment.contactId, {
      jobTitle: mission.appointment.jobTitle ?? "",
      phone: mission.appointment.phone ?? "",
      email: mission.appointment.email ?? "",
    })
  }

  for (const contact of report.contacts) {
    if (!contact.leadEngineContactId) continue
    const existing = candidates.get(contact.leadEngineContactId)
    // The report was written after the visit, so it wins where both have a value.
    candidates.set(contact.leadEngineContactId, {
      jobTitle: contact.jobTitle || existing?.jobTitle || "",
      phone: contact.phone || existing?.phone || "",
      email: contact.email || existing?.email || "",
    })
  }

  const result: Array<{ contactId: string; fullName: string; fills: string[] }> = []
  for (const [contactId, ours] of candidates) {
    const crm = byId.get(contactId)
    if (!crm) continue

    const fills = (["jobTitle", "phone", "email"] as const)
      .filter((key) => !crm[key] && ours[key].trim())
      .map((key) => FIELD_LABELS[key])

    if (fills.length > 0) result.push({ contactId, fullName: crm.fullName, fills })
  }

  return result
}

/** Create the lead and record that this mission has been pushed. */
export async function pushMissionToLeadEngine(
  missionId: string,
  input: unknown
): Promise<ActionResult<{ leadId: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { success: false, error: "Hanya sales utama yang bisa mengirim lead dari mission ini." }
  }

  if (!(await canPerform(access, "sales_mission_result", "create"))) {
    return { success: false, error: "Anda tidak punya izin mengirim lead." }
  }

  const parsed = pushLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data lead tidak valid." }
  }

  const [mission, report] = await Promise.all([
    getMission(access, missionId),
    getVisitReport(access, missionId),
  ])

  if (!mission) return { success: false, error: "Mission tidak ditemukan." }
  if (!report || !canPushLead(report)) {
    return { success: false, error: "Laporan belum memenuhi syarat untuk dikirim ke LeadEngine." }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  // Re-checked server-side. The button hides after a push, but a stale tab or a
  // double tap on a slow connection would still get here.
  const { data: existing } = await schema
    .from("lead_pushes")
    .select("lead_engine_lead_id")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: "Mission ini sudah pernah dikirim ke LeadEngine." }
  }

  let leadId: string
  let clientCompanyId = parsed.data.clientCompanyId ?? mission.clientCompanyId ?? null

  try {
    if (!clientCompanyId) {
      // Register the company before the lead, so a lead can never land in the
      // pipeline with nothing attached. LeadEngine matches on name first, so
      // this links to an existing record when there is one and only inserts a
      // thin record — flagged "Needs details" — when there is not.
      const { company } = await createClientCompany(mission.clientCompanyName)
      clientCompanyId = company.id
    }

    const created = await createLead({
      clientCompanyId,
      clientCompanyName: mission.clientCompanyName,
      projectName: parsed.data.projectName,
      pipelineId: parsed.data.pipelineId,
      pipelineStageId: parsed.data.pipelineStageId ?? null,
      ownerUserId: parsed.data.ownerUserId,
      estimatedValue: parsed.data.estimatedValue ?? report.estimatedValue ?? null,
      remark: parsed.data.remark?.trim() || report.meetingSummary || null,
      source: `Sales Mission · ${missionId}`,
    })
    leadId = created.id
  } catch (error) {
    return {
      success: false,
      error: error instanceof LeadEngineError ? error.message : "Lead gagal dibuat di LeadEngine.",
    }
  }

  /*
    Register the contacts the rep ticked, and link the report rows back to them.

    Done after the lead exists, and only for names explicitly ticked in the
    modal. Nothing here runs on its own: a visit report submitted at 6pm never
    writes to the CRM by itself, because every typo would become a permanent
    contact and a list nobody trusts is worse than a short one.

    Failures are swallowed on purpose. The lead is already created and recorded;
    refusing the whole push because one contact could not be registered would
    lose the thing that actually matters for a person the admin can add by hand.
  */
  if (clientCompanyId && parsed.data.registerContactNames.length > 0) {
    const wanted = new Set(parsed.data.registerContactNames.map((name) => name.trim().toLowerCase()))

    for (const contact of report.contacts) {
      if (contact.leadEngineContactId) continue
      if (!wanted.has(contact.fullName.trim().toLowerCase())) continue

      try {
        const { contact: created } = await createContact({
          clientCompanyId,
          fullName: contact.fullName,
          jobTitle: contact.jobTitle || null,
          phone: contact.phone || null,
          email: contact.email || null,
        })

        await schema
          .from("report_contacts")
          .update({ lead_engine_contact_id: created.id, link_status: "LINKED" })
          .eq("company_id", access.companyId)
          .eq("report_id", report.id)
          .eq("full_name", contact.fullName)
      } catch {
        // Left as a snapshot. The next push offers it again.
      }
    }
  }

  /*
    Fill the CRM gaps the rep ticked.

    Only ids offered by the precheck are honoured, so a crafted request cannot
    name an arbitrary contact. The endpoint refuses to overwrite a value the CRM
    already holds, which is what makes this safe to run without a human
    comparing the two records field by field.
  */
  if (parsed.data.enrichContactIds.length > 0) {
    const offered = await buildEnrichments(mission, report)
    const wanted = new Set(parsed.data.enrichContactIds)
    const sources = new Map<string, { jobTitle: string; phone: string; email: string }>()

    if (mission.appointment.contactId) {
      sources.set(mission.appointment.contactId, {
        jobTitle: mission.appointment.jobTitle ?? "",
        phone: mission.appointment.phone ?? "",
        email: mission.appointment.email ?? "",
      })
    }
    for (const contact of report.contacts) {
      if (!contact.leadEngineContactId) continue
      const existing = sources.get(contact.leadEngineContactId)
      sources.set(contact.leadEngineContactId, {
        jobTitle: contact.jobTitle || existing?.jobTitle || "",
        phone: contact.phone || existing?.phone || "",
        email: contact.email || existing?.email || "",
      })
    }

    for (const candidate of offered) {
      if (!wanted.has(candidate.contactId)) continue
      const ours = sources.get(candidate.contactId)
      if (!ours) continue

      try {
        await enrichContact({
          contactId: candidate.contactId,
          jobTitle: ours.jobTitle || null,
          phone: ours.phone || null,
          email: ours.email || null,
        })
      } catch {
        // The lead is already created. Losing an optional job title is not a
        // reason to fail a push the rep cannot safely retry.
      }
    }
  }

  // Link the mission to whatever company the push resolved to. Without this the
  // mission keeps reporting "belum tertaut" even though its lead is attached,
  // and the next push from the same client would look up nothing again.
  if (clientCompanyId && clientCompanyId !== mission.clientCompanyId) {
    await schema
      .from("missions")
      .update({ client_company_id: clientCompanyId })
      .eq("id", missionId)
      .eq("company_id", access.companyId)
  }

  const { error: recordError } = await schema.from("lead_pushes").insert({
    mission_id: missionId,
    company_id: access.companyId,
    lead_engine_lead_id: leadId,
    pipeline_id: parsed.data.pipelineId,
    pipeline_stage_id: parsed.data.pipelineStageId ?? null,
    owner_user_id: parsed.data.ownerUserId,
    pushed_by: access.userId,
    idempotency_key: missionId,
  })

  if (recordError) {
    // The lead exists in LeadEngine but the local record failed. Say so plainly
    // rather than reporting a failure that would invite a duplicate push.
    return {
      success: false,
      error: `Lead ${leadId} sudah dibuat di LeadEngine, tetapi pencatatannya di Sales Mission gagal. Jangan kirim ulang — laporkan ke admin.`,
    }
  }

  revalidatePath(`/workspace/missions/${missionId}`)
  return { success: true, data: { leadId } }
}
