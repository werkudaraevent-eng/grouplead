import type { AttachmentKind } from "@/lib/attachments/attachment-request"
import { audioDownloadName, parseAudioAnswer } from "@/lib/audio/audio-answer"
import { FOLLOW_UP_STATE_LABELS, followUpState, type FollowUpStatus } from "@/lib/missions/follow-ups"
import { isAttachmentType, visibleFields, type FieldType, type FormField } from "@/lib/missions/form-fields"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { labelOf, type ChoiceSet } from "@/lib/missions/report-choices"
import { statusLabel } from "@/lib/missions/status-labels"
import type { ReportStatus } from "@/lib/missions/visit-report-schema"
import { paths } from "@/lib/paths"
import { parsePhotoAnswer } from "@/lib/photos/photo-answer"

/**
 * The visit-report export, as rows.
 *
 * An export carries the whole record, not a summary of it: the rep answered a
 * form, so the file's columns are that form's columns, in the admin's order,
 * with the admin's labels and the tenant's own choice labels — the same idiom
 * the mission export already uses (`mission-io.ts`). A header the admin does
 * not recognise is a column nobody can act on.
 *
 * Everything here is pure. The file that lands on someone's desk is the one
 * artefact of this app nobody can check against the screen, so how a cell is
 * written is decided by functions a test can hold still: the query layer
 * fetches, this builds.
 *
 * The people met are numbered column groups on the report's own row — "Kontak
 * 1 · Nama", "Kontak 1 · Telepon", then "Kontak 2 · …" — as many groups as the
 * widest report in the export, so the row stays one row and every fact is a
 * cell that can be filtered and sorted. The lists that cannot be spread that
 * way keep their own sheet: Kontak for one row per person met, Catatan
 * pendukung for what the rest of the team wrote.
 *
 * Photos and recordings are numbered columns the same way — "Foto bukti
 * kunjungan 1", "Foto bukti kunjungan 2" — because a spreadsheet cell holds
 * one hyperlink: each cell shows the file's name and links to it through the
 * app (`paths.attachment`), an address that never expires and asks for a
 * login. The links ride beside the text (`laporanLinks`), so the workbook
 * writes them as hyperlinks and CSV, which cannot, writes the address after
 * the name (`csvRows`).
 */

/** The visit-report form field whose answer the actual-time columns already carry. */
const TIME_FIELD_KEY = "visit_time"

/** The visit-report form field that answers with people rather than a value. */
const CONTACTS_FIELD_KEY = "contacts_met"

/**
 * What is written about one person met, one fact per column.
 *
 * Fixed Indonesian rather than the field's label: these are not the field's
 * answer, they are the columns that answer stands for, so renaming "Ketemu
 * siapa" leaves them alone.
 */
const CONTACT_GROUP_COLUMNS = [
  "Nama",
  "Jabatan",
  "Telepon",
  "Email",
  "Pengambil keputusan",
  "DISC",
  "Catatan DISC",
]

export interface ExportContact {
  fullName: string
  jobTitle: string | null
  phone: string | null
  email: string | null
  isDecisionMaker: boolean
  discPrimary: string | null
  discSecondary: string | null
  discNote: string | null
  discAssessedByName: string | null
  discAssessedAt: string | null
}

export interface ExportSupportingNote {
  authorName: string | null
  note: string
  createdAt: string
}

/** What the export needs of a tracked follow-up: enough for one word about it. */
export interface ExportFollowUp {
  status: FollowUpStatus
  dueDate: string | null
}

/** One report, with everything hanging off it already resolved to names and values. */
export interface ReportExportRow {
  reportId: string
  missionId: string
  clientCompanyName: string
  missionType: string
  scheduledStart: string | null
  scheduledEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  location: string | null
  address: string | null
  industry: string | null
  objective: string | null
  primarySalesName: string | null
  supportingSalesNames: string[]
  status: ReportStatus
  visitOutcome: string | null
  meetingSummary: string | null
  clientNeeds: string[]
  productInterest: string[]
  interestLevel: string | null
  opportunityExists: boolean
  estimatedValue: number | null
  competitorMentioned: string | null
  nextActionType: string | null
  nextActionOwnerName: string | null
  followUpDate: string | null
  /** Answers to every field that answers through `report_field_values`, keyed by reporting key. */
  custom: Record<string, unknown>
  contacts: ExportContact[]
  clarificationNote: string | null
  supportingNotes: ExportSupportingNote[]
  pushedLeadId: string | null
  pushedCategory: string | null
  followUp: ExportFollowUp | null
  submittedByName: string | null
  submittedAt: string | null
}

