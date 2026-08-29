"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionRole, getMissionSettings, listMissions } from "@/lib/missions/mission-queries"
import { annotateJoinStatus, canJoin, joinBlockedReason } from "@/lib/missions/mission-join"
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
 * Join a mission as supporting sales.
 *
 * The eligibility check is repeated here rather than trusted from the button: a
 * Server Action is reachable directly, and the client's view of the calendar
 * may be seconds out of date.
 */
export async function joinMission(missionId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

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

  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath(`/workspace/missions/${missionId}`)

  return { success: true }
}

/** Leave a mission you joined. The primary cannot leave their own mission. */
export async function leaveMission(missionId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

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

/** Open or close a mission to further joiners. Primary's call. */
export async function setMissionAllowJoin(missionId: string, allowJoin: boolean): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

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
