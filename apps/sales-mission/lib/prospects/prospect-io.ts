import { normalizePhone, isValidPhone } from "@/lib/format/phone"
import type { ImportColumn, RawRow, RowIssue } from "@/lib/missions/mission-io"

/**
 * Spreadsheet shape for importing prospects.
 *
 * Static columns, unlike the mission import: a prospect is the same twelve
 * facts for every tenant. The one variable is who holds it, matched by
 * email like the mission import matches sales, because names repeat.
 */

export const OWNER_EMAIL_COLUMN = "Email pemegang"

export const PROSPECT_COLUMNS: ImportColumn[] = [
  { header: "Perusahaan", key: "client_company", required: true, example: "PT Arunika Kreasi" },
  { header: "Industri", key: "industry", required: false, example: "Farmasi" },
  { header: "Kota", key: "location", required: false, example: "Jakarta Selatan" },
  { header: "Alamat", key: "address", required: false, example: "Jl. Jend. Sudirman Kav. 52-53" },
  { header: "Website", key: "website", required: false, example: "arunika.co.id" },
  { header: "Sapaan", key: "contact_salutation", required: false, example: "Bapak" },
  { header: "Nama kontak", key: "contact_name", required: false, example: "Nofri Ardian" },
  { header: "Jabatan", key: "contact_job_title", required: false, example: "GM Procurement" },
  { header: "Divisi", key: "contact_division", required: false, example: "Procurement" },
  { header: "Telepon", key: "contact_phone", required: false, example: "081234567890" },
  { header: "Email", key: "contact_email", required: false, example: "nofri@arunika.co.id" },
  { header: "Catatan", key: "notes", required: false, example: "Dapat dari pameran Jakarta Fair" },
  { header: OWNER_EMAIL_COLUMN, key: "owner_email", required: false, example: "yulia@werkudara.com" },
]

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
}

/** Same normalisation as the generated columns in the database. */
export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseProspectRow(
  raw: RawRow,
  rowNumber: number,
  options: { salutations: string[] }
): { row: ParsedProspect; issues: RowIssue[] } {
  const issues: RowIssue[] = []
  const get = (key: string) => {
    const column = PROSPECT_COLUMNS.find((item) => item.key === key)
    if (!column) return ""
    // Headers may arrive with the " *" required marker stripped or not, and
    // in any case; match loosely on the header text.
    const found = Object.keys(raw).find((header) => header.replace(/\s*\*\s*$/, "").trim().toLowerCase() === column.header.toLowerCase())
    return found ? String(raw[found] ?? "").trim() : ""
  }

  const clientCompanyName = get("client_company")
  if (!clientCompanyName) issues.push({ row: rowNumber, column: "Perusahaan", message: "Nama perusahaan wajib diisi." })

  const rawPhone = get("contact_phone")
  let contactPhone = ""
  if (rawPhone) {
    if (!isValidPhone(rawPhone)) issues.push({ row: rowNumber, column: "Telepon", message: `"${rawPhone}" bukan nomor telepon yang valid.` })
    else contactPhone = normalizePhone(rawPhone)
  }

  const contactEmail = get("contact_email").toLowerCase()
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    issues.push({ row: rowNumber, column: "Email", message: `"${contactEmail}" bukan alamat email yang valid.` })
  }

  const ownerEmail = get("owner_email").toLowerCase()
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    issues.push({ row: rowNumber, column: OWNER_EMAIL_COLUMN, message: `"${ownerEmail}" bukan alamat email yang valid.` })
  }

  const contactSalutation = get("contact_salutation")
  if (contactSalutation && !options.salutations.some((item) => item.toLowerCase() === contactSalutation.toLowerCase())) {
    issues.push({ row: rowNumber, column: "Sapaan", message: `"${contactSalutation}" tidak ada dalam daftar sapaan.` })
  }

  let website = get("website")
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`

  return {
    row: {
      row: rowNumber,
      clientCompanyName,
      industry: get("industry"),
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