export interface ReportExportOptions {
  /** Where the app is served from, so the record and file links are absolute and work from a file. */
  origin: string
  /** Today in mission time, so an overdue follow-up reads as late. Optional. */
  today?: string
}

/** A hyperlink on one cell. */
export interface ExportLink {
  /** The absolute address the cell opens. */
  target: string
  /** What Excel shows on hover in place of the address. */
  tooltip: string
}

export interface ReportExportSheets {
  laporan: string[][]
  /**
   * The links on Laporan, cell for cell: `laporanLinks[row][column]` belongs
   * to `laporan[row][column]` (row 0 is the header), null where the cell is
   * plain text. Same shape as `laporan`, so neither the numeric typing nor
   * CSV has to know links exist.
   */
  laporanLinks: (ExportLink | null)[][]
  kontak: string[][]
  catatan: string[][]
  /** Headers whose cells are numbers, so the workbook types them instead of writing text. */
  numericColumns: Set<string>
}

/** One file of a photo or recording answer, as the export names and links it. */
export interface ExportFile {
  kind: AttachmentKind
  path: string
  name: string
}

/** A Laporan cell: its text, and the link it opens when it has one. */
interface ExportCell {
  text: string
  link: ExportLink | null
}

const plain = (text: string): ExportCell => ({ text, link: null })

/** The activity's own facts, before the form's own columns. */
const ACTIVITY_COLUMNS = [
  "Perusahaan",
  "Jenis aktivitas",
  "Tanggal jadwal",
  "Jam mulai jadwal",
  "Jam selesai jadwal",
  "Tanggal kunjungan",
  "Jam mulai kunjungan",
  "Jam selesai kunjungan",
  "Lokasi",
  "Alamat",
  "Industri",
  "Tujuan",
  "Sales utama",
  "Sales pendukung",
  "Status laporan",
]

/** What happened to the report after it was written, and where to find it again. */
const TRAIL_COLUMNS = [
  "Catatan klarifikasi",
  "Catatan pendukung",
  "Dikirim ke Group Lead",
  "Kategori lead",
  "ID lead Group Lead",
  "Tindak lanjut",
  "Dikirim oleh",
  "Tanggal dikirim",
  "Jam dikirim",
  "Tautan laporan",
  "ID aktivitas",
  "ID laporan",
]

export const CONTACT_COLUMNS = [
  "Perusahaan",
  "Tanggal kunjungan",
  "Sales utama",
  "Nama",
  "Jabatan",
  "Telepon",
  "Email",
  "Pengambil keputusan",
  "DISC utama",
  "DISC sekunder",
  "Catatan DISC",
  "Dinilai oleh",
  "Dinilai pada",
  "ID laporan",
]

export const NOTE_COLUMNS = [
  "Perusahaan",
  "Tanggal kunjungan",
  "Penulis",
  "Catatan",
  "Ditulis pada",
  "ID aktivitas",
]

// WIB, like every other time this product writes down. A file opened in
// Jakarta that says a visit began at 02:30 is a file nobody trusts again.
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE })
const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: MISSION_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

