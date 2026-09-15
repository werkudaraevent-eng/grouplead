"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { MISSION_TIME_ZONE, MISSION_TYPES, createMissionSchema, toMissionTimestamp, type AssignmentResponse } from "@/lib/missions/mission-schema"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { getMission, getMissionRole, getMissionSettings, listMissionTeam } from "@/lib/missions/mission-queries"
import { notify } from "@/lib/notifications/notification-queries"
import { rescheduleMission } from "@/app/actions/assignment-actions"
import { recordCompanyVisit } from "@/lib/leadengine/client"
import { deriveMissionStatus, initialResponse } from "@/lib/missions/assignment-workflow"
import {
  DEFAULT_CONTACT_SALUTATIONS,
  configuredOptions,
  validateFieldAnswers,
  type FieldAnswer,
} from "@/lib/missions/form-fields"
import type { ActionResult } from "@/types/action-result"
import { CLEAR_ALL_PHRASE } from "@/lib/missions/clear-phrase"
import { parseMissionQuery, resolveMissionFilter } from "@/lib/missions/mission-filter"
import { listMatchingMissionIds, parsePageParams } from "@/lib/missions/mission-page-queries"

/**
 * Write side of the mission domain.
 *
 * Authorization is re-checked here rather than trusted from the page: a Server
 * Action is a public endpoint, reachable without ever rendering the UI that
 * calls it.
 */


