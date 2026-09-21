import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { listReportChoices } from "./report-choice-queries"
import { kindOf } from "./report-choices"
import { notify } from "@/lib/notifications/notification-queries"

/**
 * Keep the report's follow-up in step with the report.
 *
 * The report is where the next action is first written, so sending or
 * editing it opens, updates or calls off the follow-up it implies. Only the
 * first link of the chain is the report's to move: once someone closed it
 * and opened the next, the history stands, however the report is edited.
 */
export async function syncReportFollowUp(
  access: SalesMissionAccess,
  input: {
    missionId: string
    reportId: string
    nextActionType: string
    ownerId: string | null
    dueDate: string | null
    clientName: string
  }
): Promise<void> {
  const supabase = await createClient()
  const table = supabase.schema("sales_mission").from("follow_ups")
  const choices = await listReportChoices(access)
  const wanted = kindOf(choices, "next_action_type", input.nextActionType) !== "none"
  const now = new Date().toISOString()

  const { data: roots } = await table
    .select("id, status, owner_id")
    .eq("company_id", access.companyId)
    .eq("report_id", input.reportId)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
  const root = (roots ?? [])[0] as { id: string; status: string; owner_id: string | null } | undefined

  if (!wanted) {
    if (root?.status === "OPEN") {
      await table.update({ status: "CANCELLED", note: "Next action dihapus dari laporan", closed_at: now, closed_by: access.userId, updated_at: now }).eq("id", root.id)
    }
    return
  }

  if (!root) {
    const { error } = await table.insert({
      company_id: access.companyId,
      mission_id: input.missionId,
      report_id: input.reportId,
      action_type: input.nextActionType,
      owner_id: input.ownerId,
      due_date: input.dueDate,
      created_by: access.userId,
    })
    if (!error && input.ownerId && input.ownerId !== access.userId) {
      await notify(access, "FOLLOW_UP_ASSIGNED", [input.ownerId], { missionId: input.missionId, clientName: input.clientName })
    }
    return
  }

  if (root.status === "OPEN") {
    await table.update({ action_type: input.nextActionType, owner_id: input.ownerId, due_date: input.dueDate, updated_at: now }).eq("id", root.id)
    if (input.ownerId && input.ownerId !== root.owner_id && input.ownerId !== access.userId) {
      await notify(access, "FOLLOW_UP_ASSIGNED", [input.ownerId], { missionId: input.missionId, clientName: input.clientName })
    }
  }
}

/** A withdrawn report takes its open follow-ups with it; the closed ones stay as history. */
export async function cancelReportFollowUps(access: SalesMissionAccess, reportId: string, reason: string): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  await supabase
    .schema("sales_mission")
    .from("follow_ups")
    .update({ status: "CANCELLED", note: reason, closed_at: now, closed_by: access.userId, updated_at: now })
    .eq("company_id", access.companyId)
    .eq("report_id", reportId)
    .eq("status", "OPEN")
}
