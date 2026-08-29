"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { createMissionSchema, toMissionTimestamp } from "@/lib/missions/mission-schema"
import type { ActionResult } from "@/types/action-result"

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
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data mission tidak valid." }
  }

  const input = parsed.data
  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")

  // Never trust user ids from the client. An assignee must be a member of this
  // tenant, or a crafted request could assign missions to anyone in the shared
  // database.
  const assigneeIds = [input.primarySalesId, ...input.supportingSalesIds]
  const { data: members, error: memberError } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", access.companyId)
    .in("user_id", assigneeIds)

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
      status: "ASSIGNED",
      objective: input.objective || null,
      location: input.location || null,
      scheduled_start: toMissionTimestamp(input.date, input.startTime),
      scheduled_end: input.endTime ? toMissionTimestamp(input.date, input.endTime) : null,
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
    },
    ...input.supportingSalesIds.map((userId) => ({
      mission_id: mission.id,
      company_id: access.companyId,
      user_id: userId,
      assignment_role: "SUPPORTING",
    })),
  ])

  if (assignmentError) {
    // PostgREST cannot span these inserts in one transaction. A mission with no
    // primary sales is a broken state, so undo rather than leave it behind.
    // Move both inserts into a Postgres function when this grows further.
    await missions.from("missions").delete().eq("id", mission.id)
    return { success: false, error: "Penugasan sales gagal disimpan. Mission dibatalkan." }
  }

  // Best-effort audit trail: losing a history row must not fail a saved mission.
  await missions.from("status_history").insert({
    mission_id: mission.id,
    company_id: access.companyId,
    to_status: "ASSIGNED",
    changed_by: access.userId,
    reason: "Mission dibuat",
  })

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")

  return { success: true, data: { id: mission.id } }
}
