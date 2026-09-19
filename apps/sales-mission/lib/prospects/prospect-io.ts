import { normalizePhone, isValidPhone } from "@/lib/format/phone"
import { parseNumber } from "@/lib/format/number"
import { normaliseDate, normaliseTime, splitList, type ImportColumn, type RawRow, type RowIssue } from "@/lib/missions/mission-io"
import { isAttachmentType, visibleFields, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"

/**
 * Spreadsheet shape for importing prospects.
 *
 * Derived from the tenant's prospect form, like the mission import: the core
 * columns carry the admin's labels and required marks, and every custom
 * field becomes a column of its own. The one substitution is the owner,
 * matched by email like the mission import matches sales, because names
 * repeat.
 */

export const OWNER_EMAIL_COLUMN = "Email pemegang"

const CORE_EXAMPLES: Record<string, string> = {
  client_company: "PT Arunika Kreasi",
  industry: "Farmasi",
  location: "Jakarta Selatan",
  address: "Jl. Jend. Sudirman Kav. 52-53",
  website: "arunika.co.id",
  contact_salutation: "Bapak",
  contact_name: "Nofri Ardian",
  contact_job_title: "GM Procurement",
  contact_division: "Procurement",
  contact_phone: "081234567890",
  contact_email: "nofri@arunika.co.id",
  notes: "Dapat dari pameran Jakarta Fair",
}

function exampleForCustomField(field: FormField): string {
  switch (field.fieldType) {
    case "DATE": return "2026-09-15"
    case "TIME": return "09:30"
    case "NUMBER": return "12"
    case "CURRENCY": return "15000000"
    case "BOOLEAN": return "ya"
    case "SELECT": return field.options[0] ?? ""
    case "MULTI_SELECT": return field.options.slice(0, 2).join(", ")
    default: return ""
  }
}

/** Columns for the template and the parser, in the admin's order. */
export function buildProspectColumns(fields: FormField[]): ImportColumn[] {
  const columns: ImportColumn[] = []
  for (const field of visibleFields(fields)) {
    if (isAttachmentType(field.fieldType)) continue
    if (field.reportingKey === "owner") {
      columns.push({ header: OWNER_EMAIL_COLUMN, key: "owner_email", required: field.isRequired, example: "yulia@werkudara.com" })
      continue
    }
    columns.push({
      header: field.label,
      key: field.reportingKey,
      required: field.isRequired,
      example: field.isCore ? CORE_EXAMPLES[field.reportingKey] ?? "" : exampleForCustomField(field),
      options: field.options.length > 0 ? field.options : undefined,
      allowOther: field.allowOther || undefined,
    })
  }
  return columns
}

export interface ParsedProspect {
  row: number
  clientCompanyName: string
  industry: string
  location: string
  address: string
  website: string
  contactSalutation: string
  contactName: string
  contactJobTitle: string
  contactDivision: string
  /** E.164 when present. */
  contactPhone: string
  contactEmail: string
  notes: string
  ownerEmail: string
  /** Answers to the admin's custom fields, by reporting key. */
  custom: Record<string, FieldAnswer>
}

/** Same normalisation as the generated columns in the database. */
export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRUTHY = new Set(["ya", "yes", "true", "1", "y"])

export function parseProspectRow(
  raw: RawRow,
  rowNumber: number,
  options: { columns: ImportColumn[]; fields: FormField[]; salutations: string[] }
): { row: ParsedProspect; issues: RowIssue[] } {
  const issues: RowIssue[] = []
  const fail = (column: string, message: string) => issues.push({ row: rowNumber, column, message })

  // Headers may arrive with the " *" required marker stripped or not, and in
  // any case; match loosely on the header text.
  const cell = (header: string) => {
    const found = Object.keys(raw).find((item) => item.replace(/\s*\*\s*$/, "").trim().toLowerCase() === header.toLowerCase())
    return found ? String(raw[found] ?? "").trim() : ""
  }
  const columnOf = (key: string) => options.columns.find((item) => item.key === key)
  const get = (key: string) => {
    const column = columnOf(key)
    return column ? cell(column.header) : ""
  }
  const headerOf = (key: string, fallback: string) => columnOf(key)?.header ?? fallback

  const clientCompanyName = get("client_company")
  if (!clientCompanyName) fail(headerOf("client_company", "Perusahaan"), "Nama perusahaan wajib diisi.")

  const rawPhone = get("contact_phone")
  let contactPhone = ""
  if (rawPhone) {
    if (!isValidPhone(rawPhone)) fail(headerOf("contact_phone", "Telepon"), `"${rawPhone}" bukan nomor telepon yang valid.`)
    else contactPhone = normalizePhone(rawPhone)
  }

  const contactEmail = get("contact_email").toLowerCase()
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    fail(headerOf("contact_email", "Email"), `"${contactEmail}" bukan alamat email yang valid.`)
  }

  const ownerEmail = get("owner_email").toLowerCase()
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    fail(OWNER_EMAIL_COLUMN, `"${ownerEmail}" bukan alamat email yang valid.`)
  }

  const contactSalutation = get("contact_salutation")
  if (contactSalutation && !options.salutations.some((item) => item.toLowerCase() === contactSalutation.toLowerCase())) {
    fail(headerOf("contact_salutation", "Sapaan"), `"${contactSalutation}" tidak ada dalam daftar sapaan.`)
  }

  let website = get("website")
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`

  // A core column with a configured list (Industri) only accepts what is on
  // it, matched loosely on case and written back the way the list spells it.
  const listed = (key: string): string => {
    const column = columnOf(key)
    const value = get(key)
    if (!value || !column?.options) return value
    const match = column.options.find((option) => option.toLowerCase() === value.toLowerCase())
    if (!match && !column.allowOther) fail(column.header, `"${value}" bukan pilihan yang ada. Lihat sheet "Pilihan".`)
    return match ?? value
  }
  const industry = listed("industry")

  // Required is whatever the admin configured. The company is reported above
  // with its own wording, so it is skipped here.
  for (const column of options.columns) {
    if (!column.required || column.key === "client_company") continue
    if (!cell(column.header)) fail(column.header, `${column.header} wajib diisi.`)
  }

  const custom: Record<string, FieldAnswer> = {}
  for (const field of visibleFields(options.fields)) {
    if (field.isCore || isAttachmentType(field.fieldType)) continue
    const value = cell(field.label)
    if (!value) continue

    if (field.fieldType === "MULTI_SELECT") {
      const picked = splitList(value)
      const unknown = picked.filter((item) => !field.options.includes(item))
      if (unknown.length > 0 && !field.allowOther) fail(field.label, `Pilihan tidak dikenal: ${unknown.join(", ")}.`)
      custom[field.reportingKey] = picked
    } else if (field.fieldType === "BOOLEAN") {
      custom[field.reportingKey] = TRUTHY.has(value.toLowerCase())
    } else if (field.fieldType === "SELECT") {
      if (!field.options.includes(value) && !field.allowOther) fail(field.label, `"${value}" bukan pilihan yang ada.`)
      custom[field.reportingKey] = value
    } else if (field.fieldType === "DATE") {
      custom[field.reportingKey] = normaliseDate(value)
    } else if (field.fieldType === "TIME") {
      custom[field.reportingKey] = normaliseTime(value)
    } else if (field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") {
      // Typed the Indonesian way ("15.000.000") or the sheet's way (15000000).
      const numeric = parseNumber(value)
      if (numeric === null) fail(field.label, `"${value}" bukan angka.`)
      else custom[field.reportingKey] = numeric
    } else {
      custom[field.reportingKey] = value
    }
  }

  return {
    row: {
      row: rowNumber,
      clientCompanyName,
      industry,
      location: get("location"),
      address: get("address"),
      website,
      contactSalutation: options.salutations.find((item) => item.toLowerCase() === contactSalutation.toLowerCase()) ?? contactSalutation,
      contactName: get("contact_name"),
      contactJobTitle: get("contact_job_title"),
      contactDivision: get("contact_division"),
      contactPhone,
      contactEmail,
      notes: get("notes"),
      ownerEmail,
      custom,
    },
    issues,
  }
}

/** The two keys a prospect is matched on: the phone, and the company+contact pair. */
export function dedupeKeys(row: { clientCompanyName: string; contactName: string; contactPhone: string }): { phone: string | null; pair: string } {
  return {
    phone: row.contactPhone ? normalizePhone(row.contactPhone) : null,
    pair: `${normaliseName(row.clientCompanyName)}|${normaliseName(row.contactName)}`,
  }
}

/** Rows that repeat an earlier row of the same file, by either key. */
export function findInFileDuplicates(rows: ParsedProspect[]): RowIssue[] {
  const issues: RowIssue[] = []
  const seenPhone = new Map<string, number>()
  const seenPair = new Map<string, number>()
  for (const row of rows) {
    const keys = dedupeKeys(row)
    if (keys.phone) {
      const earlier = seenPhone.get(keys.phone)
      if (earlier) {
        issues.push({ row: row.row, column: "Telepon", message: `Nomor yang sama dengan baris ${earlier}.` })
        continue
      }
      seenPhone.set(keys.phone, row.row)
    }
    if (row.contactName) {
      const earlier = seenPair.get(keys.pair)
      if (earlier) {
        issues.push({ row: row.row, column: "Perusahaan", message: `Perusahaan dan kontak yang sama dengan baris ${earlier}.` })
        continue
      }
      seenPair.set(keys.pair, row.row)
    }
  }
  return issues
}

export interface DedupeMatch {
  matchKey: string
  clientCompanyName: string
  contactName: string | null
}

/** Rows already present in the list, by either key. */
export function findExistingDuplicates(rows: ParsedProspect[], matches: DedupeMatch[]): RowIssue[] {
  if (matches.length === 0) return []
  const byKey = new Map(matches.map((match) => [match.matchKey, match]))
  const issues: RowIssue[] = []
  for (const row of rows) {
    const keys = dedupeKeys(row)
    const hit = (keys.phone && byKey.get(keys.phone)) || (row.contactName ? byKey.get(keys.pair) : undefined)
    if (hit) {
      const who = [hit.clientCompanyName, hit.contactName].filter(Boolean).join(" · ")
      issues.push({ row: row.row, column: "Perusahaan", message: `Sudah ada di daftar prospek: ${who}.` })
    }
  }
  return issues
}