/** One reading of the form, so creating and editing cannot disagree about a field. */
function readMissionForm(formData: FormData) {
  return createMissionSchema.safeParse({
    clientCompanyName: formData.get("clientCompanyName"),
    clientCompanyId: formData.get("clientCompanyId") || undefined,
    missionType: formData.get("missionType"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") || undefined,
    location: formData.get("location") || undefined,
    objective: formData.get("objective") || undefined,
    primarySalesId: formData.get("primarySalesId"),
    supportingSalesIds: formData.getAll("supportingSalesIds").filter((value) => typeof value === "string" && value.length > 0),
    contactSalutation: formData.get("contactSalutation") || undefined,
    contactId: formData.get("contactId") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactJobTitle: formData.get("contactJobTitle") || undefined,
    contactDivision: formData.get("contactDivision") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    building: formData.get("building") || undefined,
    address: formData.get("address") || undefined,
    appointmentNotes: formData.get("appointmentNotes") || undefined,
  })
}

/** Custom-field answers off the form, by the tenant's field types. */
function readCustomAnswers(formData: FormData, customFields: Awaited<ReturnType<typeof listFormFields>>): Record<string, FieldAnswer> {
  const answers: Record<string, FieldAnswer> = {}
  for (const field of customFields) {
    const name = `custom__${field.reportingKey}`
    if (field.fieldType === "MULTI_SELECT") {
      answers[field.reportingKey] = formData.getAll(name).map(String)
    } else if (field.fieldType === "BOOLEAN") {
      answers[field.reportingKey] = formData.get(name) === "true"
    } else {
      const raw = formData.get(name)
      answers[field.reportingKey] = typeof raw === "string" && raw !== "" ? raw : null
    }
  }
  return answers
}

export type CreateMissionState = ActionResult<{ id: string }> | null

/** Signature matches `useActionState`, so the form owns the pending and error state. */
export async function createMission(
  _previous: CreateMissionState,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

  // Lets an admin restrict a pure field-sales role to responding to missions
  // rather than creating them. Unconfigured means unrestricted.
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { success: false, error: "Anda tidak punya izin membuat mission." }
  }

  const parsed = readMissionForm(formData)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data mission tidak valid." }
  }

  /*
    The type used to be a compile-time enum. It is now whatever the tenant
    configured, so the list has to be read to be checked.

    An empty list falls back to the defaults rather than skipping the check.
    Skipping looked harmless because the settings screen refuses to save a
    choice field with no options, but `missions.mission_type` is free text with
    no constraint behind it, so "no list" would have meant "any string this
    endpoint is handed". The form renders the same fallback, which keeps the two
    agreeing on what is offered and what is accepted.
  */
  // Three reads that do not depend on each other, so they share one wait.
  const supabase = await createClient()
  const assigneeIds = [parsed.data.primarySalesId, ...parsed.data.supportingSalesIds]
  const [formFields, settings, memberCheck] = await Promise.all([
    listFormFields(access, "mission"),
    getMissionSettings(access),
    supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", access.companyId)
      .in("user_id", assigneeIds),
  ])
  const allowedTypes = configuredOptions(formFields, "mission_type", MISSION_TYPES)

  if (!allowedTypes.includes(parsed.data.missionType)) {
    return { success: false, error: "Jenis mission itu tidak ada dalam daftar." }
  }

  // Same rule for the salutation, for the same reason: the column is free text
  // and the list is the admin's.
  const allowedSalutations = configuredOptions(formFields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)
  if (parsed.data.contactSalutation && !allowedSalutations.includes(parsed.data.contactSalutation)) {
    return { success: false, error: "Sapaan itu tidak ada dalam daftar." }
  }

  /*
    Enforce the admin's "wajib diisi" on core fields.

    validateFieldAnswers deliberately skips core fields, because their meaning
    lives in createMissionSchema. But that schema encodes the ORIGINAL
    optionality, so a field the admin later tightened was marked with an
    asterisk on the form and then saved happily empty: the browser attribute was
    the only thing asking, and a browser attribute is not a rule. Sales pendukung
    is the clearest case, being checkboxes that carry no `required` at all.
  */
  const coreValues: Record<string, unknown> = {
    client_company: parsed.data.clientCompanyName,
    mission_type: parsed.data.missionType,
    location: parsed.data.location,
    date: parsed.data.date,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    objective: parsed.data.objective,
    primary_sales: parsed.data.primarySalesId,
    supporting_sales: parsed.data.supportingSalesIds,
    contact_salutation: parsed.data.contactSalutation,
    contact_name: parsed.data.contactName,
    contact_job_title: parsed.data.contactJobTitle,
    contact_division: parsed.data.contactDivision,
    contact_phone: parsed.data.contactPhone,
    contact_email: parsed.data.contactEmail,
    building: parsed.data.building,
    address: parsed.data.address,
    appointment_notes: parsed.data.appointmentNotes,
  }

  for (const field of formFields) {
    if (!field.isCore || !field.isRequired) continue
    if (!(field.reportingKey in coreValues)) continue
    const value = coreValues[field.reportingKey]
    const empty = value === null || value === undefined || value === "" ||
      (Array.isArray(value) && value.length === 0)
    if (empty) return { success: false, error: `${field.label} wajib diisi.` }
  }

  const input = parsed.data
  const missions = supabase.schema("sales_mission")

  // Under the tenant's policy the assignment either waits for the rep or is
  // accepted on the spot. The mission's status follows from the same answer.
  const now = new Date().toISOString()
  // Each person's answer on their own terms: the scheduler putting themself
  // on the visit has already said yes; everyone else follows the policy.
  const answerFor = (userId: string) => {
    const response = initialResponse(settings, { selfAssigned: userId === access.userId })
    return { response, responded_at: response === "ACCEPTED" ? now : null }
  }
  const initialStatus = answerFor(parsed.data.primarySalesId).response === "ACCEPTED" ? "ACCEPTED" : "ASSIGNED"

  // Never trust user ids from the client. An assignee must be a member of this
  // tenant, or a crafted request could assign missions to anyone in the shared
  // database.
  const { data: members, error: memberError } = memberCheck
  if (memberError) return { success: false, error: "Gagal memverifikasi anggota tim." }

  const validIds = new Set((members ?? []).map((row) => row.user_id as string))
  const unknown = assigneeIds.filter((id) => !validIds.has(id))
  if (unknown.length > 0) {
    return { success: false, error: "Sales yang dipilih bukan anggota unit bisnis ini." }
  }

  const { data: mission, error: missionError } = await missions
    .from("missions")
    .insert({
      company_id: access.companyId,
      client_company_name_snapshot: input.clientCompanyName,
      client_company_id: input.clientCompanyId ?? null,
      mission_type: input.missionType,
      status: initialStatus,
      objective: input.objective || null,
      location: input.location || null,
      scheduled_start: toMissionTimestamp(input.date, input.startTime),
      scheduled_end: input.endTime ? toMissionTimestamp(input.date, input.endTime) : null,
      contact_salutation: input.contactSalutation || null,
      // Set only when the rep picked someone the CRM already knows. A typed
      // name stays a snapshot, which is the honest record of what was known.
      contact_id: input.contactId || null,
      contact_name: input.contactName || null,
      contact_job_title: input.contactJobTitle || null,
      contact_division: input.contactDivision || null,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      building: input.building || null,
      address: input.address || null,
      appointment_notes: input.appointmentNotes || null,
      created_by: access.userId,
    })
    .select("id")
    .single()

  if (missionError || !mission) {
    return { success: false, error: "Mission gagal disimpan." }
  }

  const { error: assignmentError } = await missions.from("assignments").insert([
    {
      mission_id: mission.id,
      company_id: access.companyId,
      user_id: input.primarySalesId,
      assignment_role: "PRIMARY",
      ...answerFor(input.primarySalesId),
    },
    ...input.supportingSalesIds.map((userId) => ({
      mission_id: mission.id,
      company_id: access.companyId,
      user_id: userId,
      assignment_role: "SUPPORTING",
      ...answerFor(userId),
    })),
  ])

  if (assignmentError) {
    // PostgREST cannot span these inserts in one transaction. A mission with no
    // primary sales is a broken state, so undo rather than leave it behind.
    // Move both inserts into a Postgres function when this grows further.
    await missions.from("missions").delete().eq("id", mission.id)
    return { success: false, error: "Penugasan sales gagal disimpan. Mission dibatalkan." }
  }

  // Everyone put on the visit hears about it, except the scheduler when they
  // put themself on it: they know. This was missing, so a rep assigned at
  // creation only learned of the visit by opening the app and looking.
  await notify(
    access,
    "MISSION_ASSIGNED",
    assigneeIds.filter((id) => id !== access.userId),
    { missionId: mission.id, clientName: input.clientCompanyName }
  )

  // Admin-configured fields. Validation uses the tenant's current configuration
  // rather than anything hardcoded, so a field made mandatory this morning is
  // mandatory this afternoon. Reuses the list already read for the type check.
  const customFields = formFields.filter((field) => !field.isCore)

  if (customFields.length > 0) {
    const answers = readCustomAnswers(formData, customFields)

    const validation = validateFieldAnswers(customFields, answers)
    if (!validation.ok) {
      // The mission row exists but its answers are invalid. Undo rather than
      // keep a mission that violates the tenant's own form rules.
      await missions.from("missions").delete().eq("id", mission.id)
      return { success: false, error: Object.values(validation.errors)[0] ?? "Isian tambahan belum lengkap." }
    }

    const rows = customFields
      .filter((field) => {
        const value = answers[field.reportingKey]
        return value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)
      })
      .map((field) => ({
        mission_id: mission.id,
        company_id: access.companyId,
        field_id: field.id,
        reporting_key: field.reportingKey,
        value: answers[field.reportingKey],
      }))

    if (rows.length > 0) {
      await missions.from("mission_field_values").insert(rows)
    }
  }

  // Best-effort audit trail: losing a history row must not fail a saved mission.
  await missions.from("status_history").insert({
    mission_id: mission.id,
    company_id: access.companyId,
    to_status: initialStatus,
    changed_by: access.userId,
    reason: "Mission dibuat",
  })

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")

  // Redirect from the server rather than reacting to the result on the client.
  // `revalidatePath` above refreshes the tree, which remounts the form and
  // discards `useActionState` before an effect could navigate — the mission
  // saved, but the page sat there looking as though nothing had happened.
  redirect(`/workspace/missions/${mission.id}`)
}

