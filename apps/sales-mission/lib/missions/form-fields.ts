import { z } from "zod"
import { parsePhotoAnswer, photoAnswerViolation, type PhotoAnswer } from "@/lib/photos/photo-answer"

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

/**
 * Starting options for "Sapaan". Same status as the mission types: a seed the
 * tenant edits from the settings screen, not a rule.
 *
 * It used to be a `const` enum here and a CHECK constraint in the database, so
 * an admin who wanted "Dr" or "Prof" had nowhere to put it.
 */
export const DEFAULT_CONTACT_SALUTATIONS = ["Bapak", "Ibu", "Mr", "Mrs", "Ms"] as const

/**
 * Starting options for "Industri" on the prospect form. A seed the admin
 * edits, not a rule: the list is what makes the field a dropdown a team can
 * filter and report on instead of nineteen spellings of "perbankan".
 */
export const DEFAULT_INDUSTRIES = [
  "Farmasi & kesehatan", "Perbankan & keuangan", "Asuransi", "Pemerintahan", "BUMN", "Telekomunikasi", "Teknologi",
  "Manufaktur", "Otomotif", "FMCG", "Pendidikan", "Properti & konstruksi", "Energi & pertambangan",
  "Logistik & transportasi", "Media & hiburan", "Retail", "Pariwisata & perhotelan", "Lainnya",
] as const

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
  // Photos, taken or picked on the device, stored in the company's bucket.
  "PHOTO",
  // Core-only: the report's "who did you meet" group. Named so the settings
  // screen shows it for what it is; never offered for a custom field.
  "CONTACTS",
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/** Types an admin may give a field they add. */
export const CUSTOM_FIELD_TYPES = FIELD_TYPES.filter((type) => type !== "CONTACTS")

export type FormKey = "mission" | "visit_report" | "prospect"
export const FORM_KEYS: readonly FormKey[] = ["mission", "visit_report", "prospect"]
export const FORM_KEY_LABELS: Record<FormKey, string> = { mission: "Form aktivitas", visit_report: "Form laporan", prospect: "Form prospek" }

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
  CONTACTS: "Daftar kontak",
  PHOTO: "Foto",
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
  contact_salutation: "config",
  primary_sales: "directory",
  supporting_sales: "directory",
  // Visit report. The two vocabularies are the admin's; the three enums are
  // codes the KPI screen and the CRM sync switch on, so they stay fixed.
  client_needs: "config",
  product_interest: "config",
  visit_outcome: "directory",
  interest_level: "directory",
  next_action_type: "directory",
  next_action_owner: "directory",
  // The prospect form's salutation list is the mission form's, so a prospect
  // converts into a mission without its salutation falling out of the list.
  // Keyed by form so the same reporting key stays editable on the mission form.
  "prospect:contact_salutation": "directory",
  "prospect:owner": "directory",
  industry: "config",
  // The activity's industry list is the prospect form's, the same way the
  // prospect's salutation list is the activity form's: one list, one place
  // to edit it, matched by the admin to the CRM's Sector options.
  "mission:industry": "directory",
}

export function optionSource(
  field: Pick<FormField, "isCore" | "reportingKey" | "fieldType">,
  formKey?: FormKey
): OptionSource | null {
  if (!isChoiceType(field.fieldType)) return null
  if (!field.isCore) return "config"
  // An unlisted core choice field is treated as directory-owned: refusing to
  // edit a list we do not understand is the safe default.
  return (formKey ? CORE_OPTION_SOURCES[`${formKey}:${field.reportingKey}`] : undefined) ?? CORE_OPTION_SOURCES[field.reportingKey] ?? "directory"
}

