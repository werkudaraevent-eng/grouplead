"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { DEFAULT_CONTACT_SALUTATIONS, DEFAULT_INDUSTRIES, isAllowedChoice, readCustomAnswers, validateFieldAnswers, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"
import { isEmptyAnswer, missingRequiredCore } from "@/lib/prospects/prospect-form-fields"
import { normalizePhone } from "@/lib/format/phone"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { entryStatus } from "@/lib/prospects/prospect-status"
import { canEditProspect } from "@/lib/prospects/prospect-access"
import { attemptInputSchema, prospectInputSchema, statusChangeSchema, validateStatusChange, type ProspectInput } from "@/lib/prospects/prospect-schema"
import { parseProspectQuery } from "@/lib/prospects/prospect-filter"
import { parseProspectPageParams } from "@/lib/prospects/prospect-paging"
import { listMatchingProspectIds } from "@/lib/prospects/prospect-page-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import type { ActionResult } from "@/types/action-result"

/**
 * Write side of the prospect list.
 *
 * Every action re-checks access: a Server Action is a public endpoint. The
 * rule for who may touch a prospect lives in lib/prospects/prospect-access
 * and is applied here row by row, so a bulk change over rows the viewer does
 * not hold skips them and says so rather than failing the whole batch.
 */

const PATHS = ["/workspace", "/workspace/prospects"]

export type ProspectFormState = ActionResult<{ id: string }> | null

async function authorize(action: "create" | "read" | "update" | "delete") {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }
  if (!(await canPerform(access, "sales_mission_prospect", action))) {
    return { error: "Anda tidak punya izin untuk prospek." as const }
  }
  const isAdmin = access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update"))
  return { access, isAdmin }
}

function validIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
}

function readProspectForm(formData: FormData) {
  return prospectInputSchema.safeParse({
    clientCompanyName: formData.get("clientCompanyName"),
    clientCompanyId: formData.get("clientCompanyId") || undefined,
    industry: formData.get("industry") || undefined,
    location: formData.get("location") || undefined,
    address: formData.get("address") || undefined,
    website: formData.get("website") || undefined,
    contactSalutation: formData.get("contactSalutation") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactJobTitle: formData.get("contactJobTitle") || undefined,
    contactDivision: formData.get("contactDivision") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    notes: formData.get("notes") || undefined,
    ownerId: formData.get("ownerId") || undefined,
  })
}

