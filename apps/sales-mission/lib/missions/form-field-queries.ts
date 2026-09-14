import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { coreFieldsFor, type FormKey, type FieldType, type FormField } from "./form-fields"

/** Read side of the form builder. */

const FIELD_COLUMNS =
  "id, reporting_key, label, field_type, is_required, is_core, is_active, placeholder, help_text, options, display_order"

type FieldRow = Record<string, unknown>

function toFormField(row: FieldRow): FormField {
  return {
    id: row.id as string,
    reportingKey: row.reporting_key as string,
    label: row.label as string,
    fieldType: row.field_type as FieldType,
    isRequired: Boolean(row.is_required),
    isCore: Boolean(row.is_core),
    isActive: Boolean(row.is_active),
    placeholder: (row.placeholder as string | null) ?? null,
    helpText: (row.help_text as string | null) ?? null,
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    displayOrder: Number(row.display_order ?? 0),
  }
}

/**
 * Fields for a form, seeding the locked core set on first use.
 *
 * Seeding lazily rather than backfilling every tenant: most companies in the
 * shared database will never open Sales Mission, and rows they never use are
 * rows someone eventually has to explain.
 */
export async function listFormFields(
  access: SalesMissionAccess,
  formKey: FormKey = "mission",
  options: { includeArchived?: boolean } = {}
): Promise<FormField[]> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const read = async () => {
    let query = schema
      .from("form_fields")
      .select(FIELD_COLUMNS)
      .eq("company_id", access.companyId)
      .eq("form_key", formKey)
      .order("display_order", { ascending: true })

    if (!options.includeArchived) query = query.eq("is_active", true)

    const { data } = await query
    return (data ?? []).map((row) => toFormField(row as FieldRow))
  }

  let fields = await read()

  {
    const core = coreFieldsFor(formKey)
    // Seed whatever core fields this tenant is missing, not just the whole set
    // on an empty form. A tenant seeded before a core field existed would
    // otherwise never see it: the old "only when empty" check meant new core
    // fields reached new tenants and nobody else.
    const present = new Set(fields.map((field) => field.reportingKey))
    const missing = core.filter((field) => !present.has(field.reportingKey))

    if (missing.length > 0) {
      // `ignoreDuplicates` makes this safe to race: two people opening the form
      // at once both attempt the seed, and the unique key decides. It also
      // means an admin's relabelled field is never overwritten.
      await schema.from("form_fields").upsert(
        missing.map((field) => ({
          company_id: access.companyId,
          form_key: formKey,
          reporting_key: field.reportingKey,
          label: field.label,
          field_type: field.fieldType,
          is_required: field.isRequired,
          is_core: true,
          help_text: "helpText" in field ? (field.helpText ?? null) : null,
          // Seeded so a choice field arrives with choices. Without this the
          // mission form would open a dropdown with nothing in it.
          options: field.options ?? [],
          display_order: field.displayOrder,
        })),
        { onConflict: "company_id,form_key,reporting_key", ignoreDuplicates: true }
      )

      fields = await read()
    }

    // Repair a core choice field that exists but has no choices.
    //
    // The seed above only inserts fields that are missing, so a tenant seeded
    // before "Jenis mission" carried options would keep an empty list forever:
    // the settings screen would show a single-choice field with nothing to
    // choose, which is the defect this whole change is about. Doing it here as
    // well as in the migration means the fix does not depend on deploy order,
    // and costs one write per tenant, once.
    const repairs = core.filter(
      (item) =>
        (item.options?.length ?? 0) > 0 &&
        fields.some(
          (field) => field.reportingKey === item.reportingKey && field.options.length === 0
        )
    )

    if (repairs.length > 0) {
      await Promise.all(
        repairs.map((item) =>
          schema
            .from("form_fields")
            .update({ options: item.options })
            .eq("company_id", access.companyId)
            .eq("form_key", formKey)
            .eq("reporting_key", item.reportingKey)
        )
      )

      fields = await read()
    }
  }

  return fields
}

/** Custom-field answers for a mission, keyed by reporting key. */
export async function getMissionFieldValues(
  access: SalesMissionAccess,
  missionId: string
): Promise<Record<string, unknown>> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("sales_mission")
    .from("mission_field_values")
    .select("reporting_key, value")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)

  const result: Record<string, unknown> = {}
  for (const row of data ?? []) {
    result[row.reporting_key as string] = row.value
  }
  return result
}

/** Custom-field answers for a report, keyed by reporting key. */
export async function getReportFieldValues(
  access: SalesMissionAccess,
  reportId: string
): Promise<Record<string, unknown>> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("report_field_values")
    .select("reporting_key, value")
    .eq("company_id", access.companyId)
    .eq("report_id", reportId)
  const result: Record<string, unknown> = {}
  for (const row of data ?? []) result[row.reporting_key as string] = row.value
  return result
}