/**
 * Call the visit off before it happens.
 *
 * For the primary, whoever scheduled it, and admins. A visit that failed on
 * site is not this: that is a report with the outcome "Klien tidak ada" or
 * "Dibatalkan di tempat", because the rep went. This is for the phone call
 * that morning, which used to have no path at all and left the mission at
 * "Diterima" forever or pushed the rep into writing a report about a visit
 * that never took place.
 *
 * The reason lands in status_history and, when the company is in the CRM,
 * on its timeline: the appointment team reads it to decide whether to try
 * again, and the account's history stays honest about a visit that did not
 * happen.
 */
export async function cancelMission(missionId: string, reason: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) {
    return { success: false, error: "Anda tidak punya izin mengubah mission." }
  }

  const trimmed = reason.trim()
  if (!trimmed) return { success: false, error: "Tulis alasan pembatalan." }
  if (trimmed.length > 1000) return { success: false, error: "Alasan terlalu panjang." }

  const [mission, role] = await Promise.all([getMission(access, missionId), getMissionRole(access, missionId)])
  if (!mission) return { success: false, error: "Mission tidak ditemukan." }

  const mayCancel = access.isSuperAdmin || role === "PRIMARY" || mission.createdBy === access.userId
  if (!mayCancel) {
    return { success: false, error: "Hanya sales utama, pembuat mission, atau admin yang bisa membatalkan." }
  }
  if (mission.status === "COMPLETED" || mission.status === "CANCELLED") {
    return { success: false, error: "Mission ini sudah selesai atau sudah dibatalkan." }
  }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")
  const now = new Date().toISOString()

  const { error } = await missions
    .from("missions")
    .update({ status: "CANCELLED", updated_at: now })
    .eq("id", missionId)
    .eq("company_id", access.companyId)
  if (error) return { success: false, error: "Mission gagal dibatalkan." }

  await missions.from("status_history").insert({
    mission_id: missionId,
    company_id: access.companyId,
    from_status: mission.status,
    to_status: "CANCELLED",
    changed_by: access.userId,
    reason: trimmed,
  })

  // An open proposal has nothing left to decide.
  await missions
    .from("reschedule_requests")
    .update({ status: "REJECTED", decided_by: access.userId, decided_at: now, decision_note: "Mission dibatalkan" })
    .eq("mission_id", missionId)
    .eq("company_id", access.companyId)
    .eq("status", "PENDING")

  const team = await listMissionTeam(access, missionId)
  await notify(
    access,
    "MISSION_CANCELLED",
    [...team.map((member) => member.userId), mission.createdBy],
    { missionId, clientName: mission.clientCompanyName }
  )

  // Best-effort: the CRM should know the visit did not happen, but a CRM
  // outage must not stop the cancellation.
  if (mission.clientCompanyId) {
    try {
      await recordCompanyVisit({
        clientCompanyId: mission.clientCompanyId,
        missionId,
        visitedOn: mission.scheduledStart
          ? new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date(mission.scheduledStart))
          : new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date()),
        salesName: mission.primarySalesName ?? access.displayName,
        outcome: `Dibatalkan sebelum kunjungan: ${trimmed}`,
        contactNames: [],
      })
    } catch {
      // See above.
    }
  }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/**
 * Move missions to the recycle bin.
 *
 * A soft delete: the row is marked, everything under it stays, and every
 * read of live missions skips marked rows. An admin restores from the bin
 * or removes for good (recycle-bin-actions); what nobody touches is purged
 * after the retention period. Held to the mission module's `delete` grant,
 * which no default role carries; an admin hands it out deliberately.
 */
