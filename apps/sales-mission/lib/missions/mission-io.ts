import { visibleFields, type FormField } from "./form-fields"
import { MISSION_TIME_ZONE, type MissionListItem } from "./mission-schema"

/**
 * Spreadsheet shape for importing and exporting missions.
 *
 * Everything here is pure so the columns the template offers, the columns the
 * export writes, and the columns the importer accepts are all derived from one
 * place. A template that drifts from the parser is worse than no template: it
 * teaches people a format the system then rejects.
 *
 * The column set is built from the tenant's own field configuration rather than
 * hardcoded, because an admin can rename "Jenis mission", reorder it, make it
 * optional, or add fields of their own. A static template would be wrong for
 * every tenant that touched the settings screen.
 */

/** Sales are matched by email. Names repeat; this CRM has three "Dimas". */
export const SALES_EMAIL_COLUMN = "Email sales utama"
export const SUPPORTING_EMAILS_COLUMN = "Email sales pendukung"

export interface ImportColumn {
  /** Header text written to the sheet and matched on read. */
  header: string
  /** Which mission field this fills, or a synthetic key for the sales columns. */
  key: string
  required: boolean
  example: string
  /** Fixed set of accepted values, listed on the options sheet. */
  options?: string[]
}

const CORE_EXAMPLES: Record<string, string> = {
  client_company: "PT Arunika Kreasi",
  mission_type: "Meeting",
  location: "Jakarta Selatan",
  date: "2026-09-15",
  start_time: "09:30",
  end_time: "11:00",
  objective: "Presentasi awal dan pemetaan kebutuhan",
  contact_salutation: "Bapak",
  contact_name: "Nofri Ardian",
  contact_job_title: "GM Procurement",
  contact_division: "Procurement",
  contact_phone: "081234567890",
  contact_email: "nofri@arunika.co.id",
  building: "Menara BCA lt. 21",
  appointment_notes: "Klien minta contoh rundown dan estimasi biaya.",
}

/**
 * Columns for the template, the export, and the parser.
 *
 * `primary_sales` and `supporting_sales` are replaced by email columns: an
 * import cannot resolve "Yulia" to a user id, and picking the wrong Yulia
 * assigns a real visit to the wrong person.
 */
export function buildImportColumns(fields: FormField[]): ImportColumn[] {
  const columns: ImportColumn[] = []

  for (const field of visibleFields(fields)) {
    if (field.reportingKey === "primary_sales") {
      columns.push({
        header: SALES_EMAIL_COLUMN,
        key: "primary_sales",
        required: true,
        example: "yulia@werkudara.com",
      })
      continue
    }

    if (field.reportingKey === "supporting_sales") {
      columns.push({
        header: SUPPORTING_EMAILS_COLUMN,
        key: "supporting_sales",
        required: false,
        example: "budi@werkudara.com, sari@werkudara.com",
      })
      continue
    }

    columns.push({
      header: field.label,
      key: field.reportingKey,
      required: field.isRequired,
      example: field.isCore
        ? CORE_EXAMPLES[field.reportingKey] ?? ""
        : exampleForCustomField(field),
      options: field.options.length > 0 ? field.options : undefined,
    })
  }

  return columns
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

/** A cell as read from the sheet, already coerced to a trimmed string. */
export type RawRow = Record<string, string>

export interface RowIssue {
  /** 1-based row number as the user sees it in Excel, header included. */
  row: number
  column: string
  message: string
}

export interface ParsedRow {
  row: number
  clientCompanyName: string
  missionType: string
  date: string
  startTime: string
  endTime: string
  location: string
  objective: string
  primarySalesEmail: string
  supportingSalesEmails: string[]
  contactSalutation: string
  contactName: string
  contactJobTitle: string
  contactDivision: string
  contactPhone: string
  contactEmail: string
  building: string
  appointmentNotes: string
  custom: Record<string, string | string[] | boolean>
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Excel serial dates and "15/09/2026" both reach us; normalise to ISO. */
export function normaliseDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (DATE_PATTERN.test(trimmed)) return trimmed

  // Excel serial: days since 1899-12-30, which is what SheetJS emits for a
  // date cell read as raw. Converted in UTC then read back as a plain date, so
  // the server's timezone cannot shift it by a day.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (serial > 0 && serial < 100000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000)
      return new Date(ms).toISOString().slice(0, 10)
    }
  }

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  return trimmed
}

