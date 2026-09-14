"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { MISSION_TIME_ZONE, MISSION_TYPES, createMissionSchema, toMissionTimestamp } from "@/lib/missions/mission-schema"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { getMission, getMissionRole, getMissionSettings, listMissionTeam } from "@/lib/missions/mission-queries"
import { notify } from "@/lib/notifications/notification-queries"
import { recordCompanyVisit } from "@/lib/leadengine/client"
import { initialResponse } from "@/lib/missions/assignment-workflow"
import {
  DEFAULT_CONTACT_SALUTATIONS,
  configuredOptions,
  validateFieldAnswers,
  type FieldAnswer,
} from "@/lib/missions/form-fields"
import type { ActionResult } from "@/types/action-result"
import { CLEAR_ALL_PHRASE } from "@/lib/missions/clear-phrase"

/**
 * Write side of the mission domain.
 *
 * Authorization is re-checked here rather than trusted from the page: a Server
 * Action is a public endpoint, reachable without ever rendering the UI that
 * calls it.
 */

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

  const parsed = createMissionSchema.safeParse({
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
    appointmentNotes: formData.get("appointmentNotes") || undefined,
  })

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

  // Admin-configured fields. Validation uses the tenant's current configuration
  // rather than anything hardcoded, so a field made mandatory this morning is
  // mandatory this afternoon. Reuses the list already read for the type check.
  const customFields = formFields.filter((field) => !field.isCore)

  if (customFields.length > 0) {
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
 * Remove missions outright.
 *
 * Hard delete, not a recycle bin: the child rows cascade, and the audit log's
 * DELETE row keeps the full record of each mission with who removed it, which
 * is the part an admin later needs. Held to the mission module's `delete`
 * grant, which no default role carries; an admin hands it out deliberately.
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
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .delete()
    .eq("company_id", access.companyId)
    .in("id", unique)
    .select("id")

  if (error) return { success: false, error: "Mission gagal dihapus." }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  return { success: true, data: { deleted: data?.length ?? 0 } }
}

/**
 * Empty the tenant's missions, for clearing a trial before real use.
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
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .delete()
    .eq("company_id", access.companyId)
    .select("id")

  if (error) return { success: false, error: "Data gagal dikosongkan." }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath("/workspace/settings/data")
  return { success: true, data: { deleted: data?.length ?? 0 } }
}
