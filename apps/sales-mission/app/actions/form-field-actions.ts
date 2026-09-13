"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import {
  canEditOptions,
  describeCoreFieldViolation,
  describeOptionsViolation,
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

  // A new field is never core, so it always owns its options.
  const optionsViolation = describeOptionsViolation(
    { isCore: false, reportingKey: "", fieldType: parsed.data.fieldType },
    parsed.data.options
  )
  if (optionsViolation) return { success: false, error: optionsViolation }

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

  /*
    Ownership is judged against the type the field is being saved AS, not the
    one it is stored as. Judging by the stored type broke the ordinary case of
    turning a custom text field into a dropdown: the field was still TEXT in the
    database, so it did not "own options", the submitted list was thrown away,
    and the row hit the form_fields_choices_present constraint with a SELECT and
    no choices. The admin got "Field gagal disimpan" with no way to succeed.

    A core field's type cannot move, so its effective type is always the stored
    one; describeCoreFieldViolation refuses the change a line below regardless.
  */
  const effectiveType = field.isCore ? field.fieldType : (parsed.data.fieldType as FieldType)
  const target = { ...field, fieldType: effectiveType }

  // The submitted options only count as a change when this field owns its list;
  // for a directory-backed one the client sends the current values back and the
  // guard would otherwise refuse a save that changed nothing.
  const optionsChanged =
    canEditOptions(target) &&
    JSON.stringify(parsed.data.options) !== JSON.stringify(field.options)

  const violation = describeCoreFieldViolation(field, {
    isRequired: parsed.data.isRequired,
    fieldType: parsed.data.fieldType as FieldType,
    options: optionsChanged ? parsed.data.options : undefined,
  })
  if (violation) return { success: false, error: violation }

  const optionsViolation = describeOptionsViolation(target, parsed.data.options)
  if (optionsViolation) return { success: false, error: optionsViolation }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("form_fields")
    .update({
      label: parsed.data.label,
      // A core field's type is fixed; the guard above already refused a change,
      // so writing the original value keeps the update harmless either way.
      field_type: effectiveType,
      is_required: parsed.data.isRequired,
      placeholder: parsed.data.placeholder?.trim() || null,
      help_text: parsed.data.helpText?.trim() || null,
      // Owned lists are written; directory-backed ones keep whatever they had,
      // which is the empty array their options were never stored in.
      options: canEditOptions(target)
        ? isChoiceType(effectiveType)
          ? parsed.data.options
          : []
        : field.options,
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

/**
 * How many missions already answered with each option.
 *
 * Removing an option does not rewrite history: a mission keeps whatever it was
 * saved with. But it does stop that answer being offered again, and it makes
 * the value unrecognised by validation, so the admin should see the number
 * before they decide. Zero is very different from forty.
 */
export async function getFieldOptionUsage(
  fieldId: string
): Promise<Record<string, number> | null> {
  // null, never {}. An empty map renders as "0 uses" beside every option, which
  // reads as "safe to delete" — the opposite of "we could not find out".
  const guard = await authorize()
  if ("error" in guard) return null
  const { access } = guard

  const fields = await listFormFields(access, FORM_KEY, { includeArchived: true })
  const field = fields.find((item) => item.id === fieldId)
  if (!field || !isChoiceType(field.fieldType)) return null

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  /*
    One counting query per option, not one scan of every row.

    Reading the rows and tallying them in JS looked simpler and was wrong:
    PostgREST caps a select at its configured maximum (1000 by default), so a
    tenant past that many missions would have been shown a number quietly
    smaller than the truth. That number is the whole point of this action, and
    the admin deletes options on the strength of it. An `exact` head count has
    no cap.

    Options are a handful per field, so a handful of parallel counts is cheap.
  */
  // Core choice fields whose answer is a column on the mission itself.
  const missionColumn: Record<string, string> = {
    mission_type: "mission_type",
    contact_salutation: "contact_salutation",
  }
  const column = field.isCore ? missionColumn[field.reportingKey] : undefined

  const countMatching = async (option: string): Promise<number> => {
    const base =
      column
        ? schema
            .from("missions")
            .select("id", { count: "exact", head: true })
            .eq("company_id", access.companyId)
            .eq(column, option)
        : schema
            .from("mission_field_values")
            .select("id", { count: "exact", head: true })
            .eq("company_id", access.companyId)
            .eq("field_id", fieldId)
            // A MULTI_SELECT answer is a jsonb array and a SELECT answer is a
            // scalar, so both shapes have to be asked about.
            .or(`value.eq."${option.replace(/"/g, '\\"')}",value.cs.["${option.replace(/"/g, '\\"')}"]`)

    const { count, error } = await base
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  // Any other core field is directory-owned (people), so there is nothing to
  // count against an admin's list.
  if (field.isCore && !column) {
    return Object.fromEntries(field.options.map((option) => [option, 0]))
  }

  try {
    const counted = await Promise.all(
      field.options.map(async (option) => [option, await countMatching(option)] as const)
    )
    return Object.fromEntries(counted)
  } catch {
    // One failed count makes the whole set untrustworthy: a partial map would
    // show real numbers next to silent zeros.
    return null
  }
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