/** Whether this field's options are the admin's to edit. */
export function canEditOptions(
  field: Pick<FormField, "isCore" | "reportingKey" | "fieldType">,
  formKey?: FormKey
): boolean {
  return optionSource(field, formKey) === "config"
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
  // Beside the company: what kind of business it is. The options shown are
  // the prospect form's list (see withSharedIndustry); this seed only makes
  // the field exist for a tenant that has never opened the prospect form.
  { reportingKey: "industry", label: "Industri", fieldType: "SELECT", isRequired: false, displayOrder: 15, options: [...DEFAULT_INDUSTRIES] },
  // Seeded with the list the mission form used to hardcode, so switching it to
  // config changes nothing on day one and everything after.
  { reportingKey: "mission_type", label: "Jenis aktivitas", fieldType: "SELECT", isRequired: true, displayOrder: 20, options: [...DEFAULT_MISSION_TYPES] },
  { reportingKey: "objective", label: "Tujuan kunjungan", fieldType: "TEXT", isRequired: false, displayOrder: 25 },
  // The address block, in the order every global address form uses: the
  // street, then the building or unit, then the city that the map, the
  // filters and the calendar's travel buffer key on.
  { reportingKey: "address", label: "Alamat jalan", fieldType: "TEXT", isRequired: false, displayOrder: 30 },
  { reportingKey: "building", label: "Gedung / lantai / unit", fieldType: "TEXT", isRequired: false, displayOrder: 32 },
  { reportingKey: "location", label: "Kota", fieldType: "TEXT", isRequired: false, displayOrder: 34 },
  // Who goes comes before when: the schedule picker draws the calendars of
  // whoever is being sent, so it has nothing to show until they are chosen.
  { reportingKey: "primary_sales", label: "Sales utama", fieldType: "SELECT", isRequired: true, displayOrder: 50 },
  { reportingKey: "supporting_sales", label: "Sales pendukung", fieldType: "MULTI_SELECT", isRequired: false, displayOrder: 60 },
  { reportingKey: "date", label: "Tanggal", fieldType: "DATE", isRequired: true, displayOrder: 70 },
  { reportingKey: "start_time", label: "Jam mulai", fieldType: "TIME", isRequired: true, displayOrder: 80 },
  { reportingKey: "end_time", label: "Jam selesai", fieldType: "TIME", isRequired: false, displayOrder: 90 },
  // Appointment block. Often filled by the appointment team rather than the rep
  // who will attend, so it is the only place the rep learns who they are
  // meeting and what was already agreed.
  { reportingKey: "contact_salutation", label: "Sapaan", fieldType: "SELECT", isRequired: false, displayOrder: 95, options: [...DEFAULT_CONTACT_SALUTATIONS] },
  { reportingKey: "contact_name", label: "Bertemu dengan", fieldType: "TEXT", isRequired: false, displayOrder: 100 },
  { reportingKey: "contact_job_title", label: "Jabatan", fieldType: "TEXT", isRequired: false, displayOrder: 110 },
  { reportingKey: "contact_division", label: "Divisi", fieldType: "TEXT", isRequired: false, displayOrder: 120 },
  { reportingKey: "contact_phone", label: "Telepon", fieldType: "TEXT", isRequired: false, displayOrder: 130 },
  { reportingKey: "contact_email", label: "Email", fieldType: "TEXT", isRequired: false, displayOrder: 140 },
  { reportingKey: "appointment_notes", label: "Catatan janji temu", fieldType: "LONG_TEXT", isRequired: false, displayOrder: 160 },
]

/**
 * The visit report's locked core fields. Types and the fixed enums are
 * locked; labels, order, help text, requiredness (tightening only) and the
 * two vocabularies are the admin's. Seeded with the lists the form used to
 * hardcode, so day one looks the same and every day after is configurable.
 */
export const CORE_REPORT_FIELDS: Array<
  Pick<FormField, "reportingKey" | "label" | "fieldType" | "isRequired" | "displayOrder"> & {
    options?: string[]
    helpText?: string
    allowOther?: boolean
  }
