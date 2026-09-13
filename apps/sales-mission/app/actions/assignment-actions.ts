"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import {
  getMission,
  getMissionRole,
  getMissionSettings,
  listMissionTeam,
  listMissions,
} from "@/lib/missions/mission-queries"
import { notify } from "@/lib/notifications/notification-queries"
import { annotateJoinStatus, canJoin, joinBlockedReason } from "@/lib/missions/mission-join"
import {
  applyRescheduleApproval,
  applyRescheduleRejection,
  canRespond,
  deriveMissionStatus,
  rescheduleRequestSchema,
} from "@/lib/missions/assignment-workflow"
import { toMissionTimestamp, type AssignmentResponse, type MissionStatus } from "@/lib/missions/mission-schema"
import type { ActionResult } from "@/types/action-result"

/**
 * Team membership on a mission.
 *
 * Joining is self-service so an idle sales can add themselves to a colleague's
 * visit, but three guards keep it from becoming chaos: the schedule check runs
 * server-side with the same function the UI used, the primary can remove anyone
 * and close the mission, and the database trigger caps the team size.
 */

/**
 * Every action in this file changes a mission or its team, so all of them
 * answer to the same module action: `sales_mission_mission` update.
 *
 * This is a different question from the per-mission role checks below, and both
 * are needed. The role answers "which mission may you touch" — a rep is PRIMARY
 * on their own mission for as long as they hold it. The module answers "may
 * your role touch missions at all" — which an admin can revoke tonight, and
 * which a role check would never notice.
 *
 * Update rather than create/delete throughout: nobody here is making a mission
 * or removing one. Removing a supporting sales edits the team of a mission that
 * still exists, which is why it asks for update and not delete.
 */
const NO_MISSION_WRITE: ActionResult = {
  success: false,
  error: "Anda tidak punya izin mengubah mission.",
}

/**
 * Join a mission as supporting sales.
 *
 * The eligibility check is repeated here rather than trusted from the button: a
 * Server Action is reachable directly, and the client's view of the calendar
 * may be seconds out of date.
 */
