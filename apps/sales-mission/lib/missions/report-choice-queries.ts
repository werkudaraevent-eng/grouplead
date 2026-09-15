import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { CHOICE_FIELDS, DEFAULT_REPORT_CHOICES, emptyChoiceSet, type ChoiceField, type ChoiceSet, type ReportChoice } from "./report-choices"

const CHOICE_COLUMNS = "id, field_key, code, label, kind, is_active, display_order"

type ChoiceRow = { id: string; field_key: string; code: string; label: string; kind: string; is_active: boolean; display_order: number }

function toChoice(row: ChoiceRow): ReportChoice {
  return {
    id: row.id,
    fieldKey: row.field_key as ChoiceField,
    code: row.code,
    label: row.label,
    kind: row.kind,
    isActive: row.is_active,
    displayOrder: row.display_order,
  }
}

function group(rows: ReportChoice[]): ChoiceSet {
  const set = emptyChoiceSet()
  for (const row of rows) if (CHOICE_FIELDS.includes(row.fieldKey)) set[row.fieldKey].push(row)
  for (const field of CHOICE_FIELDS) set[field].sort((a, b) => a.displayOrder - b.displayOrder)
  return set
}

/**
 * The tenant's report choices, seeding the defaults a field lacks entirely
 * on first use, the way listFormFields seeds core fields. A tenant that
 * relabelled or archived a default keeps that; only a field with nothing at
 * all gets the seed.
 */
export async function listReportChoices(
  access: SalesMissionAccess,
  options: { includeArchived?: boolean } = {}
): Promise<ChoiceSet> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const read = async (includeArchived: boolean) => {
    let query = schema.from("report_choices").select(CHOICE_COLUMNS).eq("company_id", access.companyId)
    if (!includeArchived) query = query.eq("is_active", true)
    const { data } = await query
    return (data ?? []).map((row) => toChoice(row as ChoiceRow))
  }

  const all = await read(true)
  const present = new Set(all.map((choice) => choice.fieldKey))
  const missing = DEFAULT_REPORT_CHOICES.filter((seed) => !present.has(seed.fieldKey))
  if (missing.length > 0) {
    await schema.from("report_choices").upsert(
      missing.map((seed) => ({
        company_id: access.companyId,
        field_key: seed.fieldKey,
        code: seed.code,
        label: seed.label,
        kind: seed.kind,
        display_order: seed.displayOrder,
        created_by: access.userId,
      })),
      { onConflict: "company_id,field_key,code", ignoreDuplicates: true }
    )
    return group(await read(Boolean(options.includeArchived)))
  }
  return group(options.includeArchived ? all : all.filter((choice) => choice.isActive))
}

/**
 * Labels only, by field and code, for list screens that have no access
 * object at hand: reads what is stored and lets the seed fill the rest.
 */
export async function reportChoiceLabels(
  schema: ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>,
  companyId: string
): Promise<Record<ChoiceField, Map<string, string>>> {
  const { data } = await schema.from("report_choices").select("field_key, code, label").eq("company_id", companyId)
  const result: Record<ChoiceField, Map<string, string>> = {
    visit_outcome: new Map(),
    interest_level: new Map(),
    next_action_type: new Map(),
  }
  for (const seed of DEFAULT_REPORT_CHOICES) result[seed.fieldKey].set(seed.code, seed.label)
  for (const row of data ?? []) {
    const field = row.field_key as ChoiceField
    if (result[field]) result[field].set(row.code as string, row.label as string)
  }
  return result
}