function toRow(input: ProspectInput) {
  const website = input.website ? (/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`) : null
  return {
    client_company_name: input.clientCompanyName,
    client_company_id: input.clientCompanyId || null,
    industry: input.industry || null,
    location: input.location || null,
    address: input.address || null,
    website,
    contact_salutation: input.contactSalutation || null,
    contact_name: input.contactName || null,
    contact_job_title: input.contactJobTitle || null,
    contact_division: input.contactDivision || null,
    contact_phone: input.contactPhone || null,
    contact_phone_norm: input.contactPhone ? normalizePhone(input.contactPhone) : null,
    contact_email: input.contactEmail || null,
    notes: input.notes || null,
  }
}

async function memberIds(access: SalesMissionAccess, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const supabase = await createClient()
  const { data } = await supabase.from("company_members").select("user_id").eq("company_id", access.companyId).in("user_id", ids)
  return new Set((data ?? []).map((row) => row.user_id as string))
}

/**
 * The tenant's prospect form applied to a submission: a core field the admin
 * made required must be filled, and the custom answers must fit their types.
 * Returns the custom fields and answers to store, or the first error.
 */
async function checkAgainstForm(access: SalesMissionAccess, formData: FormData, input: ProspectInput, keepStaleIndustry?: string | null) {
  const fields = await listFormFields(access, "prospect")
  const missing = missingRequiredCore(fields, input)
  if (missing) return { error: `${missing} wajib diisi.` }
  if (input.industry && input.industry !== keepStaleIndustry && !isAllowedChoice(fields, "industry", input.industry, DEFAULT_INDUSTRIES)) {
    return { error: "Industri itu tidak ada dalam daftar." }
  }
  const customFields = fields.filter((field) => !field.isCore)
  const answers = readCustomAnswers(formData, customFields)
  const validation = validateFieldAnswers(customFields, answers)
  if (!validation.ok) return { error: Object.values(validation.errors)[0] ?? "Isian tambahan belum lengkap." }
  return { customFields, answers }
}

/** Write the custom answers: emptied ones go, the rest are upserted, so an edit is not a delete-and-recreate in the audit log. */
async function saveCustomAnswers(access: SalesMissionAccess, prospectId: string, customFields: FormField[], answers: Record<string, FieldAnswer>) {
  if (customFields.length === 0) return
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const emptied = customFields.filter((field) => isEmptyAnswer(answers[field.reportingKey])).map((field) => field.id)
  const rows = customFields
    .filter((field) => !isEmptyAnswer(answers[field.reportingKey]))
    .map((field) => ({ prospect_id: prospectId, company_id: access.companyId, field_id: field.id, reporting_key: field.reportingKey, value: answers[field.reportingKey], updated_at: new Date().toISOString() }))
  if (emptied.length > 0) await schema.from("prospect_field_values").delete().eq("company_id", access.companyId).eq("prospect_id", prospectId).in("field_id", emptied)
  if (rows.length > 0) await schema.from("prospect_field_values").upsert(rows, { onConflict: "prospect_id,field_id" })
}

async function checkSalutation(access: SalesMissionAccess, value: string | undefined): Promise<string | null> {
  if (!value) return null
  const fields = await listFormFields(access, "mission")
  return isAllowedChoice(fields, "contact_salutation", value, DEFAULT_CONTACT_SALUTATIONS) ? null : "Sapaan itu tidak ada dalam daftar."
}

export async function createProspect(_previous: ProspectFormState, formData: FormData): Promise<ProspectFormState> {
  const guard = await authorize("create")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const parsed = readProspectForm(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Data prospek tidak valid." }

  const salutationError = await checkSalutation(access, parsed.data.contactSalutation)
  if (salutationError) return { success: false, error: salutationError }
  const form = await checkAgainstForm(access, formData, parsed.data)
  if ("error" in form) return { success: false, error: form.error }

  const ownerId = parsed.data.ownerId || null
  if (ownerId && !(await memberIds(access, [ownerId])).has(ownerId)) {
    return { success: false, error: "Pemegang yang dipilih bukan anggota unit bisnis ini." }
  }

  const statuses = await listProspectStatuses(access)
  const entry = entryStatus(statuses)
  if (!entry) return { success: false, error: "Belum ada status awal untuk prospek." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .insert({ company_id: access.companyId, status_id: entry.id, owner_id: ownerId, source: "manual", created_by: access.userId, ...toRow(parsed.data) })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: "Prospek gagal disimpan." }
  await saveCustomAnswers(access, data.id as string, form.customFields, form.answers)

  PATHS.forEach((path) => revalidatePath(path))
  redirect(`/workspace/prospects/${data.id}`)
}

export async function updateProspect(prospectId: string, _previous: ProspectFormState, formData: FormData): Promise<ProspectFormState> {
  const guard = await authorize("update")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, isAdmin } = guard

  const parsed = readProspectForm(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Data prospek tidak valid." }
  const salutationError = await checkSalutation(access, parsed.data.contactSalutation)
  if (salutationError) return { success: false, error: salutationError }
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data: current } = await schema.from("prospects").select("id, owner_id, industry").eq("company_id", access.companyId).eq("id", prospectId).is("deleted_at", null).maybeSingle()
  if (!current) return { success: false, error: "Prospek tidak ditemukan." }
  if (!canEditProspect({ ownerId: (current.owner_id as string | null) ?? null }, { userId: access.userId, isAdmin })) {
    return { success: false, error: "Prospek ini dipegang orang lain." }
  }
  const form = await checkAgainstForm(access, formData, parsed.data, (current.industry as string | null) ?? null)
  if ("error" in form) return { success: false, error: form.error }

  const ownerId = parsed.data.ownerId || null
  if (ownerId && ownerId !== current.owner_id && !isAdmin && ownerId !== access.userId) {
    return { success: false, error: "Hanya admin yang bisa memindahkan pemegang." }
  }
  if (ownerId && !(await memberIds(access, [ownerId])).has(ownerId)) {
    return { success: false, error: "Pemegang yang dipilih bukan anggota unit bisnis ini." }
  }

  const { error } = await schema
    .from("prospects")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString(), ...toRow(parsed.data) })
    .eq("company_id", access.companyId)
    .eq("id", prospectId)
  if (error) return { success: false, error: "Perubahan gagal disimpan." }
  await saveCustomAnswers(access, prospectId, form.customFields, form.answers)

  PATHS.forEach((path) => revalidatePath(path))
  revalidatePath(`/workspace/prospects/${prospectId}`)
  redirect(`/workspace/prospects/${prospectId}`)
}

/** Rows the viewer may change, out of the ones asked for. */
async function editableRows(access: SalesMissionAccess, isAdmin: boolean, ids: string[]) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select("id, owner_id, status_id, mission_id")
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .in("id", ids)
  const rows = data ?? []
  const allowed = rows.filter((row) => canEditProspect({ ownerId: (row.owner_id as string | null) ?? null }, { userId: access.userId, isAdmin }))
  return { rows, allowed, skipped: rows.length - allowed.length }
}

/**
 * Change status for one or many. Won is refused here: it is given by making
 * the mission (createMission with a prospectId), so a Confirmed prospect
 * always has one.
 */
export async function setProspectStatus(ids: string[], input: unknown): Promise<ActionResult<{ changed: number; skipped: number }>> {
  const guard = await authorize("update")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, isAdmin } = guard

  const parsed = statusChangeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Status tidak valid." }
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada prospek yang dipilih." }

  const statuses = await listProspectStatuses(access)
  const target = statuses.find((status) => status.id === parsed.data.statusId)
  if (!target) return { success: false, error: "Status tidak ditemukan atau sudah diarsipkan." }
  const rule = validateStatusChange(target.kind, parsed.data)
  if (rule) return { success: false, error: rule }

  const { allowed, skipped } = await editableRows(access, isAdmin, unique)
  // A converted prospect follows its mission; its status is not edited by hand.
  const targets = allowed.filter((row) => !row.mission_id)
  if (targets.length === 0) {
    return { success: false, error: skipped > 0 ? "Semua prospek yang dipilih dipegang orang lain." : "Prospek yang sudah jadi mission mengikuti status mission-nya." }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .update({
      status_id: target.id,
      next_contact_at: target.kind === "in_progress" || target.kind === "open" ? (parsed.data.nextContactAt ?? null) : null,
      lost_reason: target.kind === "lost" ? (parsed.data.lostReason?.trim() ?? null) : null,
      updated_at: now,
    })
    .eq("company_id", access.companyId)
    .in("id", targets.map((row) => row.id as string))
    .select("id")
  if (error) return { success: false, error: "Status gagal diubah." }

  PATHS.forEach((path) => revalidatePath(path))
  targets.forEach((row) => revalidatePath(`/workspace/prospects/${row.id}`))
  return { success: true, data: { changed: data?.length ?? 0, skipped: skipped + (allowed.length - targets.length) } }
}

/** Record a contact attempt, and optionally where it left the prospect. */
export async function logProspectAttempt(prospectId: string, input: unknown): Promise<ActionResult> {
  const guard = await authorize("update")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, isAdmin } = guard

  const parsed = attemptInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Catatan kontak tidak valid." }

  const { allowed, rows } = await editableRows(access, isAdmin, [prospectId])
  if (rows.length === 0) return { success: false, error: "Prospek tidak ditemukan." }
  if (allowed.length === 0) return { success: false, error: "Prospek ini dipegang orang lain." }
  const prospect = allowed[0]

  let statusPatch: Record<string, unknown> = {}
  if (parsed.data.statusId && !prospect.mission_id) {
    const statuses = await listProspectStatuses(access)
    const target = statuses.find((status) => status.id === parsed.data.statusId)
    if (!target) return { success: false, error: "Status tidak ditemukan atau sudah diarsipkan." }
    const rule = validateStatusChange(target.kind, parsed.data)
    if (rule) return { success: false, error: rule }
    statusPatch = {
      status_id: target.id,
      next_contact_at: target.kind === "in_progress" || target.kind === "open" ? (parsed.data.nextContactAt ?? null) : null,
      lost_reason: target.kind === "lost" ? (parsed.data.lostReason?.trim() ?? null) : null,
    }
  } else if (parsed.data.nextContactAt && !prospect.mission_id) {
    statusPatch = { next_contact_at: parsed.data.nextContactAt }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const attemptedAt = parsed.data.attemptedAt ?? new Date().toISOString()

  // The attempt row first: it is the record. The counters on the prospect
  // follow, and a failure there is reported rather than hidden.
  const { error: attemptError } = await schema.from("prospect_attempts").insert({
    company_id: access.companyId,
    prospect_id: prospectId,
    channel: parsed.data.channel,
    outcome: parsed.data.outcome,
    note: parsed.data.note || null,
    attempted_at: attemptedAt,
    status_id_after: (statusPatch.status_id as string | undefined) ?? (prospect.status_id as string),
    created_by: access.userId,
  })
  if (attemptError) return { success: false, error: "Catatan kontak gagal disimpan." }

  const { count } = await schema.from("prospect_attempts").select("id", { count: "exact", head: true }).eq("prospect_id", prospectId)
  const { error: updateError } = await schema
    .from("prospects")
    .update({ ...statusPatch, last_contacted_at: attemptedAt, attempt_count: count ?? 1, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", prospectId)
  if (updateError) return { success: false, error: "Kontak tercatat, tetapi status prospek gagal diperbarui. Coba ubah statusnya sekali lagi." }

  PATHS.forEach((path) => revalidatePath(path))
  revalidatePath(`/workspace/prospects/${prospectId}`)
  return { success: true }
}

/** Hand prospects to someone (admin), or take unowned ones yourself. */
export async function assignProspects(ids: string[], ownerId: string | null): Promise<ActionResult<{ changed: number; skipped: number }>> {
  const guard = await authorize("update")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, isAdmin } = guard
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada prospek yang dipilih." }

  if (ownerId && !(await memberIds(access, [ownerId])).has(ownerId)) {
    return { success: false, error: "Orang yang dipilih bukan anggota unit bisnis ini." }
  }
  // A non-admin may only take a prospect for themself, and only one nobody holds.
  if (!isAdmin && ownerId !== access.userId) return { success: false, error: "Hanya admin yang bisa menugaskan prospek ke orang lain." }

  const supabase = await createClient()
  const { data: rows } = await supabase.schema("sales_mission").from("prospects").select("id, owner_id").eq("company_id", access.companyId).is("deleted_at", null).in("id", unique)
  const targets = (rows ?? []).filter((row) => isAdmin || row.owner_id === null || row.owner_id === access.userId)
  if (targets.length === 0) return { success: false, error: "Prospek yang dipilih sudah dipegang orang lain." }

  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .in("id", targets.map((row) => row.id as string))
    .select("id")
  if (error) return { success: false, error: "Penugasan gagal disimpan." }

  PATHS.forEach((path) => revalidatePath(path))
  targets.forEach((row) => revalidatePath(`/workspace/prospects/${row.id}`))
  return { success: true, data: { changed: data?.length ?? 0, skipped: (rows?.length ?? 0) - targets.length } }
}

/** To the bin. An admin restores or removes for good from Pengaturan → Sampah. */
export async function deleteProspects(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const guard = await authorize("delete")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada prospek yang dipilih." }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .update({ deleted_at: now, deleted_by: access.userId, updated_at: now })
    .eq("company_id", access.companyId)
    .in("id", unique)
    .is("deleted_at", null)
    .select("id")
  if (error) return { success: false, error: "Prospek gagal dipindahkan ke sampah." }

  PATHS.forEach((path) => revalidatePath(path))
  revalidatePath("/workspace/settings/recycle-bin")
  return { success: true, data: { deleted: data?.length ?? 0 } }
}

/** Ids of everything the current filter matches, for "select all". */
export async function matchingProspectIds(params: Record<string, string>): Promise<ActionResult<{ ids: string[]; total: number; capped: boolean }>> {
  const guard = await authorize("read")
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date())
  const { ids, total } = await listMatchingProspectIds(access, { query: parseProspectQuery(params), sort: parseProspectPageParams(params).sort, today }, 500)
  return { success: true, data: { ids, total, capped: total > ids.length } }
}