/** "9:30", "09.30" and Excel's 0.395 fraction all mean the same thing. */
export function normaliseTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (TIME_PATTERN.test(trimmed)) return trimmed

  // Excel time cell: a fraction of a day. Tested BEFORE the h:mm shape, because
  // "0.395833" also matches `(\d{1,2})[.](\d{2})` and would read as 00:39.
  if (/^0?\.\d+$/.test(trimmed)) {
    const minutes = Math.round(Number(trimmed) * 24 * 60)
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  const parts = trimmed.match(/^(\d{1,2})[:.](\d{2})$/)
  if (parts) return `${parts[1].padStart(2, "0")}:${parts[2]}`

  return trimmed
}

/** Multi-value cells accept comma, semicolon or newline. */
export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const TRUTHY = new Set(["ya", "yes", "true", "1", "y"])

/**
 * Turn one sheet row into a mission, collecting every problem rather than
 * stopping at the first.
 *
 * A rep fixing an import file wants the whole list of what is wrong, not one
 * error per upload cycle.
 */
export function parseRow(
  raw: RawRow,
  rowNumber: number,
  columns: ImportColumn[],
  fields: FormField[],
  allowedMissionTypes: string[]
): { row: ParsedRow; issues: RowIssue[] } {
  const issues: RowIssue[] = []
  const get = (key: string) => {
    const column = columns.find((item) => item.key === key)
    return column ? (raw[column.header] ?? "").trim() : ""
  }

  const fail = (column: string, message: string) => issues.push({ row: rowNumber, column, message })

  const date = normaliseDate(get("date"))
  const startTime = normaliseTime(get("start_time"))
  const endTime = normaliseTime(get("end_time"))
  const missionType = get("mission_type")
  const primarySalesEmail = get("primary_sales").toLowerCase()

  if (date && !DATE_PATTERN.test(date)) fail("Tanggal", `"${date}" bukan tanggal yang valid. Pakai 2026-09-15.`)
  if (startTime && !TIME_PATTERN.test(startTime)) fail("Jam mulai", `"${startTime}" bukan jam yang valid. Pakai 09:30.`)
  if (endTime && !TIME_PATTERN.test(endTime)) fail("Jam selesai", `"${endTime}" bukan jam yang valid. Pakai 11:00.`)
  if (endTime && startTime && endTime <= startTime) {
    fail("Jam selesai", "Jam selesai harus setelah jam mulai.")
  }

  if (missionType && !allowedMissionTypes.includes(missionType)) {
    fail("Jenis mission", `"${missionType}" bukan pilihan yang ada. Lihat sheet "Pilihan".`)
  }

  if (primarySalesEmail && !EMAIL_PATTERN.test(primarySalesEmail)) {
    fail(SALES_EMAIL_COLUMN, `"${primarySalesEmail}" bukan email yang valid.`)
  }

  const supportingSalesEmails = splitList(get("supporting_sales")).map((item) => item.toLowerCase())
  for (const email of supportingSalesEmails) {
    if (!EMAIL_PATTERN.test(email)) fail(SUPPORTING_EMAILS_COLUMN, `"${email}" bukan email yang valid.`)
  }
  if (primarySalesEmail && supportingSalesEmails.includes(primarySalesEmail)) {
    fail(SUPPORTING_EMAILS_COLUMN, "Sales utama tidak bisa sekaligus jadi sales pendukung.")
  }

  const contactEmail = get("contact_email")
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    fail("Email", `"${contactEmail}" bukan email yang valid.`)
  }

  // The salutation list is the tenant's, carried on the column like any other
  // configured choice, so an import cannot smuggle in a value the form refuses.
  const contactSalutation = get("contact_salutation")
  const salutationColumn = columns.find((column) => column.key === "contact_salutation")
  if (contactSalutation && salutationColumn?.options && !salutationColumn.options.includes(contactSalutation)) {
    fail(salutationColumn.header, `"${contactSalutation}" bukan pilihan yang ada. Lihat sheet "Pilihan".`)
  }

  // Required is whatever the admin configured, so a tenant that made Lokasi
  // mandatory gets it enforced here too.
  for (const column of columns) {
    if (!column.required) continue
    const value = column.key === "date" ? date
      : column.key === "start_time" ? startTime
      : (raw[column.header] ?? "").trim()
    if (!value) fail(column.header, `${column.header} wajib diisi.`)
  }

  const custom: Record<string, string | string[] | boolean> = {}
  for (const field of visibleFields(fields)) {
    if (field.isCore) continue
    const value = (raw[field.label] ?? "").trim()
    if (!value) continue

    if (field.fieldType === "MULTI_SELECT") {
      const picked = splitList(value)
      const unknown = picked.filter((item) => !field.options.includes(item))
      if (unknown.length > 0) fail(field.label, `Pilihan tidak dikenal: ${unknown.join(", ")}.`)
      custom[field.reportingKey] = picked
    } else if (field.fieldType === "BOOLEAN") {
      custom[field.reportingKey] = TRUTHY.has(value.toLowerCase())
    } else if (field.fieldType === "SELECT") {
      if (!field.options.includes(value)) fail(field.label, `"${value}" bukan pilihan yang ada.`)
      custom[field.reportingKey] = value
    } else if (field.fieldType === "DATE") {
      custom[field.reportingKey] = normaliseDate(value)
    } else if (field.fieldType === "TIME") {
      custom[field.reportingKey] = normaliseTime(value)
    } else {
      custom[field.reportingKey] = value
    }
  }

  return {
    row: {
      row: rowNumber,
      clientCompanyName: get("client_company"),
      missionType,
      date,
      startTime,
      endTime,
      location: get("location"),
      objective: get("objective"),
      primarySalesEmail,
      supportingSalesEmails,
      contactSalutation,
      contactName: get("contact_name"),
      contactJobTitle: get("contact_job_title"),
      contactDivision: get("contact_division"),
      contactPhone: get("contact_phone"),
      contactEmail,
      building: get("building"),
      appointmentNotes: get("appointment_notes"),
      custom,
    },
    issues,
  }
}