export async function deleteMissions(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "delete"))) {
    return { success: false, error: "Anda tidak punya izin menghapus mission." }
  }

  const unique = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (unique.length === 0) return { success: false, error: "Tidak ada mission yang dipilih." }
  if (unique.length > 500) return { success: false, error: "Pilih paling banyak 500 mission sekaligus." }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .update({ deleted_at: now, deleted_by: access.userId, updated_at: now })
    .eq("company_id", access.companyId)
    .in("id", unique)
    .is("deleted_at", null)
    .select("id")

  if (error) return { success: false, error: "Mission gagal dipindahkan ke sampah." }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath("/workspace/settings/recycle-bin")
  return { success: true, data: { deleted: data?.length ?? 0 } }
}

/**
 * Move every mission to the recycle bin, for clearing a trial before real
 * use. The bin's own "kosongkan" then removes them for good.
 *
 * Type-to-confirm, the way GitHub guards deleting a repository: the phrase is
 * checked here as well as in the dialog, because a Server Action is a public
 * endpoint and the dialog is only a courtesy.
 */
export async function clearAllMissions(confirmation: string): Promise<ActionResult<{ deleted: number }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { success: false, error: "Hanya admin Sales Mission yang bisa mengosongkan data." }
  }
  if (!(await canPerform(access, "sales_mission_mission", "delete"))) {
    return { success: false, error: "Peran Anda tidak punya izin menghapus mission." }
  }
  if (confirmation.trim() !== CLEAR_ALL_PHRASE) {
    return { success: false, error: `Ketik persis "${CLEAR_ALL_PHRASE}" untuk melanjutkan.` }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .update({ deleted_at: now, deleted_by: access.userId, updated_at: now })
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .select("id")

  if (error) return { success: false, error: "Data gagal dikosongkan." }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath("/workspace/settings/data")
  revalidatePath("/workspace/settings/recycle-bin")
  return { success: true, data: { deleted: data?.length ?? 0 } }
}

