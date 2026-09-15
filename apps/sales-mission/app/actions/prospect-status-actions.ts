"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess, isSettingsAdmin } from "@/lib/sales-mission-access"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { ADDABLE_KINDS, STATUS_COLORS, STATUS_KINDS, archiveViolation, nextStatusOrder, reorderStatus, toStatusCode } from "@/lib/prospects/prospect-status"
import type { ActionResult } from "@/types/action-result"

/**
 * The admin's side of prospect statuses: label, colour and order are theirs;
 * the kind is fixed at creation because the code acts on it. Archive, never
 * delete: a status in use stays readable on the prospects that carry it.
 */

const PATHS = ["/workspace/settings/prospect-statuses", "/workspace/prospects", "/workspace"]

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }
  if (!(await isSettingsAdmin(access))) {
    return { error: "Hanya admin Sales Mission yang bisa mengatur status prospek." as const }
  }
  return { access }
}

const createSchema = z.object({
  label: z.string().trim().min(1, "Nama status wajib diisi").max(60),
  kind: z.enum(STATUS_KINDS),
  color: z.enum(STATUS_COLORS),
})

const updateSchema = z.object({
  label: z.string().trim().min(1, "Nama status wajib diisi").max(60),
  color: z.enum(STATUS_COLORS),
})

export async function createProspectStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Status tidak valid." }
  if (!ADDABLE_KINDS.includes(parsed.data.kind)) {
    return { success: false, error: "Status awal dan status janji temu berhasil masing-masing hanya satu. Ubah namanya saja." }
  }
  const { access } = guard
  const statuses = await listProspectStatuses(access, { includeArchived: true })
  if (statuses.some((status) => status.label.toLowerCase() === parsed.data.label.toLowerCase() && status.isActive)) {
    return { success: false, error: "Sudah ada status dengan nama itu." }
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospect_statuses")
    .insert({
      company_id: access.companyId,
      code: toStatusCode(parsed.data.label, statuses.map((status) => status.code)),
      label: parsed.data.label,
      kind: parsed.data.kind,
      color: parsed.data.color,
      display_order: nextStatusOrder(statuses),
      created_by: access.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: "Status gagal dibuat." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true, data: { id: data.id as string } }
}

export async function updateProspectStatus(statusId: string, input: unknown): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Status tidak valid." }
  const { access } = guard
  const statuses = await listProspectStatuses(access, { includeArchived: true })
  if (statuses.some((status) => status.id !== statusId && status.isActive && status.label.toLowerCase() === parsed.data.label.toLowerCase())) {
    return { success: false, error: "Sudah ada status dengan nama itu." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("prospect_statuses")
    .update({ label: parsed.data.label, color: parsed.data.color, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", statusId)
  if (error) return { success: false, error: "Status gagal disimpan." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}

export async function archiveProspectStatus(statusId: string): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const statuses = await listProspectStatuses(access, { includeArchived: true })
  const violation = archiveViolation(statuses, statusId)
  if (violation) return { success: false, error: violation }
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("prospect_statuses")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", statusId)
  if (error) return { success: false, error: "Status gagal diarsipkan." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}

export async function restoreProspectStatus(statusId: string): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("prospect_statuses")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", statusId)
  if (error) return { success: false, error: "Status gagal dipulihkan." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}

export async function moveProspectStatus(statusId: string, direction: "up" | "down"): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const statuses = await listProspectStatuses(access, { includeArchived: true })
  const next = reorderStatus(statuses, statusId, direction)
  const changed = next.filter((status) => statuses.find((item) => item.id === status.id)?.displayOrder !== status.displayOrder)
  if (changed.length === 0) return { success: true }
  const supabase = await createClient()
  await Promise.all(
    changed.map((status) =>
      supabase.schema("sales_mission").from("prospect_statuses").update({ display_order: status.displayOrder }).eq("company_id", access.companyId).eq("id", status.id)
    )
  )
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}
