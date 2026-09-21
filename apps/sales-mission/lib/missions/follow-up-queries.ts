import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { kindOf, labelOf, type ChoiceSet } from "./report-choices"
import { sortFollowUps, type FollowUp, type FollowUpStatus } from "./follow-ups"

/**
 * Reads for follow-ups. Every query goes through the person's own session,
 * so RLS keeps the unit's rows to the unit; the company filter is stated
 * anyway, as everywhere else.
 */

const COLUMNS = "id, mission_id, report_id, parent_id, action_type, owner_id, due_date, status, channel, outcome, note, closed_at, closed_by, created_by, created_at"

type Row = {
  id: string
  mission_id: string
  report_id: string | null
  parent_id: string | null
  action_type: string
  owner_id: string | null
  due_date: string | null
  status: FollowUpStatus
  channel: string | null
  outcome: string | null
  note: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
}

async function names(supabase: Awaited<ReturnType<typeof createClient>>, ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique)
  return new Map((data ?? []).filter((row) => row.full_name).map((row) => [row.id as string, row.full_name as string]))
}

function toFollowUp(row: Row, people: Map<string, string>, choices: ChoiceSet | null): FollowUp {
  return {
    id: row.id,
    missionId: row.mission_id,
    reportId: row.report_id,
    parentId: row.parent_id,
    actionType: row.action_type,
    actionLabel: labelOf(choices, "next_action_type", row.action_type),
    ownerId: row.owner_id,
    ownerName: row.owner_id ? (people.get(row.owner_id) ?? null) : null,
    dueDate: row.due_date,
    status: row.status,
    channel: row.channel,
    channelLabel: row.channel ? labelOf(choices, "follow_up_channel", row.channel) : null,
    outcome: row.outcome,
    outcomeLabel: row.outcome ? labelOf(choices, "follow_up_outcome", row.outcome) : null,
    outcomeKind: row.outcome ? kindOf(choices, "follow_up_outcome", row.outcome) : null,
    note: row.note,
    closedAt: row.closed_at,
    closedByName: row.closed_by ? (people.get(row.closed_by) ?? null) : null,
    createdAt: row.created_at,
    createdByName: row.created_by ? (people.get(row.created_by) ?? null) : null,
  }
}

/** Every follow-up of one visit, oldest first, so the chain reads as a timeline. */
export async function listMissionFollowUps(access: SalesMissionAccess, missionId: string, choices: ChoiceSet | null): Promise<FollowUp[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("follow_ups")
    .select(COLUMNS)
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true })
  const rows = (data ?? []) as Row[]
  const people = await names(supabase, rows.flatMap((row) => [row.owner_id, row.closed_by, row.created_by]))
  return sortFollowUps(rows.map((row) => toFollowUp(row, people, choices)))
}

export interface DueFollowUp extends FollowUp {
  clientCompanyName: string
}

/**
 * The viewer's open follow-ups that need them today: due today or earlier
 * first, then the ones with no day, which would otherwise never surface.
 */
export async function listMyDueFollowUps(
  access: SalesMissionAccess,
  { today, limit = 8, choices }: { today: string; limit?: number; choices: ChoiceSet | null }
): Promise<DueFollowUp[]> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data } = await schema
    .from("follow_ups")
    .select(COLUMNS)
    .eq("company_id", access.companyId)
    .eq("owner_id", access.userId)
    .eq("status", "OPEN")
    .or(`due_date.lte.${today},due_date.is.null`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit)
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return []
  const [{ data: missions }, people] = await Promise.all([
    schema
      .from("missions")
      .select("id, client_company_name_snapshot")
      .eq("company_id", access.companyId)
      .in("id", [...new Set(rows.map((row) => row.mission_id))]),
    names(supabase, rows.flatMap((row) => [row.owner_id, row.closed_by, row.created_by])),
  ])
  const clientOf = new Map((missions ?? []).map((row) => [row.id as string, (row.client_company_name_snapshot as string) ?? "—"]))
  return rows.map((row) => ({ ...toFollowUp(row, people, choices), clientCompanyName: clientOf.get(row.mission_id) ?? "—" }))
}

export interface FollowUpSummary {
  status: FollowUpStatus
  dueDate: string | null
  ownerName: string | null
  actionLabel: string
  outcomeLabel: string | null
  closedAt: string | null
  /** How many follow-ups the report has spawned so far. */
  count: number
}

/**
 * One line per report for a list: the open follow-up if there is one, else
 * the latest closed, with how many there were. Reports with none are absent.
 */
export async function summarizeFollowUpsByReport(
  access: SalesMissionAccess,
  reportIds: string[],
  choices: ChoiceSet | null
): Promise<Map<string, FollowUpSummary>> {
  const result = new Map<string, FollowUpSummary>()
  if (reportIds.length === 0) return result
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("follow_ups")
    .select(COLUMNS)
    .eq("company_id", access.companyId)
    .in("report_id", reportIds)
    .order("created_at", { ascending: true })
  const rows = (data ?? []) as Row[]
  const people = await names(supabase, rows.map((row) => row.owner_id))
  const byReport = new Map<string, Row[]>()
  for (const row of rows) {
    if (!row.report_id) continue
    const list = byReport.get(row.report_id)
    if (list) list.push(row)
    else byReport.set(row.report_id, [row])
  }
  for (const [reportId, list] of byReport) {
    const current = list.find((row) => row.status === "OPEN") ?? list[list.length - 1]
    const item = toFollowUp(current, people, choices)
    result.set(reportId, {
      status: item.status,
      dueDate: item.dueDate,
      ownerName: item.ownerName,
      actionLabel: item.actionLabel,
      outcomeLabel: item.outcomeLabel,
      closedAt: item.closedAt,
      count: list.length,
    })
  }
  return result
}