> = [
  { reportingKey: "visit_outcome", label: "Hasil kunjungan", fieldType: "SELECT", isRequired: true, displayOrder: 10 },
  { reportingKey: "visit_time", label: "Waktu kunjungan", fieldType: "TIME", isRequired: false, displayOrder: 15, helpText: "Kapan kunjungan benar-benar berlangsung. Terisi dari jadwal; ubah bila bergeser." },
  { reportingKey: "contacts_met", label: "Ketemu siapa", fieldType: "CONTACTS", isRequired: true, displayOrder: 20, helpText: "Minimal satu orang, kecuali klien tidak ada." },
  { reportingKey: "meeting_summary", label: "Ringkasan pertemuan", fieldType: "LONG_TEXT", isRequired: true, displayOrder: 30, helpText: "Apa yang dibahas dan apa yang disepakati." },
  {
    reportingKey: "client_needs", label: "Kebutuhan klien", fieldType: "MULTI_SELECT", isRequired: true, displayOrder: 40,
    helpText: "Pilih yang relevan, atau tambahkan sendiri.", allowOther: true,
    options: ["Corporate gathering", "Meeting / rapat", "Outbound / team building", "Exhibition / pameran", "Product launch", "Tour / travel", "Akomodasi", "Transportasi", "Katering"],
  },
  {
    reportingKey: "product_interest", label: "Produk yang diminati", fieldType: "MULTI_SELECT", isRequired: false, displayOrder: 50, allowOther: true,
    options: ["Event organizer", "Venue", "Akomodasi", "Transportasi", "Dokumentasi", "Produksi panggung"],
  },
  { reportingKey: "interest_level", label: "Tingkat minat", fieldType: "SELECT", isRequired: true, displayOrder: 60 },
  { reportingKey: "opportunity_exists", label: "Ada peluang", fieldType: "BOOLEAN", isRequired: false, displayOrder: 70 },
  { reportingKey: "estimated_value", label: "Estimasi nilai", fieldType: "CURRENCY", isRequired: false, displayOrder: 80 },
  { reportingKey: "competitor_mentioned", label: "Kompetitor disebut", fieldType: "TEXT", isRequired: false, displayOrder: 90 },
  { reportingKey: "next_action_type", label: "Next action", fieldType: "SELECT", isRequired: true, displayOrder: 100, helpText: "Yang tidak punya pemilik dan tanggal bukan next action." },
  { reportingKey: "next_action_owner", label: "Penanggung jawab", fieldType: "SELECT", isRequired: false, displayOrder: 110 },
  { reportingKey: "follow_up_date", label: "Tanggal follow-up", fieldType: "DATE", isRequired: false, displayOrder: 120 },
  // Photos ride with the custom answers; core only so the admin can rename,
  // require or drop them, and so they arrive on every tenant's form.
  { reportingKey: "visit_photos", label: "Foto bukti kunjungan", fieldType: "PHOTO", isRequired: false, displayOrder: 125, helpText: "Suasana pertemuan, papan nama, atau produk yang dibahas." },
  { reportingKey: "business_card_photos", label: "Foto kartu nama", fieldType: "PHOTO", isRequired: false, displayOrder: 130, helpText: "Kartu nama orang yang ditemui, supaya nomor dan jabatannya tidak salah ketik." },
]

/**
 * The prospect form's locked core fields. Types are locked because the
 * import, duplicate detection and the hand-over to a mission read these
 * columns; labels, order, help text and requiredness are the admin's.
 */
export const CORE_PROSPECT_FIELDS: Array<
  Pick<FormField, "reportingKey" | "label" | "fieldType" | "isRequired" | "displayOrder"> & {
    options?: string[]
    helpText?: string
  }
