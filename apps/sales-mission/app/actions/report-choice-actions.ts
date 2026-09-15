"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import {
  CHOICE_FIELDS,
  KINDS_BY_FIELD,
  archiveChoiceViolation,
  nextChoiceOrder,
  reorderChoice,
  toChoiceCode,
  type ChoiceField,
} from "@/lib/missions/report-choices"
import type { ActionResult } from "@/types/action-result"

/**
 * The admin's side of the report's three fixed choices: label and order are
 * theirs, the kind is fixed at creation because the KPI screen, the CRM
 * sync and the lead push act on it. Archive, never delete: a report that
 * stored the code keeps showing its label.
 */

const PATHS = ["/workspace/settings/report-form", "/workspace/missions", "/workspace/reports", "/workspace"]

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }
  if (!(access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update")))) {
    return { error: "Hanya admin Sales Mission yang bisa mengatur pilihan laporan." as const }
  }
  return { access }
}

const createSchema = z.object({
  fieldKey: z.enum(CHOICE_FIELDS),
  label: z.string().trim().min(1, "Nama pilihan wajib diisi").max(80),
  kind: z.string().min(1, "Pilih jenisnya"),
})

const updateSchema = z.object({
  label: z.string().trim().min(1, "Nama pilihan wajib diisi").max(80),
})

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export async function createReportChoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Pilihan tidak valid." }
  const { fieldKey, label, kind } = parsed.data
  if (!KINDS_BY_FIELD[fieldKey].includes(kind)) return { success: false, error: "Jenis itu tidak berlaku untuk field ini." }

  const { access } = guard
  const list = (await listReportChoices(access, { includeArchived: true }))[fieldKey]
  if (list.some((choice) => choice.isActive && sameLabel(choice.label, label))) {
    return { success: false, error: "Sudah ada pilihan dengan nama itu." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("report_choices")
    .insert({
      company_id: access.companyId,
      field_key: fieldKey,
      code: toChoiceCode(label, list.map((choice) => choice.code)),
      label,
      kind,
      display_order: nextChoiceOrder(list),
      created_by: access.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: "Pilihan gagal dibuat." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true, data: { id: data.id as string } }
}

export async function updateReportChoice(choiceId: string, input: unknown): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Pilihan tidak valid." }
  const { access } = guard
  const set = await listReportChoices(access, { includeArchived: true })
  const target = CHOICE_FIELDS.flatMap((field) => set[field]).find((choice) => choice.id === choiceId)
  if (!target) return { success: false, error: "Pilihan tidak ditemukan." }
  if (set[target.fieldKey].some((choice) => choice.id !== choiceId && choice.isActive && sameLabel(choice.label, parsed.data.label))) {
    return { success: false, error: "Sudah ada pilihan dengan nama itu." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("report_choices")
    .update({ label: parsed.data.label, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", choiceId)
  if (error) return { success: false, error: "Pilihan gagal disimpan." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}

async function setActive(choiceId: string, active: boolean): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  if (!active) {
    const set = await listReportChoices(access, { includeArchived: true })
    const field = CHOICE_FIELDS.find((key) => set[key].some((choice) => choice.id === choiceId))
    if (!field) return { success: false, error: "Pilihan tidak ditemukan." }
    const violation = archiveChoiceViolation(set[field], choiceId)
    if (violation) return { success: false, error: violation }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("report_choices")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("company_id", access.companyId)
    .eq("id", choiceId)
  if (error) return { success: false, error: active ? "Pilihan gagal dipulihkan." : "Pilihan gagal diarsipkan." }
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}

export async function archiveReportChoice(choiceId: string): Promise<ActionResult> {
  return setActive(choiceId, false)
}

export async function restoreReportChoice(choiceId: string): Promise<ActionResult> {
  return setActive(choiceId, true)
}

export async function moveReportChoice(choiceId: string, direction: "up" | "down"): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard
  const set = await listReportChoices(access, { includeArchived: true })
  const field = CHOICE_FIELDS.find((key) => set[key].some((choice) => choice.id === choiceId)) as ChoiceField | undefined
  if (!field) return { success: false, error: "Pilihan tidak ditemukan." }
  const next = reorderChoice(set[field], choiceId, direction)
  const changed = next.filter((choice) => set[field].find((item) => item.id === choice.id)?.displayOrder !== choice.displayOrder)
  if (changed.length === 0) return { success: true }
  const supabase = await createClient()
  await Promise.all(
    changed.map((choice) =>
      supabase.schema("sales_mission").from("report_choices").update({ display_order: choice.displayOrder }).eq("company_id", access.companyId).eq("id", choice.id)
    )
  )
  PATHS.forEach((path) => revalidatePath(path))
  return { success: true }
}