export async function joinMission(missionId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const [missions, settings] = await Promise.all([listMissions(access), getMissionSettings(access)])
  const annotated = annotateJoinStatus(missions, settings)
  const target = annotated.find((mission) => mission.id === missionId)

  if (!target) return { success: false, error: "Mission tidak ditemukan." }

  if (!canJoin(target.joinStatus)) {
    return {
      success: false,
      error:
        joinBlockedReason(target.joinStatus, settings.maxSupporting) ??
        "Anda sudah terdaftar pada mission ini.",
    }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  // Response is ACCEPTED immediately: the person volunteered, so asking them to
  // confirm their own request would be noise. A joiner is never PRIMARY.
  const { error } = await schema.from("assignments").insert({
    mission_id: missionId,
    company_id: access.companyId,
    user_id: access.userId,
    assignment_role: "SUPPORTING",
    response: "ACCEPTED",
    responded_at: new Date().toISOString(),
  })

  if (error) {
    // The cap trigger raises a check violation when the team filled up between
    // the page render and this request.
    return {
      success: false,
      error: error.message.includes("batas")
        ? `Mission sudah penuh (maksimal ${settings.maxSupporting} sales pendukung).`
        : "Gagal bergabung ke mission.",
    }
  }

  await schema.from("status_history").insert({
    mission_id: missionId,
    company_id: access.companyId,
    to_status: target.status,
    changed_by: access.userId,
    reason: `${access.displayName} bergabung sebagai sales pendukung`,
  })

  // The primary is accountable for who is in the room, so they hear about a
  // joiner immediately rather than discovering them on the day.
  const team = await listMissionTeam(access, missionId)
  await notify(
    access,
    "MISSION_JOINED",
    team.map((member) => member.userId),
    { missionId, clientName: target.clientCompanyName }
  )

  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/** Leave a mission you joined. The primary cannot leave their own mission. */
export async function leaveMission(missionId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const role = await getMissionRole(access, missionId)
  if (role === null) return { success: false, error: "Anda tidak terdaftar pada mission ini." }
  if (role === "PRIMARY") {
    return { success: false, error: "Sales utama tidak bisa keluar. Minta admin mengganti penugasan." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("assignments")
    .delete()
    .eq("mission_id", missionId)
    .eq("company_id", access.companyId)
    .eq("user_id", access.userId)

  if (error) return { success: false, error: "Gagal keluar dari mission." }

  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/**
 * Remove a supporting sales from a mission.
 *
 * Only the primary or a super admin may do this. It is the counterweight to
 * self-service joining: whoever is accountable for the meeting decides who is
 * in the room.
 */
export async function removeSupportingSales(missionId: string, userId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { success: false, error: "Hanya sales utama yang bisa mengeluarkan anggota." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("assignments")
    .delete()
    .eq("mission_id", missionId)
    .eq("company_id", access.companyId)
    .eq("user_id", userId)
    .eq("assignment_role", "SUPPORTING")

  if (error) return { success: false, error: "Gagal mengeluarkan anggota." }

  revalidatePath(`/workspace/missions/${missionId}`)
  return { success: true }
}

/**
 * Recompute the mission's status from its assignments and write it back.
 *
 * Status is always derived, never set by hand, so a mission cannot claim to be
 * accepted while the primary has not answered.
 */
async function syncMissionStatus(
  schema: ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>,
  companyId: string,
  missionId: string,
  changedBy: string,
  reason: string
): Promise<MissionStatus | null> {
  const { data: mission } = await schema
    .from("missions")
    .select("status")
    .eq("id", missionId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!mission) return null

  const { data: rows } = await schema
    .from("assignments")
    .select("assignment_role, response")
    .eq("company_id", companyId)
    .eq("mission_id", missionId)

  const next = deriveMissionStatus(
    mission.status as MissionStatus,
    (rows ?? []).map((row) => ({
      role: row.assignment_role as "PRIMARY" | "SUPPORTING",
      response: row.response as AssignmentResponse,
    }))
  )

  if (next === mission.status) return next

  await schema
    .from("missions")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("company_id", companyId)

  await schema.from("status_history").insert({
    mission_id: missionId,
    company_id: companyId,
    from_status: mission.status,
    to_status: next,
    changed_by: changedBy,
    reason,
  })

  return next
}

/** Accept or decline your own assignment. */
export async function respondToAssignment(
  missionId: string,
  response: "ACCEPTED" | "REJECTED",
  note?: string
): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const role = await getMissionRole(access, missionId)
  if (!role) return { success: false, error: "Anda tidak ditugaskan pada mission ini." }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const { data: mission } = await schema
    .from("missions")
    .select("status")
    .eq("id", missionId)
    .eq("company_id", access.companyId)
    .maybeSingle()

  if (!mission) return { success: false, error: "Mission tidak ditemukan." }
  if (!canRespond(mission.status as MissionStatus)) {
    return { success: false, error: "Mission ini sudah tidak menerima jawaban." }
  }

  const { error } = await schema
    .from("assignments")
    .update({
      response,
      response_note: note?.trim() || null,
      responded_at: new Date().toISOString(),
    })
    .eq("mission_id", missionId)
    .eq("company_id", access.companyId)
    .eq("user_id", access.userId)

  if (error) return { success: false, error: "Jawaban gagal disimpan." }

  await syncMissionStatus(
    schema,
    access.companyId,
    missionId,
    access.userId,
    `${access.displayName} ${response === "ACCEPTED" ? "menerima" : "menolak"} penugasan`
  )

  const [team, missionDetail] = await Promise.all([
    listMissionTeam(access, missionId),
    getMission(access, missionId),
  ])
  await notify(
    access,
    response === "ACCEPTED" ? "ASSIGNMENT_ACCEPTED" : "ASSIGNMENT_REJECTED",
    team.map((member) => member.userId),
    { missionId, clientName: missionDetail?.clientCompanyName ?? "Mission" }
  )

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/**
 * Propose a different time.
 *
 * Sales cannot move an accepted schedule themselves — the client agreed to a
 * time. They propose, an admin or the primary decides.
 */
export async function requestReschedule(missionId: string, input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const role = await getMissionRole(access, missionId)
  if (!role) return { success: false, error: "Anda tidak ditugaskan pada mission ini." }

  const parsed = rescheduleRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Permintaan tidak valid." }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const { error } = await schema.from("reschedule_requests").insert({
    mission_id: missionId,
    company_id: access.companyId,
    requested_by: access.userId,
    proposed_start: toMissionTimestamp(parsed.data.date, parsed.data.startTime),
    proposed_end: parsed.data.endTime ? toMissionTimestamp(parsed.data.date, parsed.data.endTime) : null,
    reason: parsed.data.reason.trim(),
  })

  if (error) {
    // The partial unique index rejects a second open request on the same
    // mission: the admin should decide on a schedule, not between proposals.
    return {
      success: false,
      error: error.code === "23505"
        ? "Sudah ada permintaan jadwal ulang yang menunggu keputusan untuk mission ini."
        : "Permintaan gagal dikirim.",
    }
  }

  await schema
    .from("assignments")
    .update({ response: "RESCHEDULE_REQUESTED", responded_at: new Date().toISOString() })
    .eq("mission_id", missionId)
    .eq("company_id", access.companyId)
    .eq("user_id", access.userId)

  await syncMissionStatus(
    schema,
    access.companyId,
    missionId,
    access.userId,
    `${access.displayName} meminta jadwal ulang`
  )

  const [rescheduleTeam, rescheduleMission] = await Promise.all([
    listMissionTeam(access, missionId),
    getMission(access, missionId),
  ])
  await notify(
    access,
    "RESCHEDULE_REQUESTED",
    rescheduleTeam.map((member) => member.userId),
    { missionId, clientName: rescheduleMission?.clientCompanyName ?? "Mission" }
  )

  revalidatePath("/workspace/missions")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/**
 * Approve or reject an open reschedule request.
 *
 * Approval moves the mission's schedule and resets everyone's answer: agreeing
 * to Tuesday 09:30 is not agreeing to Thursday 14:00. The requester keeps their
 * acceptance since they proposed this exact time.
 */
export async function decideReschedule(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const { data: request } = await schema
    .from("reschedule_requests")
    .select("id, mission_id, requested_by, proposed_start, proposed_end, status")
    .eq("id", requestId)
    .eq("company_id", access.companyId)
    .maybeSingle()

  if (!request) return { success: false, error: "Permintaan tidak ditemukan." }
  if (request.status !== "PENDING") return { success: false, error: "Permintaan ini sudah diputuskan." }

  const missionId = request.mission_id as string
  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { success: false, error: "Hanya sales utama atau admin yang bisa memutuskan permintaan ini." }
  }

  const { data: assignmentRows } = await schema
    .from("assignments")
    .select("user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)

  const assignments = (assignmentRows ?? []).map((row) => ({
    userId: row.user_id as string,
    role: row.assignment_role as "PRIMARY" | "SUPPORTING",
    response: row.response as AssignmentResponse,
  }))

  const now = new Date().toISOString()

  const { error: decisionError } = await schema
    .from("reschedule_requests")
    .update({ status: decision, decided_by: access.userId, decided_at: now, decision_note: note?.trim() || null })
    .eq("id", requestId)

  if (decisionError) return { success: false, error: "Keputusan gagal disimpan." }

  // Whether the others are re-asked or simply carried over to the new time
  // depends on the tenant's confirmation policy.
  const settings = await getMissionSettings(access)
  const outcome =
    decision === "APPROVED"
      ? applyRescheduleApproval(assignments, request.requested_by as string, settings)
      : applyRescheduleRejection(assignments, settings)

  if (decision === "APPROVED") {
    await schema
      .from("missions")
      .update({
        scheduled_start: request.proposed_start,
        scheduled_end: request.proposed_end,
        updated_at: now,
      })
      .eq("id", missionId)
      .eq("company_id", access.companyId)
  }

  for (const item of outcome.responses) {
    await schema
      .from("assignments")
      .update({ response: item.response, responded_at: now })
      .eq("mission_id", missionId)
      .eq("company_id", access.companyId)
      .eq("user_id", item.userId)
  }

  await syncMissionStatus(
    schema,
    access.companyId,
    missionId,
    access.userId,
    decision === "APPROVED" ? "Permintaan jadwal ulang disetujui" : "Permintaan jadwal ulang ditolak"
  )

  const decisionMission = await getMission(access, missionId)
  await notify(
    access,
    decision === "APPROVED" ? "RESCHEDULE_APPROVED" : "RESCHEDULE_REJECTED",
    assignments.map((item) => item.userId),
    { missionId, clientName: decisionMission?.clientCompanyName ?? "Mission" }
  )

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/** Open or close a mission to further joiners. Primary's call. */
export async function setMissionAllowJoin(missionId: string, allowJoin: boolean): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_mission", "update"))) return NO_MISSION_WRITE

  const role = await getMissionRole(access, missionId)
  if (role !== "PRIMARY" && !access.isSuperAdmin) {
    return { success: false, error: "Hanya sales utama yang bisa mengubah pengaturan ini." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .update({ allow_join: allowJoin, updated_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("company_id", access.companyId)

  if (error) return { success: false, error: "Gagal menyimpan pengaturan." }

  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}