> = [
  { reportingKey: "client_company", label: "Perusahaan", fieldType: "TEXT", isRequired: true, displayOrder: 10 },
  { reportingKey: "industry", label: "Industri", fieldType: "SELECT", isRequired: false, displayOrder: 20, options: [...DEFAULT_INDUSTRIES] },
  { reportingKey: "website", label: "Website", fieldType: "TEXT", isRequired: false, displayOrder: 30 },
  { reportingKey: "address", label: "Alamat jalan", fieldType: "TEXT", isRequired: false, displayOrder: 40 },
  { reportingKey: "location", label: "Kota", fieldType: "TEXT", isRequired: false, displayOrder: 50 },
  { reportingKey: "contact_salutation", label: "Sapaan", fieldType: "SELECT", isRequired: false, displayOrder: 60, helpText: "Daftar sapaan mengikuti Form aktivitas." },
  { reportingKey: "contact_name", label: "Nama kontak", fieldType: "TEXT", isRequired: false, displayOrder: 70 },
  { reportingKey: "contact_job_title", label: "Jabatan", fieldType: "TEXT", isRequired: false, displayOrder: 80 },
  { reportingKey: "contact_division", label: "Divisi", fieldType: "TEXT", isRequired: false, displayOrder: 90 },
  { reportingKey: "contact_phone", label: "Telepon", fieldType: "TEXT", isRequired: false, displayOrder: 100 },
  { reportingKey: "contact_email", label: "Email", fieldType: "TEXT", isRequired: false, displayOrder: 110 },
  { reportingKey: "notes", label: "Catatan", fieldType: "LONG_TEXT", isRequired: false, displayOrder: 120 },
  { reportingKey: "owner", label: "Pemegang", fieldType: "SELECT", isRequired: false, displayOrder: 130 },
]

export function coreFieldsFor(formKey: FormKey) {
  return formKey === "mission" ? CORE_MISSION_FIELDS : formKey === "prospect" ? CORE_PROSPECT_FIELDS : CORE_REPORT_FIELDS
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
  /** Whether the person filling the form may answer with something off the list. */
  allowOther: boolean
}

/** Whether this field takes answers off its list: a choice field with the switch on. */
export function allowsOther(field: Pick<FormField, "fieldType" | "allowOther">): boolean {
  return isChoiceType(field.fieldType) && field.allowOther
}

/**
 * Whether a value is acceptable for a config-owned core choice: on the
 * list, or off it when the admin allows that. The fallback list stands in
 * when the field has no options stored, as configuredOptions does.
 */
export function isAllowedChoice(fields: FormField[], reportingKey: string, value: string, fallback: readonly string[]): boolean {
  if (configuredOptions(fields, reportingKey, fallback).includes(value)) return true
  const field = fields.find((item) => item.reportingKey === reportingKey)
  return field ? allowsOther(field) : false
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
    allowOther: z.boolean().default(false),
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
  options: string[],
  formKey?: FormKey
): string | null {
  if (!canEditOptions(field, formKey)) return null
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
  change: { isRequired?: boolean; fieldType?: FieldType; archive?: boolean; options?: string[] },
  formKey?: FormKey
): string | null {
  if (!field.isCore) return null

  // A photo field carries nothing the code reads, so the admin may drop it.
  if (change.archive && field.fieldType !== "PHOTO") return "Field inti tidak bisa dihapus."
  if (change.fieldType && change.fieldType !== field.fieldType) {
    return "Tipe field inti tidak bisa diubah."
  }
  if (change.isRequired === false && field.isRequired) {
    return "Field inti yang wajib tidak bisa dijadikan opsional."
  }
  if (change.options && !canEditOptions(field, formKey)) {
    return "Pilihan pada field ini ditentukan sistem, bukan diatur di sini."
  }

  return null
}

/**
 * The choices a config-owned core field currently offers.
 *
 * Falls back to the seed when the list is empty rather than accepting anything.
 * `missions.mission_type` and `missions.contact_salutation` are plain text
 * columns, so "no list" must not become "any string this endpoint is handed".
 * The form renders through the same function, which keeps what is offered and
 * what is accepted identical.
 */
