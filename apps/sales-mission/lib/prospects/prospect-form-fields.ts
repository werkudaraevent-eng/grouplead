import { visibleFields, type FormField } from "@/lib/missions/form-fields"
import { formatNumber } from "@/lib/format/number"

/**
 * The prospect form as a configured form.
 *
 * Sections, spans and the required-ness check live here, pure, so the form,
 * the server action and the import all read the same configuration the same
 * way. The mission form keeps the same split; see mission-form.tsx.
 */

/** Which card a core field lives in. Custom fields go to "Tambahan". */
export const PROSPECT_SECTIONS: Record<string, string> = {
  client_company: "Perusahaan",
  industry: "Perusahaan",
  website: "Perusahaan",
  address: "Perusahaan",
  location: "Perusahaan",
  contact_salutation: "Kontak",
  contact_name: "Kontak",
  contact_job_title: "Kontak",
  contact_division: "Kontak",
  contact_phone: "Kontak",
  contact_email: "Kontak",
  notes: "Catatan dan pemegang",
  owner: "Catatan dan pemegang",
}

/** One line under each section title saying what the section decides. */
export const PROSPECT_SECTION_HINTS: Record<string, string> = {
  Perusahaan: "Siapa yang akan dihubungi. Kalau sudah ada di LeadEngine, pilih dari daftar supaya tertaut.",
  Kontak: "Orang yang dihubungi. Nomor telepon disimpan dalam satu format supaya duplikat terdeteksi.",
  "Catatan dan pemegang": "Dari mana prospek ini datang, dan siapa yang menghubunginya.",
  Tambahan: "Field yang ditambahkan admin.",
}

export function prospectSectionOf(field: FormField): string {
  return field.isCore ? PROSPECT_SECTIONS[field.reportingKey] ?? "Lainnya" : "Tambahan"
}

/**
 * Cut the configured order into consecutive runs of the same section, so each
 * run becomes one card with one grid. The admin's ordering stays the ordering;
 * if they interleave, the sections repeat and show exactly that.
 */
export function prospectBlocks(fields: FormField[]): Array<{ section: string; fields: FormField[] }> {
  const blocks: Array<{ section: string; fields: FormField[] }> = []
  for (const field of visibleFields(fields)) {
    const section = prospectSectionOf(field)
    const current = blocks[blocks.length - 1]
    if (current && current.section === section) current.fields.push(field)
    else blocks.push({ section, fields: [field] })
  }
  return blocks
}

/** The values the form or the import submits for the core fields. */
export interface ProspectCoreValues {
  clientCompanyName?: string
  industry?: string
  website?: string
  address?: string
  location?: string
  contactSalutation?: string
  contactName?: string
  contactJobTitle?: string
  contactDivision?: string
  contactPhone?: string
  contactEmail?: string
  notes?: string
  ownerId?: string | null
}

const CORE_INPUT_KEYS: Record<string, keyof ProspectCoreValues> = {
  client_company: "clientCompanyName",
  industry: "industry",
  website: "website",
  address: "address",
  location: "location",
  contact_salutation: "contactSalutation",
  contact_name: "contactName",
  contact_job_title: "contactJobTitle",
  contact_division: "contactDivision",
  contact_phone: "contactPhone",
  contact_email: "contactEmail",
  notes: "notes",
  owner: "ownerId",
}

/**
 * The label of the first required core field left empty, or null.
 *
 * Required is whatever the admin configured, so a tenant that made Telepon
 * mandatory gets it enforced on the server too, not only by the browser.
 */
export function missingRequiredCore(fields: FormField[], values: ProspectCoreValues): string | null {
  for (const field of visibleFields(fields)) {
    if (!field.isCore || !field.isRequired) continue
    const key = CORE_INPUT_KEYS[field.reportingKey]
    if (!key) continue
    const value = values[key]
    if (value === null || value === undefined || String(value).trim() === "") return field.label
  }
  return null
}

export function isEmptyAnswer(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
}

/** A stored answer as the text a detail page shows. */
export function formatAnswer(field: Pick<FormField, "fieldType">, value: unknown): string {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"
  if (Array.isArray(value)) return value.map(String).join(", ")
  if (field.fieldType === "CURRENCY") {
    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isNaN(numeric) ? String(value) : `Rp ${formatNumber(numeric)}`
  }
  if (field.fieldType === "NUMBER") {
    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isNaN(numeric) ? String(value) : formatNumber(numeric)
  }
  if (field.fieldType === "DATE" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`))
  }
  return String(value)
}

/** The custom answers worth showing: active custom fields with a non-empty value, formatted. */
export function customAnswers(fields: FormField[], values: Record<string, unknown>): Array<{ field: FormField; text: string }> {
  return visibleFields(fields)
    .filter((field) => !field.isCore)
    .map((field) => ({ field, value: values[field.reportingKey] }))
    .filter(({ value }) => !isEmptyAnswer(value))
    .map(({ field, value }) => ({ field, text: formatAnswer(field, value) }))
}
