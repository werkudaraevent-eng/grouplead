import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { listProspectStatuses } from "./prospect-status-queries"
import { wonStatus, type DisplayState, type ProspectStatus, type StatusColor, type StatusKind } from "./prospect-status"
import type { Channel, Outcome, ProspectAttempt, ProspectDetail, ProspectListItem } from "./prospect-schema"

export const PROSPECT_COLUMNS =
  "id, status_id, owner_id, client_company_name, client_company_id, industry, location, address, website, contact_salutation, contact_name, contact_job_title, contact_division, contact_phone, contact_phone_norm, contact_email, notes, source, import_batch_id, next_contact_at, last_contacted_at, attempt_count, lost_reason, mission_id, converted_at, created_by, created_at"

type ProspectRow = Record<string, unknown> & { id: string }

async function profiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", unique)
  return new Map(
    (data ?? [])
      .filter((row): row is { id: string; full_name: string; avatar_url: string | null } => Boolean(row.full_name))
      .map((row) => [row.id, { name: row.full_name, avatarUrl: row.avatar_url?.trim() || null }])
  )
}

/**
 * What a converted prospect shows: its mission's fate. The list RPC computes
 * the same thing in SQL for filtering; this is the read side for the rows.
 */
async function missionStates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  access: SalesMissionAccess,
  missionIds: string[]
): Promise<Map<string, { state: DisplayState; status: string; scheduledStart: string | null }>> {
  const unique = [...new Set(missionIds.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const schema = supabase.schema("sales_mission")
  const [missions, reports, moves] = await Promise.all([
    schema.from("missions").select("id, status, scheduled_start").eq("company_id", access.companyId).is("deleted_at", null).in("id", unique),
    schema.from("visit_reports").select("mission_id, status").eq("company_id", access.companyId).in("mission_id", unique),
    schema.from("audit_log").select("mission_id").eq("company_id", access.companyId).eq("table_name", "missions").eq("action", "UPDATE").in("mission_id", unique).not("changes->scheduled_start", "is", null),
  ])
  const submitted = new Set((reports.data ?? []).filter((row) => row.status === "SUBMITTED").map((row) => row.mission_id as string))
  const moved = new Set((moves.data ?? []).map((row) => row.mission_id as string))
  const result = new Map<string, { state: DisplayState; status: string; scheduledStart: string | null }>()
  for (const row of missions.data ?? []) {
    const id = row.id as string
    const status = row.status as string
    const state: DisplayState =
      status === "CANCELLED" ? "mission_cancelled"
      : status === "COMPLETED" || submitted.has(id) ? "completed"
      : moved.has(id) ? "rescheduled"
      : "stored"
    result.set(id, { state, status, scheduledStart: (row.scheduled_start as string | null) ?? null })
  }
  return result
}

export async function hydrateProspects(access: SalesMissionAccess, rows: ProspectRow[], statuses?: ProspectStatus[]): Promise<ProspectListItem[]> {
  if (rows.length === 0) return []
  const supabase = await createClient()
  const [statusList, people, states] = await Promise.all([
    statuses ? Promise.resolve(statuses) : listProspectStatuses(access, { includeArchived: true }),
    profiles(supabase, rows.map((row) => row.owner_id as string)),
    missionStates(supabase, access, rows.map((row) => row.mission_id as string)),
  ])
  const byId = new Map(statusList.map((status) => [status.id, status]))

  return rows.map((row) => {
    const status = byId.get(row.status_id as string)
    const owner = row.owner_id ? people.get(row.owner_id as string) : undefined
    const missionId = (row.mission_id as string | null) ?? null
    const mission = missionId ? states.get(missionId) : undefined
    return {
      id: row.id,
      statusId: row.status_id as string,
      statusLabel: status?.label ?? "—",
      statusKind: (status?.kind ?? "open") as StatusKind,
      statusColor: (status?.color ?? "neutral") as StatusColor,
      displayState: mission?.state ?? "stored",
      ownerId: (row.owner_id as string | null) ?? null,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: owner?.avatarUrl ?? null,
      clientCompanyName: row.client_company_name as string,
      clientCompanyId: (row.client_company_id as string | null) ?? null,
      industry: (row.industry as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      website: (row.website as string | null) ?? null,
      contactSalutation: (row.contact_salutation as string | null) ?? null,
      contactName: (row.contact_name as string | null) ?? null,
      contactJobTitle: (row.contact_job_title as string | null) ?? null,
      contactDivision: (row.contact_division as string | null) ?? null,
      contactPhone: (row.contact_phone as string | null) ?? null,
      contactEmail: (row.contact_email as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      source: (row.source as "manual" | "import") ?? "manual",
      importBatchId: (row.import_batch_id as string | null) ?? null,
      nextContactAt: (row.next_contact_at as string | null) ?? null,
      lastContactedAt: (row.last_contacted_at as string | null) ?? null,
      attemptCount: Number(row.attempt_count ?? 0),
      lostReason: (row.lost_reason as string | null) ?? null,
      missionId,
      convertedAt: (row.converted_at as string | null) ?? null,
      createdBy: (row.created_by as string | null) ?? null,
      createdAt: row.created_at as string,
    }
  })
}

/** The given prospects, in the given order. For a page of ids. */
export async function listProspectsByIds(access: SalesMissionAccess, ids: string[]): Promise<ProspectListItem[]> {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select(PROSPECT_COLUMNS)
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .in("id", ids)
  const rows = (data ?? []) as ProspectRow[]
  const order = new Map(ids.map((id, index) => [id, index]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return hydrateProspects(access, rows)
}

export async function listProspectAttempts(access: SalesMissionAccess, prospectId: string): Promise<ProspectAttempt[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospect_attempts")
    .select("id, channel, outcome, note, attempted_at, status_id_after, created_by")
    .eq("company_id", access.companyId)
    .eq("prospect_id", prospectId)
    .order("attempted_at", { ascending: false })
    .limit(200)
  const rows = data ?? []
  const [people, statuses] = await Promise.all([
    profiles(supabase, rows.map((row) => row.created_by as string)),
    listProspectStatuses(access, { includeArchived: true }),
  ])
  const labels = new Map(statuses.map((status) => [status.id, status.label]))
  return rows.map((row) => ({
    id: row.id as string,
    channel: row.channel as Channel,
    outcome: row.outcome as Outcome,
    note: (row.note as string | null) ?? null,
    attemptedAt: row.attempted_at as string,
    statusAfterLabel: row.status_id_after ? (labels.get(row.status_id_after as string) ?? null) : null,
    createdByName: row.created_by ? (people.get(row.created_by as string)?.name ?? null) : null,
  }))
}

export async function getProspect(access: SalesMissionAccess, prospectId: string): Promise<ProspectDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select(PROSPECT_COLUMNS)
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .eq("id", prospectId)
    .maybeSingle()
  if (error) console.error("[getProspect]", prospectId, error.code, error.message)
  if (error || !data) return null

  const [items, attempts] = await Promise.all([hydrateProspects(access, [data as ProspectRow]), listProspectAttempts(access, prospectId)])
  const item = items[0]
  if (!item) return null

  const schema = supabase.schema("sales_mission")
  const [batch, creator, mission] = await Promise.all([
    item.importBatchId
      ? schema.from("prospect_import_batches").select("file_name").eq("id", item.importBatchId).maybeSingle()
      : Promise.resolve({ data: null }),
    profiles(supabase, item.createdBy ? [item.createdBy] : []),
    item.missionId
      ? schema.from("missions").select("id, status, scheduled_start").eq("id", item.missionId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...item,
    attempts,
    batchFileName: (batch.data?.file_name as string | undefined) ?? null,
    createdByName: item.createdBy ? (creator.get(item.createdBy)?.name ?? null) : null,
    mission: mission.data
      ? { id: mission.data.id as string, status: mission.data.status as string, scheduledStart: (mission.data.scheduled_start as string | null) ?? null }
      : null,
  }
}

/** The prospect a mission was made from, if any. */
export async function getProspectByMission(access: SalesMissionAccess, missionId: string): Promise<ProspectListItem | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select(PROSPECT_COLUMNS)
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .eq("mission_id", missionId)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return (await hydrateProspects(access, [data as ProspectRow]))[0] ?? null
}

/** The viewer's prospects whose contact date has arrived, for Hari ini. */
export async function listDueProspects(access: SalesMissionAccess, options: { today: string; limit?: number; anyOwner?: boolean }): Promise<ProspectListItem[]> {
  const supabase = await createClient()
  let query = supabase
    .schema("sales_mission")
    .from("prospects")
    .select(PROSPECT_COLUMNS)
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .is("mission_id", null)
    .not("next_contact_at", "is", null)
    .lte("next_contact_at", options.today)
    .order("next_contact_at", { ascending: true })
    .limit(options.limit ?? 8)
  if (!options.anyOwner) query = query.eq("owner_id", access.userId)
  const { data } = await query
  const items = await hydrateProspects(access, (data ?? []) as ProspectRow[])
  return items.filter((item) => item.statusKind === "open" || item.statusKind === "in_progress")
}

export interface ImportBatchOption {
  id: string
  fileName: string
  rowCount: number
  createdAt: string
  createdByName: string | null
}

export async function listImportBatches(access: SalesMissionAccess): Promise<ImportBatchOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospect_import_batches")
    .select("id, file_name, row_count, created_at, created_by")
    .eq("company_id", access.companyId)
    .order("created_at", { ascending: false })
    .limit(50)
  const rows = data ?? []
  const people = await profiles(supabase, rows.map((row) => row.created_by as string))
  return rows.map((row) => ({
    id: row.id as string,
    fileName: row.file_name as string,
    rowCount: Number(row.row_count ?? 0),
    createdAt: row.created_at as string,
    createdByName: row.created_by ? (people.get(row.created_by as string)?.name ?? null) : null,
  }))
}

/**
 * Mark a prospect as converted: won status, the mission it became, when.
 * Called after the mission exists; a failure here is reported, not fatal,
 * because the mission is the thing that matters.
 */
export async function convertProspect(access: SalesMissionAccess, prospectId: string, missionId: string): Promise<{ ok: boolean; error?: string }> {
  const statuses = await listProspectStatuses(access)
  const won = wonStatus(statuses)
  if (!won) return { ok: false, error: "Tidak ada status janji temu berhasil yang aktif." }
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .update({ status_id: won.id, mission_id: missionId, converted_at: now, next_contact_at: null, updated_at: now })
    .eq("company_id", access.companyId)
    .eq("id", prospectId)
    .is("mission_id", null)
  return error ? { ok: false, error: error.message } : { ok: true }
}
