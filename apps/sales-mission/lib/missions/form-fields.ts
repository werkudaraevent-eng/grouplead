import { z } from "zod"

/**
 * Admin-configurable form fields.
 *
 * Two things live here: the rules about what an admin may change, and the
 * validation of answers against whatever configuration is current. Both are
 * pure, so the settings screen, the mission form, and the server action all
 * apply exactly the same rules.
 */

export const FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "TIME",
  "SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Teks singkat",
  LONG_TEXT: "Teks panjang",
  NUMBER: "Angka",
  CURRENCY: "Nilai uang",
  DATE: "Tanggal",
  TIME: "Jam",
  SELECT: "Pilihan tunggal",
  MULTI_SELECT: "Pilihan ganda",
  BOOLEAN: "Ya / tidak",
}

/** Types whose answers come from a fixed list the admin maintains. */
export function isChoiceType(type: FieldType): boolean {
  return type === "SELECT" || type === "MULTI_SELECT"
}

export interface FormField {
  id: string
  reportingKey: string
  label: string
  fieldType: FieldType
  isRequired: boolean
  isCore: boolean
  isActive: boolean
  placeholder: string | null
  helpText: string | null
  options: string[]
  displayOrder: number
}

/**
 * Turn a label into a stable reporting key.
 *
 * The key is what reports join on, so it is derived once at creation and then
 * frozen — renaming "Budget" to "Estimasi budget" must not orphan a year of
 * answers.
 */
export function toReportingKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50)

  // The column requires a leading letter.
  return /^[a-z]/.test(slug) ? slug : `field_${slug}` || "field"
}

export const fieldDefinitionSchema = z
  .object({
    label: z.string().trim().min(1, "Nama field wajib diisi").max(100),
    fieldType: z.enum(FIELD_TYPES),
    isRequired: z.boolean().default(false),
    placeholder: z.string().trim().max(200).optional().or(z.literal("")),
    helpText: z.string().trim().max(300).optional().or(z.literal("")),
    options: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((value, ctx) => {
    if (isChoiceType(value.fieldType) && value.options.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Field pilihan butuh minimal satu opsi",
      })
    }

    const unique = new Set(value.options)
    if (unique.size !== value.options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Opsi tidak boleh terduplikasi" })
    }
  })

export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>

/**
 * Whether an edit to a core field is allowed.
 *
 * Core fields carry conflict detection, the calendar, KPI and the lead push.
 * Admins may relabel and reorder them, and may tighten an optional one into a
 * required one — tightening only ever adds information. Loosening or removing
 * would break those features silently.
 */
export function describeCoreFieldViolation(
  field: Pick<FormField, "isCore" | "isRequired" | "fieldType">,
  change: { isRequired?: boolean; fieldType?: FieldType; archive?: boolean }
): string | null {
  if (!field.isCore) return null

  if (change.archive) return "Field inti tidak bisa dihapus."
  if (change.fieldType && change.fieldType !== field.fieldType) {
    return "Tipe field inti tidak bisa diubah."
  }
  if (change.isRequired === false && field.isRequired) {
    return "Field inti yang wajib tidak bisa dijadikan opsional."
  }

  return null
}

/** Fields shown on a form, in order. Archived ones never render. */
export function visibleFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => field.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
}

export type FieldAnswer = string | string[] | number | boolean | null

/**
 * Validate answers to the custom (non-core) fields.
 *
 * Core answers are validated by `createMissionSchema`, which knows their
 * meaning. This covers only what the admin added, where the rules come from the
 * configuration rather than the code.
 */
export function validateFieldAnswers(
  fields: FormField[],
  answers: Record<string, FieldAnswer>
): { ok: true } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const field of visibleFields(fields)) {
    if (field.isCore) continue

    const answer = answers[field.reportingKey]
    const empty =
      answer === null ||
      answer === undefined ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0)

    if (empty) {
      // A required boolean is satisfied by `false` — "no" is an answer.
      if (field.isRequired && field.fieldType !== "BOOLEAN") {
        errors[field.reportingKey] = `${field.label} wajib diisi`
      }
      continue
    }

    switch (field.fieldType) {
      case "NUMBER":
      case "CURRENCY": {
        const numeric = typeof answer === "number" ? answer : Number(answer)
        if (Number.isNaN(numeric)) errors[field.reportingKey] = `${field.label} harus berupa angka`
        else if (numeric < 0) errors[field.reportingKey] = `${field.label} tidak boleh negatif`
        break
      }
      case "DATE":
        if (typeof answer !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(answer)) {
          errors[field.reportingKey] = `${field.label} bukan tanggal yang valid`
        }
        break
      case "TIME":
        if (typeof answer !== "string" || !/^\d{2}:\d{2}$/.test(answer)) {
          errors[field.reportingKey] = `${field.label} bukan jam yang valid`
        }
        break
      case "SELECT":
        if (typeof answer !== "string" || !field.options.includes(answer)) {
          errors[field.reportingKey] = `${field.label} berisi pilihan yang tidak dikenal`
        }
        break
      case "MULTI_SELECT": {
        const values = Array.isArray(answer) ? answer : [answer]
        // An answer outside the configured list means the option was archived
        // or the request was crafted by hand.
        if (values.some((item) => typeof item !== "string" || !field.options.includes(item))) {
          errors[field.reportingKey] = `${field.label} berisi pilihan yang tidak dikenal`
        }
        break
      }
      default:
        break
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}

/**
 * Next display order for a newly added field.
 *
 * New fields land at the end rather than interleaving with the core ones, so
 * adding a field never silently reshuffles a form people know.
 */
export function nextDisplayOrder(fields: FormField[]): number {
  const highest = fields.reduce((max, field) => Math.max(max, field.displayOrder), 0)
  return highest + 10
}

/** Move a field one position within the ordered list, returning new orders. */
export function reorderField(
  fields: FormField[],
  fieldId: string,
  direction: "up" | "down"
): Array<{ id: string; displayOrder: number }> {
  const ordered = visibleFields(fields)
  const index = ordered.findIndex((field) => field.id === fieldId)
  if (index === -1) return []

  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= ordered.length) return []

  const swapped = [...ordered]
  ;[swapped[index], swapped[target]] = [swapped[target], swapped[index]]

  // Rewrite every order in steps of ten. Renumbering the whole list keeps gaps
  // even after many moves, so a later insert never collides.
  return swapped.map((field, position) => ({ id: field.id, displayOrder: (position + 1) * 10 }))
}
