"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission, getMissionRole, getMissionSettings } from "@/lib/missions/mission-queries"
import { resolveMissionGates } from "@/lib/missions/mission-rights"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { choicesFor, kindOf, type ChoiceSet } from "@/lib/missions/report-choices"
import { logFollowUpSchema, newFollowUpSchema, type NewFollowUpInput } from "@/lib/missions/follow-ups"
import type { MissionListItem } from "@/lib/missions/mission-schema"
import { notify } from "@/lib/notifications/notification-queries"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"
import type { ActionResult } from "@/types/action-result"

/**
 * Follow-up writes. Who may act on one: its owner, the report's author (the
 * mission's sales utama), or someone who supervises the report, the same
 * reach an admin has over the report itself. Everyone with read access can
 * see them.
 */
async function authorize(
  missionId: string,
  ownerId: string | null
): Promise<{ access: SalesMissionAccess; mission: MissionListItem; choices: ChoiceSet } | { error: string }> {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_result", "read"))) return { error: NO_ACCESS_MESSAGE }
  const mission = await getMission(access, missionId)
  if (!mission) return { error: "Aktivitas tidak ditemukan." }
  const [role, settings, choices] = await Promise.all([getMissionRole(access, missionId), getMissionSettings(access), listReportChoices(access)])
  if (!settings.followUpEnabled) return { error: "Pelacakan tindak lanjut dimatikan di pengaturan." }
  const gates = await resolveMissionGates(access, mission, role, settings)
  if (!(ownerId === access.userId || gates.isAuthor || gates.supervisesReport)) {
    return { error: "Tindak lanjut ini dipegang orang lain." }
  }
  return { access, mission, choices }
}

function validNext(choices: ChoiceSet, input: NewFollowUpInput): string | null {
  const known = choicesFor(choices, "next_action_type").find((choice) => choice.code === input.actionType)
  if (!known) return "Jenis tindak lanjut tidak dikenal."
  if (kindOf(choices, "next_action_type", input.actionType) === "none") return "Pilih jenis tindak lanjut yang nyata."
  return null
}

function done(missionId: string) {
  revalidatePath(paths.activity(missionId))
  revalidatePath("/workspace")
  revalidatePath(paths.reportList())
}

/** Open a follow-up by hand, when the report's own has been closed or it never had one. */
export async function createFollowUp(missionId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = newFollowUpSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Isian tidak valid." }
  const guard = await authorize(missionId, null)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, mission, choices } = guard
  const invalid = validNext(choices, parsed.data)
  if (invalid) return { success: false, error: invalid }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data: report } = await schema.from("visit_reports").select("id").eq("company_id", access.companyId).eq("mission_id", missionId).maybeSingle()
  const { data, error } = await schema
    .from("follow_ups")
    .insert({
      company_id: access.companyId,
      mission_id: missionId,
      report_id: (report?.id as string | undefined) ?? null,
      action_type: parsed.data.actionType,
      owner_id: parsed.data.ownerId ?? null,
      due_date: parsed.data.dueDate ?? null,
      created_by: access.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: "Tindak lanjut gagal dibuat." }
  if (parsed.data.ownerId && parsed.data.ownerId !== access.userId) {
    await notify(access, "FOLLOW_UP_ASSIGNED", [parsed.data.ownerId], { missionId, clientName: mission.clientCompanyName })
  }
  done(missionId)
  return { success: true, data: { id: data.id as string } }
}

/** Close a follow-up with how it went, and open the next one when there is a next step. */
export async function logFollowUp(followUpId: string, input: unknown): Promise<ActionResult<{ nextId: string | null }>> {
  const parsed = logFollowUpSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Catatan tindak lanjut tidak valid." }

  const supabase = await createClient()
  const table = supabase.schema("sales_mission").from("follow_ups")
  const { data: row } = await table.select("id, company_id, mission_id, report_id, owner_id, status").eq("id", followUpId).maybeSingle()
  if (!row) return { success: false, error: "Tindak lanjut tidak ditemukan." }
  if (row.status !== "OPEN") return { success: false, error: "Tindak lanjut ini sudah ditutup." }

  const guard = await authorize(row.mission_id as string, (row.owner_id as string | null) ?? null)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access, mission, choices } = guard
  if (row.company_id !== access.companyId) return { success: false, error: "Tindak lanjut tidak ditemukan." }
  if (!choicesFor(choices, "follow_up_channel").some((choice) => choice.code === parsed.data.channel)) return { success: false, error: "Cara tindak lanjut tidak dikenal." }
  if (!choicesFor(choices, "follow_up_outcome").some((choice) => choice.code === parsed.data.outcome)) return { success: false, error: "Hasil tindak lanjut tidak dikenal." }
  const next = parsed.data.next ?? null
  if (next) {
    const invalid = validNext(choices, next)
    if (invalid) return { success: false, error: invalid }
  }

  const now = new Date().toISOString()
  const { error } = await table
    .update({
      status: "DONE",
      channel: parsed.data.channel,
      outcome: parsed.data.outcome,
      note: parsed.data.note || null,
      closed_at: parsed.data.doneAt ?? now,
      closed_by: access.userId,
      updated_at: now,
    })
    .eq("id", followUpId)
    .eq("company_id", access.companyId)
  if (error) return { success: false, error: "Catatan tindak lanjut gagal disimpan." }

  let nextId: string | null = null
  if (next) {
    const { data: created, error: nextError } = await table
      .insert({
        company_id: access.companyId,
        mission_id: row.mission_id,
        report_id: row.report_id,
        parent_id: followUpId,
        action_type: next.actionType,
        owner_id: next.ownerId ?? null,
        due_date: next.dueDate ?? null,
        created_by: access.userId,
      })
      .select("id")
      .single()
    if (nextError || !created) return { success: false, error: "Tindak lanjut tercatat, tetapi langkah berikutnya gagal dibuat. Tambahkan lagi dari kartu laporan." }
    nextId = created.id as string
    if (next.ownerId && next.ownerId !== access.userId) {
      await notify(access, "FOLLOW_UP_ASSIGNED", [next.ownerId], { missionId: row.mission_id as string, clientName: mission.clientCompanyName })
    }
  }

  done(row.mission_id as string)
  return { success: true, data: { nextId } }
}

/** Call a follow-up off without doing it; the reason stays on the row. */
export async function cancelFollowUp(followUpId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient()
  const table = supabase.schema("sales_mission").from("follow_ups")
  const { data: row } = await table.select("id, company_id, mission_id, owner_id, status").eq("id", followUpId).maybeSingle()
  if (!row) return { success: false, error: "Tindak lanjut tidak ditemukan." }
  if (row.status !== "OPEN") return { success: false, error: "Tindak lanjut ini sudah ditutup." }
  const guard = await authorize(row.mission_id as string, (row.owner_id as string | null) ?? null)
  if ("error" in guard) return { success: false, error: guard.error }
  const trimmed = note.trim().slice(0, 500)
  const now = new Date().toISOString()
  const { error } = await table
    .update({ status: "CANCELLED", note: trimmed || null, closed_at: now, closed_by: guard.access.userId, updated_at: now })
    .eq("id", followUpId)
    .eq("company_id", guard.access.companyId)
  if (error) return { success: false, error: "Tindak lanjut gagal dibatalkan." }
  done(row.mission_id as string)
  return { success: true }
}