/**
 * The activity form's fields with the industry list taken from the prospect
 * form, so both forms offer the same choices and the value a prospect carries
 * into an activity is always on the activity's list.
 */
export function withSharedIndustry(missionFields: FormField[], prospectFields: FormField[]): FormField[] {
  const source = prospectFields.find((field) => field.reportingKey === "industry")
  if (!source) return missionFields
  return missionFields.map((field) =>
    field.reportingKey === "industry" && field.isCore
      ? { ...field, options: source.options.length > 0 ? source.options : [...DEFAULT_INDUSTRIES], allowOther: source.allowOther }
      : field
  )
}

export function configuredOptions(
  fields: FormField[],
  reportingKey: string,
  fallback: readonly string[]
): string[] {
  const field = fields.find((item) => item.reportingKey === reportingKey)
  return field && field.options.length > 0 ? field.options : [...fallback]
}

/**
 * A pasted list turned into options.
 *
 * One option per line, the way Google Forms, HubSpot and Salesforce read a
 * pasted list. A single line is also split on commas and semicolons, since
 * that is how a list arrives from a spreadsheet cell or a chat message.
 * Blank lines are dropped; anything already on the list, or repeated in the
 * paste, is skipped and counted so the admin sees what happened.
 */
export function parseOptionList(
  text: string,
  existing: string[]
): { added: string[]; skippedDuplicates: number } {
  const lines = text.includes("\n") ? text.split(/\r?\n/) : text.split(/[,;]/)
  const seen = new Set(existing.map((option) => option.trim().toLowerCase()))
  const added: string[] = []
  let skippedDuplicates = 0
  for (const line of lines) {
    // A leading bullet, dash or "1." is how people write lists by hand.
    const value = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim().slice(0, 100)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) {
      skippedDuplicates += 1
      continue
    }
    seen.add(key)
    added.push(value)
  }
  return { added, skippedDuplicates }
}

/** Fields shown on a form, in order. Archived ones never render. */
export function visibleFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => field.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
}

export type FieldAnswer = string | string[] | number | boolean | null | PhotoAnswer[]

/** Custom-field answers off a submitted form, by the tenant's field types. */
export function readCustomAnswers(formData: FormData, customFields: FormField[]): Record<string, FieldAnswer> {
  const answers: Record<string, FieldAnswer> = {}
  for (const field of customFields) {
    // Core fields answer through their own columns, except photos, which
    // always live with the custom answers.
    if (field.isCore && field.fieldType !== "PHOTO") continue
    const name = `custom__${field.reportingKey}`
    if (field.fieldType === "MULTI_SELECT") {
      answers[field.reportingKey] = formData.getAll(name).map(String)
    } else if (field.fieldType === "PHOTO") {
      answers[field.reportingKey] = parsePhotoAnswer(formData.get(name))
    } else if (field.fieldType === "BOOLEAN") {
      answers[field.reportingKey] = formData.get(name) === "true"
    } else {
      const raw = formData.get(name)
      answers[field.reportingKey] = typeof raw === "string" && raw !== "" ? raw : null
    }
  }
  return answers
}

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
    if (field.isCore && field.fieldType !== "PHOTO") continue

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
      case "PHOTO": {
        const violation = photoAnswerViolation(answer, field.label)
        if (violation) errors[field.reportingKey] = violation
        break
      }
      case "SELECT":
        if (typeof answer !== "string" || (!field.options.includes(answer) && !field.allowOther)) {
          errors[field.reportingKey] = `${field.label} berisi pilihan yang tidak dikenal`
        }
        break
      case "MULTI_SELECT": {
        const values = Array.isArray(answer) ? answer : [answer]
        // An answer outside the configured list means the option was archived
        // or the request was crafted by hand, unless the admin allows it.
        if (values.some((item) => typeof item !== "string" || (!field.options.includes(item) && !field.allowOther))) {
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