/** Rows in the same file that schedule the same person twice at once. */
export function findInFileClashes(rows: ParsedRow[]): RowIssue[] {
  const seen = new Map<string, number>()
  const issues: RowIssue[] = []

  for (const row of rows) {
    if (!row.primarySalesEmail || !row.date || !row.startTime) continue
    const key = `${row.primarySalesEmail}|${row.date}|${row.startTime}`
    const first = seen.get(key)
    if (first !== undefined) {
      issues.push({
        row: row.row,
        column: SALES_EMAIL_COLUMN,
        message: `Bentrok dengan baris ${first}: sales dan waktu yang sama.`,
      })
    } else {
      seen.set(key, row.row)
    }
  }

  return issues
}

/** Export rows, in the same column order the template teaches. */
export function toExportRows(
  missions: MissionListItem[],
  columns: ImportColumn[]
): Array<Record<string, string>> {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  })
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE })

  return missions.map((mission) => {
    const start = mission.scheduledStart ? new Date(mission.scheduledStart) : null
    const end = mission.scheduledEnd ? new Date(mission.scheduledEnd) : null

    const value: Record<string, string> = {
      client_company: mission.clientCompanyName,
      mission_type: mission.missionType,
      location: mission.location ?? "",
      date: start ? day.format(start) : "",
      start_time: start ? time.format(start) : "",
      end_time: end ? time.format(end) : "",
      objective: mission.objective ?? "",
      primary_sales: mission.primarySalesName ?? "",
      supporting_sales: mission.supportingSalesNames.join(", "),
      contact_salutation: mission.appointment.salutation ?? "",
      contact_name: mission.appointment.name ?? "",
      contact_job_title: mission.appointment.jobTitle ?? "",
      contact_division: mission.appointment.division ?? "",
      contact_phone: mission.appointment.phone ?? "",
      contact_email: mission.appointment.email ?? "",
      building: mission.appointment.building ?? "",
      appointment_notes: mission.appointment.notes ?? "",
    }

    const row: Record<string, string> = {}
    for (const column of columns) row[column.header] = value[column.key] ?? ""
    // Export-only columns: not something an import may set, but what an
    // audit or a recap is usually after.
    row["Status"] = mission.status
    row["Dibuat oleh"] = mission.createdByName ?? ""
    row["Dibuat pada"] = mission.createdAt
      ? `${day.format(new Date(mission.createdAt))} ${time.format(new Date(mission.createdAt))}`
      : ""
    return row
  })
}
