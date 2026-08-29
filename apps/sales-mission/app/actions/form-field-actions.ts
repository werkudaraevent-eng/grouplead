"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import {
  describeCoreFieldViolation,
  fieldDefinitionSchema,
  isChoiceType,
  nextDisplayOrder,
  reorderField,
  toReportingKey,
  type FieldType,
} from "@/lib/missions/form-fields"
import type { ActionResult } from "@/types/action-result"

/**
 * Form builder writes.
 *
 * Every rule the settings screen shows is re-applied here. The screen hides the
 * delete button on a core field; this makes deleting one impossible.
 */

const FORM_KEY = "mission" as const

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { error: "Anda tidak punya izin mengubah form mission." as const }
  }

  return { access }
}

/** Add a field. The reporting key is derived once here and then frozen. */
export async function createFormField(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const parsed = fieldDefinitionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Definisi field tidak valid." }
  }

  const existing = await listFormFields(access, FORM_KEY, { includeArchived: true })

  // Keys must be unique per form. A collision means the admin is re-adding a
  // name that already exists, including an archived one — reusing the key would
  // silently merge old answers into the new field.
  const baseKey = toReportingKey(parsed.data.label)
  const taken = new Set(existing.map((field) => field.reportingKey))
  let reportingKey = baseKey
  let suffix = 2
  while (taken.has(reportingKey)) {
    reportingKey = `${baseKey}_${suffix}`
    suffix += 1
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("form_fields")
    .insert({
      company_id: access.companyId,
      form_key: FORM_KEY,
      reporting_key: reportingKey,
      label: parsed.data.label,
      field_type: parsed.data.fieldType,
      is_required: parsed.data.isRequired,
      is_core: false,
      placeholder: parsed.data.placeholder?.trim() || null,
      help_text: parsed.data.helpText?.trim() || null,
      options: isChoiceType(parsed.data.fieldType) ? parsed.data.options : [],
      display_order: nextDisplayOrder(existing),
      created_by: access.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { success: false, error: "Field gagal ditambahkan." }

  revalidatePath("/workspace/settings/form")
  revalidatePath("/workspace/missions/new")

  return { success: true, data: { id: data.id as string } }
}

/** Edit a field. Core fields accept cosmetic changes and tightening only. */
export async function updateFormField(fieldId: string, input: unknown): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const parsed = fieldDefinitionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Definisi field tidak valid." }
  }

  const fields = await listFormFields(access, FORM_KEY, { includeArchived: true })
  const field = fields.find((item) => item.id === fieldId)
  if (!field) return { success: false, error: "Field tidak ditemukan." }

  const violation = describeCoreFieldViolation(field, {
    isRequired: parsed.data.isRequired,
    fieldType: parsed.data.fieldType as FieldType,
  })
  if (violation) return { success: false, error: violation }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("form_fields")
    .update({
      label: parsed.data.label,
      // A core field's type is fixed; the guard above already refused a change,
      // so writing the original value keeps the update harmless either way.
      field_type: field.isCore ? field.fieldType : parsed.data.fieldType,
      is_required: parsed.data.isRequired,
      placeholder: parsed.data.placeholder?.trim() || null,
      help_text: parsed.data.helpText?.trim() || null,
      options: field.isCore
        ? field.options
        : isChoiceType(parsed.data.fieldType)
          ? parsed.data.options
          : [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", fieldId)
    .eq("company_id", access.companyId)

  if (error) return { success: false, error: "Field gagal disimpan." }

  revalidatePath("/workspace/settings/form")
  revalidatePath("/workspace/missions/new")

  return { success: true }
}

/**
 * Remove a field from the form.
 *
 * Archives rather than deletes, so answers already captured stay readable. The
 * foreign key on `mission_field_values` enforces the same thing at the database
 * level for anyone writing SQL by hand.
 */
export async function archiveFormField(fieldId: string): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const fields = await listFormFields(access, FORM_KEY, { includeArchived: true })
  const field = fields.find((item) => item.id === fieldId)
  if (!field) return { success: false, error: "Field tidak ditemukan." }

  const violation = describeCoreFieldViolation(field, { archive: true })
  if (violation) return { success: false, error: violation }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("form_fields")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", fieldId)
    .eq("company_id", access.companyId)

  if (error) return { success: false, error: "Field gagal dihapus." }

  revalidatePath("/workspace/settings/form")
  revalidatePath("/workspace/missions/new")

  return { success: true }
}

/** Bring an archived field back. Its old answers reconnect by field id. */
export async function restoreFormField(fieldId: string): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("form_fields")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", fieldId)
    .eq("company_id", guard.access.companyId)

  if (error) return { success: false, error: "Field gagal dikembalikan." }

  revalidatePath("/workspace/settings/form")
  revalidatePath("/workspace/missions/new")

  return { success: true }
}

/** Move a field up or down. Ordering applies to core fields too. */
export async function moveFormField(fieldId: string, direction: "up" | "down"): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const fields = await listFormFields(access, FORM_KEY)
  const updates = reorderField(fields, fieldId, direction)
  if (updates.length === 0) return { success: true }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  for (const update of updates) {
    await schema
      .from("form_fields")
      .update({ display_order: update.displayOrder })
      .eq("id", update.id)
      .eq("company_id", access.companyId)
  }

  revalidatePath("/workspace/settings/form")
  revalidatePath("/workspace/missions/new")

  return { success: true }
}
