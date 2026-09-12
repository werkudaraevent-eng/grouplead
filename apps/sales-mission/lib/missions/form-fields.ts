import { z } from "zod"

/**
 * Admin-configurable form fields.
 *
 * Two things live here: the rules about what an admin may change, and the
 * validation of answers against whatever configuration is current. Both are
 * pure, so the settings screen, the mission form, and the server action all
 * apply exactly the same rules.
 */

/**
 * Starting options for "Jenis mission".
 *
 * A default, not a rule. The mission form renders whatever the tenant has
 * configured; this is only what a tenant is handed before anyone edits it.
 */
export const DEFAULT_MISSION_TYPES = ["Meeting", "Visit", "Survey", "Follow Up"] as const

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

/**
 * Where a choice field's options come from.
 *
 *   config    — the admin maintains the list on the settings screen, and the
 *               mission form renders exactly that list.
 *   directory — the list is people, read from the tenant's users. There is
 *               nothing to type here, and an options editor would be a control
 *               that changes nothing.
 *
 * This distinction did not exist before, so the settings screen hid the options
 * editor from every core field. "Jenis mission" therefore showed as a single
 * choice field with no choices and no way to add one, while the real list sat
 * hardcoded in MISSION_TYPES where no admin could reach it.
 */
export type OptionSource = "config" | "directory"

const CORE_OPTION_SOURCES: Record<string, OptionSource> = {
  mission_type: "config",
  primary_sales: "directory",
  supporting_sales: "directory",
}

export function optionSource(
  field: Pick<FormField, "isCore" | "reportingKey" | "fieldType">
): OptionSource | null {
  if (!isChoiceType(field.fieldType)) return null
  if (!field.isCore) return "config"
  // An unlisted core choice field is treated as directory-owned: refusing to
  // edit a list we do not understand is the safe default.
  return CORE_OPTION_SOURCES[field.reportingKey] ?? "directory"
}

/** Whether this field's options are the admin's to edit. */
export function canEditOptions(
  field: Pick<FormField, "isCore" | "reportingKey" | "fieldType">
): boolean {
  return optionSource(field) === "config"
}

/**
 * The locked core fields every tenant starts with.
 *
 * Defined here rather than only in SQL so the seed runs through the same
 * client, RLS and types as everything else — a Postgres function would need its
 * own schema targeting and EXECUTE grants to reach, which is three ways to fail
 * for something this simple.
 */
export const CORE_MISSION_FIELDS: Array<
  Pick<FormField, "reportingKey" | "label" | "fieldType" | "isRequired" | "displayOrder"> & {
    options?: string[]
  }
> = [
  { reportingKey: "client_company", label: "Perusahaan klien", fieldType: "TEXT", isRequired: true, displayOrder: 10 },
  // Seeded with the list the mission form used to hardcode, so switching it to
  // config changes nothing on day one and everything after.
  { reportingKey: "mission_type", label: "Jenis mission", fieldType: "SELECT", isRequired: true, displayOrder: 20, options: [...DEFAULT_MISSION_TYPES] },
  { reportingKey: "location", label: "Lokasi", fieldType: "TEXT", isRequired: false, displayOrder: 30 },
  { reportingKey: "date", label: "Tanggal", fieldType: "DATE", isRequired: true, displayOrder: 40 },
  { reportingKey: "start_time", label: "Jam mulai", fieldType: "TIME", isRequired: true, displayOrder: 50 },
  { reportingKey: "end_time", label: "Jam selesai", fieldType: "TIME", isRequired: false, displayOrder: 60 },
  { reportingKey: "objective", label: "Tujuan kunjungan", fieldType: "TEXT", isRequired: false, displayOrder: 70 },
  { reportingKey: "primary_sales", label: "Sales utama", fieldType: "SELECT", isRequired: true, displayOrder: 80 },
  { reportingKey: "supporting_sales", label: "Sales pendukung", fieldType: "MULTI_SELECT", isRequired: false, displayOrder: 90 },
  // Appointment block. Often filled by the appointment team rather than the rep
  // who will attend, so it is the only place the rep learns who they are
  // meeting and what was already agreed.
  { reportingKey: "contact_name", label: "Bertemu dengan", fieldType: "TEXT", isRequired: false, displayOrder: 100 },
  { reportingKey: "contact_job_title", label: "Jabatan", fieldType: "TEXT", isRequired: false, displayOrder: 110 },
  { reportingKey: "contact_division", label: "Divisi", fieldType: "TEXT", isRequired: false, displayOrder: 120 },
  { reportingKey: "contact_phone", label: "Telepon", fieldType: "TEXT", isRequired: false, displayOrder: 130 },
  { reportingKey: "contact_email", label: "Email", fieldType: "TEXT", isRequired: false, displayOrder: 140 },
  { reportingKey: "building", label: "Gedung / lantai", fieldType: "TEXT", isRequired: false, displayOrder: 150 },
  { reportingKey: "appointment_notes", label: "Catatan janji temu", fieldType: "LONG_TEXT", isRequired: false, displayOrder: 160 },
]

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
    const unique = new Set(value.options)
    if (unique.size !== value.options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Opsi tidak boleh terduplikasi" })
    }
  })

export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>

/**
 * The "a choice field needs choices" rule, which only applies where the admin
 * owns the list.
 *
 * It cannot live in the zod schema: "Sales utama" is a required core SELECT
 * whose options are people, so it legitimately stores an empty array, and a
 * blanket rule would make that field unsaveable. The same function backs the
 * client's inline validation and the server's refusal.
 */
export function describeOptionsViolation(
  field: Pick<FormField, "isCore" | "reportingKey" | "fieldType">,
  options: string[]
): string | null {
  if (!canEditOptions(field)) return null
  if (options.length === 0) return "Field pilihan butuh minimal satu opsi"

  // Compared trimmed, because that is what gets stored: fieldDefinitionSchema
  // trims each option before it reaches the database. Comparing raw let
  // "Meeting" and "Meeting " through the Save button and only failed once the
  // server had normalised them, with an error that named no row.
  const normalised = options.map((option) => option.trim())
  if (normalised.some((option) => option.length === 0)) return "Opsi tidak boleh kosong"
  if (new Set(normalised).size !== normalised.length) return "Opsi tidak boleh terduplikasi"
  return null
}

/**
 * Whether an edit to a core field is allowed.
 *
 * Core fields carry conflict detection, the calendar, KPI and the lead push.
 * Admins may relabel and reorder them, and may tighten an optional one into a
 * required one — tightening only ever adds information. Loosening or removing
 * would break those features silently.
 *
 * The type stays fixed for a concrete reason, not out of caution: the schedule
 * columns feed overlap detection, and `missions.mission_type` is a single text
 * column that a MULTI_SELECT could not fit. Options are a different question,
 * and are allowed wherever the field owns its list (see optionSource).
 */
export function describeCoreFieldViolation(
  field: Pick<FormField, "isCore" | "isRequired" | "fieldType" | "reportingKey">,
  change: { isRequired?: boolean; fieldType?: FieldType; archive?: boolean; options?: string[] }
): string | null {
  if (!field.isCore) return null

  if (change.archive) return "Field inti tidak bisa dihapus."
  if (change.fieldType && change.fieldType !== field.fieldType) {
    return "Tipe field inti tidak bisa diubah."
  }
  if (change.isRequired === false && field.isRequired) {
    return "Field inti yang wajib tidak bisa dijadikan opsional."
  }
  if (change.options && !canEditOptions(field)) {
    return "Pilihan pada field ini diambil dari daftar pengguna, bukan diatur di sini."
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