/**
 * Correct a mission's details after it was made.
 *
 * The same form as creating, already filled in, with two things deliberately
 * left out: the schedule, which moves through Pindahkan jadwal so the team
 * is told and re-asked under the confirmation policy, and the mission's own
 * status. The team can change here, because picking the wrong person is the
 * commonest mistake: a new assignee starts with the policy's answer and is
 * told; a removed one is simply removed.
 *
 * For whoever scheduled it, the primary, and admins, while the visit is
 * still ahead. The audit trigger records the before and after.
 */
export async function updateMission(
  missionId: string,
  _previous: CreateMissionState,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) {
    return { success: false, error: "Anda tidak punya izin mengubah mission." }
  }

  const [mission, role] = await Promise.all([getMission(access, missionId), getMissionRole(access, missionId)])
  if (!mission) return { success: false, error: "Mission tidak ditemukan." }
  const mayEdit = access.isSuperAdmin || role === "PRIMARY" || mission.createdBy === access.userId
  if (!mayEdit) return { success: false, error: "Hanya sales utama, pembuat mission, atau admin yang bisa mengubah." }
  if (mission.status === "COMPLETED" || mission.status === "CANCELLED") {
    return { success: false, error: "Mission yang sudah selesai atau dibatalkan tidak bisa diubah." }
  }

  const parsed = readMissionForm(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data mission tidak valid." }
  }
  const input = parsed.data

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")
  const assigneeIds = [input.primarySalesId, ...input.supportingSalesIds]
  const [formFields, settings, memberCheck, team] = await Promise.all([
    listFormFields(access, "mission"),
    getMissionSettings(access),
    supabase.from("company_members").select("user_id").eq("company_id", access.companyId).in("user_id", assigneeIds),
    listMissionTeam(access, missionId),
  ])

  const allowedTypes = configuredOptions(formFields, "mission_type", MISSION_TYPES)
  if (!allowedTypes.includes(input.missionType)) return { success: false, error: "Jenis mission itu tidak ada dalam daftar." }
  const allowedSalutations = configuredOptions(formFields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)
  if (input.contactSalutation && !allowedSalutations.includes(input.contactSalutation)) {
    return { success: false, error: "Sapaan itu tidak ada dalam daftar." }
  }

  // The admin's "wajib diisi" on core fields, same rule as creating. The
  // schedule is not on this form, so its fields are not asked for here.
  const coreValues: Record<string, unknown> = {
    client_company: input.clientCompanyName,
    mission_type: input.missionType,
    location: input.location,
    objective: input.objective,
    primary_sales: input.primarySalesId,
    supporting_sales: input.supportingSalesIds,
    contact_salutation: input.contactSalutation,
    contact_name: input.contactName,
    contact_job_title: input.contactJobTitle,
    contact_division: input.contactDivision,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail,
    building: input.building,
    address: input.address,
    appointment_notes: input.appointmentNotes,
  }
  for (const field of formFields) {
    if (!field.isCore || !field.isRequired || !(field.reportingKey in coreValues)) continue
    const value = coreValues[field.reportingKey]
    const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
    if (empty) return { success: false, error: `${field.label} wajib diisi.` }
  }

  const { data: members, error: memberError } = memberCheck
  if (memberError) return { success: false, error: "Gagal memverifikasi anggota tim." }
  const validIds = new Set((members ?? []).map((row) => row.user_id as string))
  if (assigneeIds.some((id) => !validIds.has(id))) {
    return { success: false, error: "Sales yang dipilih bukan anggota unit bisnis ini." }
  }

  // Custom answers are validated before anything is written, so a bad
  // answer leaves the mission exactly as it was.
  const customFields = formFields.filter((field) => !field.isCore)
  const answers = readCustomAnswers(formData, customFields)
  const validation = validateFieldAnswers(customFields, answers)
  if (!validation.ok) {
    return { success: false, error: Object.values(validation.errors)[0] ?? "Isian tambahan belum lengkap." }
  }

  // Schedule. One form, one save: if the slot changed, it moves through the
  // same path Pindahkan jadwal used, so the team is told and, under
  // confirmation, re-asked. Someone who may only propose is refused here;
  // the form did not offer them the picker, so this only guards the endpoint.
  const nextStart = toMissionTimestamp(input.date, input.startTime)
  const nextEnd = input.endTime ? toMissionTimestamp(input.date, input.endTime) : null
  const sameInstant = (a: string | null, b: string | null) =>
    (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null)
  const scheduleChanged = !sameInstant(mission.scheduledStart, nextStart) || !sameInstant(mission.scheduledEnd, nextEnd)
  const mayMoveSchedule =
    access.isSuperAdmin || mission.createdBy === access.userId || (role === "PRIMARY" && settings.primaryCanReschedule)
  if (scheduleChanged && !mayMoveSchedule) {
    return { success: false, error: "Jadwal mission ini hanya bisa diusulkan, bukan diubah langsung. Gunakan Usulkan jadwal lain." }
  }

  const { error: updateError } = await missions
    .from("missions")
    .update({
      client_company_name_snapshot: input.clientCompanyName,
      client_company_id: input.clientCompanyId ?? null,
      mission_type: input.missionType,
      objective: input.objective || null,
      location: input.location || null,
      contact_salutation: input.contactSalutation || null,
      contact_id: input.contactId || null,
      contact_name: input.contactName || null,
      contact_job_title: input.contactJobTitle || null,
      contact_division: input.contactDivision || null,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      building: input.building || null,
      address: input.address || null,
      appointment_notes: input.appointmentNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", missionId)
    .eq("company_id", access.companyId)
  if (updateError) return { success: false, error: "Perubahan gagal disimpan." }

  if (scheduleChanged) {
    const reasonRaw = formData.get("scheduleReason")
    const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : "Jadwal diubah dari form Ubah mission"
    const moved = await rescheduleMission(missionId, { date: input.date, startTime: input.startTime, endTime: input.endTime ?? "", reason })
    if (!moved.success) return { success: false, error: moved.error ?? "Detail tersimpan, tetapi jadwal gagal dipindahkan." }
  }

  // Team diff. Roles are compared per person: someone moved from supporting
  // to primary keeps their answer, someone new gets the policy's answer.
  const before = new Map(team.map((member) => [member.userId, member.role]))
  const after = new Map<string, "PRIMARY" | "SUPPORTING">([
    [input.primarySalesId, "PRIMARY"],
    ...input.supportingSalesIds.map((id) => [id, "SUPPORTING"] as const),
  ])
  const now = new Date().toISOString()
  const removed = [...before.keys()].filter((id) => !after.has(id))
  const added = [...after.keys()].filter((id) => !before.has(id))
  const moved = [...after.entries()].filter(([id, roleNow]) => before.has(id) && before.get(id) !== roleNow)

  if (removed.length > 0) {
    await missions.from("assignments").delete().eq("mission_id", missionId).eq("company_id", access.companyId).in("user_id", removed)
  }
  for (const [id, roleNow] of moved) {
    await missions.from("assignments").update({ assignment_role: roleNow }).eq("mission_id", missionId).eq("company_id", access.companyId).eq("user_id", id)
  }
  if (added.length > 0) {
    const { error: addError } = await missions.from("assignments").insert(
      added.map((id) => {
        const response = initialResponse(settings, { selfAssigned: id === access.userId })
        return {
          mission_id: missionId,
          company_id: access.companyId,
          user_id: id,
          assignment_role: after.get(id),
          response,
          responded_at: response === "ACCEPTED" ? now : null,
        }
      })
    )
    if (addError) return { success: false, error: "Detail tersimpan, tetapi tim gagal diperbarui." }
    await notify(
      access,
      "MISSION_ASSIGNED",
      added.filter((id) => id !== access.userId),
      { missionId, clientName: input.clientCompanyName }
    )
  }

  // The mission's status follows the team's answers, as everywhere else.
  if (removed.length > 0 || added.length > 0 || moved.length > 0) {
    const { data: rows } = await missions.from("assignments").select("assignment_role, response").eq("company_id", access.companyId).eq("mission_id", missionId)
    const next = deriveMissionStatus(
      mission.status,
      (rows ?? []).map((row) => ({ role: row.assignment_role as "PRIMARY" | "SUPPORTING", response: row.response as AssignmentResponse }))
    )
    if (next !== mission.status) {
      await missions.from("missions").update({ status: next }).eq("id", missionId).eq("company_id", access.companyId)
      await missions.from("status_history").insert({
        mission_id: missionId, company_id: access.companyId, from_status: mission.status, to_status: next,
        changed_by: access.userId, reason: "Tim diubah",
      })
    }
  }

  // Custom answers: replace, so a cleared field really clears.
  await missions.from("mission_field_values").delete().eq("mission_id", missionId).eq("company_id", access.companyId)
  const rows = customFields
    .filter((field) => {
      const value = answers[field.reportingKey]
      return value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)
    })
    .map((field) => ({
      mission_id: missionId,
      company_id: access.companyId,
      field_id: field.id,
      reporting_key: field.reportingKey,
      value: answers[field.reportingKey],
    }))
  if (rows.length > 0) await missions.from("mission_field_values").insert(rows)

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)
  redirect(`/workspace/missions/${missionId}`)
}

/**
 * Every mission id the current filters match, for "pilih semua N yang
 * cocok" on the list. Capped at what deleteMissions accepts, and the caller
 * is told when the cap bit.
 */
export async function matchingMissionIds(
  params: Record<string, string>
): Promise<ActionResult<{ ids: string[]; total: number; capped: boolean }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "delete"))) {
    return { success: false, error: "Anda tidak punya izin menghapus mission." }
  }
  const settings = await getMissionSettings(access)
  const requested = resolveMissionFilter(params.filter)
  const lens = settings.requireAssignmentConfirmation ? requested : "all"
  const { sort } = parsePageParams(params)
  const { ids, total } = await listMatchingMissionIds(access, { query: parseMissionQuery(params), lens, sort, now: new Date() }, 500)
  return { success: true, data: { ids, total, capped: total > ids.length } }
}