function instant(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** A timestamp as its mission-time day, `YYYY-MM-DD`. Empty when there is none. */
export function wibDay(value: string | null | undefined): string {
  const date = instant(value)
  return date ? DAY_FORMAT.format(date) : ""
}

/** A timestamp as its mission-time clock, `HH:mm`. Empty when there is none. */
export function wibTime(value: string | null | undefined): string {
  const date = instant(value)
  return date ? TIME_FORMAT.format(date) : ""
}

/** A timestamp as day and clock in one cell, for a column that is not split. */
export function wibMoment(value: string | null | undefined): string {
  const date = instant(value)
  return date ? `${DAY_FORMAT.format(date)} ${TIME_FORMAT.format(date)}` : ""
}

const yesNo = (value: boolean): string => (value ? "Ya" : "Tidak")

const text = (value: string | null | undefined): string => value ?? ""

const joined = (values: string[] | null | undefined): string => (values ?? []).filter(Boolean).join(", ")

const numberCell = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? "" : String(value)

/** The headers of `count` numbered groups: "Kontak 1 · Nama" … "Kontak 3 · Catatan DISC". */
export function contactGroupHeaders(count: number): string[] {
  const headers: string[] = []
  for (let number = 1; number <= count; number += 1) {
    for (const column of CONTACT_GROUP_COLUMNS) headers.push(`Kontak ${number} · ${column}`)
  }
  return headers
}

/** A DISC reading in one cell: the primary letter, the secondary behind a slash. */
function discCell(contact: ExportContact): string {
  if (!contact.discPrimary) return ""
  return contact.discSecondary ? `${contact.discPrimary}/${contact.discSecondary}` : contact.discPrimary
}

/**
 * One person's cells, in the group's order.
 *
 * A slot nobody stood in is written as empty cells rather than skipped: the
 * grid stays rectangular, which is what lets the column be sorted at all.
 */
export function contactCells(contact: ExportContact | undefined): string[] {
  if (!contact) return CONTACT_GROUP_COLUMNS.map(() => "")
  return [
    contact.fullName,
    text(contact.jobTitle),
    text(contact.phone),
    text(contact.email),
    yesNo(contact.isDecisionMaker),
    discCell(contact),
    text(contact.discNote),
  ]
}

/** The files of one photo or recording answer, in the order the rep attached them. */
export function attachmentFiles(fieldType: FieldType, value: unknown): ExportFile[] {
  if (value === null || value === undefined) return []
  if (fieldType === "AUDIO") {
    return parseAudioAnswer(value).map((item) => ({ kind: "rekaman", path: item.path, name: item.name }))
  }
  return parsePhotoAnswer(value).map((item) => ({ kind: "foto", path: item.path, name: item.name }))
}

/**
 * How many numbered columns an attachment field gets: as many as the most
 * files any report in this export has for it, and never fewer than one, so
 * the header exists even when nobody attached anything.
 */
export function attachmentColumnCount(rows: ReportExportRow[], field: FormField): number {
  let count = 1
  for (const row of rows) count = Math.max(count, attachmentFiles(field.fieldType, row.custom[field.reportingKey]).length)
  return count
}

/** The headers of an attachment field's columns: "Foto bukti kunjungan 1" … "Foto bukti kunjungan 3". */
export function attachmentHeaders(label: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${label} ${index + 1}`)
}

/**
 * The permanent link to one file, through the app: never expires, always asks
 * who is opening it. The file itself opens on storage's address once the app
 * has let the person through, so the tooltip names the sign-in, not a place.
 */
export function attachmentLink(origin: string, file: ExportFile): ExportLink {
  return {
    target: `${origin}${paths.attachment(file.kind, file.path)}`,
    tooltip: file.kind === "rekaman" ? "Unduh rekaman (perlu masuk ke Sales Activity)" : "Buka foto (perlu masuk ke Sales Activity)",
  }
}

/**
 * What a file cell says: the name the rep's phone gave the file. Without one,
 * a recording says the name it downloads under ("rekaman.m4a"), so the cell
 * and the file agree, and a photo the stored file's own name.
 */
function fileLabel(file: ExportFile): string {
  if (file.name.trim()) return file.name
  return file.kind === "rekaman" ? audioDownloadName(file) : file.path.slice(file.path.lastIndexOf("/") + 1)
}

/**
 * One attachment answer as `count` cells: a file per cell, named and linked,
 * in the order attached, then empty cells, so the grid stays rectangular.
 */
function attachmentCells(files: ExportFile[], count: number, origin: string): ExportCell[] {
  return Array.from({ length: count }, (_, index) => {
    const file = files[index]
    return file ? { text: fileLabel(file), link: attachmentLink(origin, file) } : plain("")
  })
}

/** A custom answer as the tenant's field type says to read it. Attachments are their own columns. */
function customCell(field: FormField, value: unknown): string {
  if (value === null || value === undefined) return ""

  switch (field.fieldType) {
    case "BOOLEAN":
      return yesNo(value === true || value === "true")
    case "MULTI_SELECT":
      return Array.isArray(value) ? value.map(String).filter(Boolean).join(", ") : String(value)
    case "NUMBER":
    case "CURRENCY": {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? String(parsed) : String(value)
    }
    default:
      return typeof value === "string" ? value : String(value)
  }
}

/**
 * A core report field's answer.
 *
 * Keyed by `reportingKey` rather than by label, because the key is frozen at
 * creation and the label is the admin's to change: a tenant who renamed "Hasil
 * kunjungan" to "Hasil" still gets the outcome in that column.
 *
 * Returns null for a core key with no column of its own, so the caller falls
 * back to the stored answer — which is how any core field added later is
 * carried without a change here. The core photo and recording fields never
 * reach this: they are numbered columns of their own.
 */
function coreCell(field: FormField, row: ReportExportRow, choices: ChoiceSet | null): string | null {
  switch (field.reportingKey) {
    case "visit_outcome":
      return labelOf(choices, "visit_outcome", row.visitOutcome)
    case "meeting_summary":
      return text(row.meetingSummary)
    case "client_needs":
      return joined(row.clientNeeds)
    case "product_interest":
      return joined(row.productInterest)
    case "interest_level":
      return labelOf(choices, "interest_level", row.interestLevel)
    case "opportunity_exists":
      return yesNo(row.opportunityExists)
    case "estimated_value":
      return numberCell(row.estimatedValue)
    case "competitor_mentioned":
      return text(row.competitorMentioned)
    case "next_action_type":
      return labelOf(choices, "next_action_type", row.nextActionType)
    case "next_action_owner":
      return text(row.nextActionOwnerName)
    case "follow_up_date":
      return text(row.followUpDate)
    default:
      return null
  }
}

/** The supporting notes of one visit, one per line, each said by its author. */
function supportingNotesCell(notes: ExportSupportingNote[]): string {
  return notes
    .map((note) => (note.authorName ? `${note.authorName}: ${note.note}` : note.note))
    .join("\n")
}

function followUpCell(followUp: ExportFollowUp | null, today: string): string {
  if (!followUp) return ""
  return FOLLOW_UP_STATE_LABELS[followUpState({ status: followUp.status, dueDate: followUp.dueDate }, today)]
}

/**
 * The Laporan sheet for CSV, which cannot hold a link: a cell whose text is
 * not its own address carries the address after a middle dot ("depan.jpg ·
 * https://…/workspace/lampiran?…"), so a machine reading the file still has
 * it; a cell that already is its address (Tautan laporan) stays as it is.
 */
export function csvRows(sheet: string[][], links: (ExportLink | null)[][]): string[][] {
  return sheet.map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const link = links[rowIndex]?.[columnIndex]
      return link && link.target !== cell ? `${cell} · ${link.target}` : cell
    })
  )
}

/** How one form field is spread across the Laporan sheet's columns. */
type FormColumns =
  | { field: FormField; kind: "contacts"; headers: string[]; count: number }
  | { field: FormField; kind: "attachment"; headers: string[]; count: number }
  | { field: FormField; kind: "value"; headers: string[] }

/**
 * The export's three sheets, header row first.
 *
 * Column order is: what the activity was, then the report form as the admin
 * arranged it, then what became of the report. "Waktu kunjungan" is dropped
 * from the middle because the activity block already carries the reported
 * start and end as their own day and clock columns, and a second rendering of
 * the same answer is a column people reconcile instead of read. "Ketemu
 * siapa" becomes the numbered contact groups and each photo or recording
 * field its numbered file columns, in the place the admin gave the field, so
 * reordering the field moves the whole block of columns with it.
 */
export function buildReportExport(
  rows: ReportExportRow[],
  fields: FormField[],
  choices: ChoiceSet | null,
  options: ReportExportOptions
): ReportExportSheets {
  const shown = visibleFields(fields).filter((field) => field.reportingKey !== TIME_FIELD_KEY)
  const today = options.today ?? ""

  // As many groups (and file columns) as the widest report, and never fewer
  // than one: a header that appears only when somebody was met, or a photo
  // attached, is a file whose shape moves.
  let contactGroups = 1
  for (const row of rows) contactGroups = Math.max(contactGroups, row.contacts.length)

  const form: FormColumns[] = shown.map((field) => {
    if (field.reportingKey === CONTACTS_FIELD_KEY) {
      return { field, kind: "contacts", headers: contactGroupHeaders(contactGroups), count: contactGroups }
    }
    if (isAttachmentType(field.fieldType)) {
      const count = attachmentColumnCount(rows, field)
      return { field, kind: "attachment", headers: attachmentHeaders(field.label, count), count }
    }
    return { field, kind: "value", headers: [field.label] }
  })

  // Typing is by header name, so a field renamed onto a generated header (a
  // contact's, a file's) would turn that person's phone number into a number
  // and eat its leading zero.
  const generatedHeaders = new Set(form.flatMap((column) => (column.kind === "value" ? [] : column.headers)))
  const numericColumns = new Set<string>()
  for (const column of form) {
    if (column.kind !== "value" || generatedHeaders.has(column.field.label)) continue
    if (column.field.fieldType === "NUMBER" || column.field.fieldType === "CURRENCY") numericColumns.add(column.field.label)
  }

  const header = [...ACTIVITY_COLUMNS, ...form.flatMap((column) => column.headers), ...TRAIL_COLUMNS]

  const laporan: string[][] = [header]
  const laporanLinks: (ExportLink | null)[][] = [header.map(() => null)]
  const kontak: string[][] = [CONTACT_COLUMNS]
  const catatan: string[][] = [NOTE_COLUMNS]

  for (const row of rows) {
    const visitDay = wibDay(row.actualStart)

    const answers = form.flatMap((column): ExportCell[] => {
      const { field } = column
      switch (column.kind) {
        // The people met are not one answer but one group of columns per
        // person, written where the admin put the field.
        case "contacts":
          return Array.from({ length: column.count }, (_, index) => contactCells(row.contacts[index])).flat().map(plain)
        case "attachment":
          return attachmentCells(attachmentFiles(field.fieldType, row.custom[field.reportingKey]), column.count, options.origin)
        default: {
          const core = field.isCore ? coreCell(field, row, choices) : null
          return [plain(core ?? customCell(field, row.custom[field.reportingKey]))]
        }
      }
    })

    // The durable road back to the record: its own address, shown and linked.
    const reportUrl = `${options.origin}${paths.activity(row.missionId, { fokus: "laporan" })}`

    const cells: ExportCell[] = [
      ...[
        row.clientCompanyName,
        row.missionType,
        wibDay(row.scheduledStart),
        wibTime(row.scheduledStart),
        wibTime(row.scheduledEnd),
        visitDay,
        wibTime(row.actualStart),
        wibTime(row.actualEnd),
        text(row.location),
        text(row.address),
        text(row.industry),
        text(row.objective),
        text(row.primarySalesName),
        joined(row.supportingSalesNames),
        statusLabel(row.status),
      ].map(plain),
      ...answers,
      ...[
        text(row.clarificationNote),
        supportingNotesCell(row.supportingNotes),
        yesNo(row.pushedLeadId !== null),
        text(row.pushedCategory),
        text(row.pushedLeadId),
        followUpCell(row.followUp, today),
        text(row.submittedByName),
        wibDay(row.submittedAt),
        wibTime(row.submittedAt),
      ].map(plain),
      { text: reportUrl, link: { target: reportUrl, tooltip: "Buka laporan di Sales Activity (perlu masuk)" } },
      plain(row.missionId),
      plain(row.reportId),
    ]

    laporan.push(cells.map((cell) => cell.text))
    laporanLinks.push(cells.map((cell) => cell.link))

    for (const contact of row.contacts) {
      kontak.push([
        row.clientCompanyName,
        visitDay,
        text(row.primarySalesName),
        contact.fullName,
        text(contact.jobTitle),
        text(contact.phone),
        text(contact.email),
        yesNo(contact.isDecisionMaker),
        text(contact.discPrimary),
        text(contact.discSecondary),
        text(contact.discNote),
        text(contact.discAssessedByName),
        wibMoment(contact.discAssessedAt),
        row.reportId,
      ])
    }

    for (const note of row.supportingNotes) {
      catatan.push([
        row.clientCompanyName,
        visitDay,
        text(note.authorName),
        note.note,
        wibMoment(note.createdAt),
        row.missionId,
      ])
    }
  }

  return { laporan, laporanLinks, kontak, catatan, numericColumns }
}
