import { parseAudioAnswer } from "@/lib/audio/audio-answer"
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
 * Two things a single row cannot hold get their own sheet: the people met and
 * the supporting notes are lists per report, and flattening a list into a
 * column either truncates it or turns the file into a ragged grid.
 */

/** How long an attachment link in an export stays valid: a working week plus the weekend. */
export const EXPORT_LINK_SECONDS = 7 * 24 * 60 * 60

/** The visit-report form field whose answer the actual-time columns already carry. */
const TIME_FIELD_KEY = "visit_time"

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
  /** Where the app is served from, so the record link is one anyone can paste. */
  origin: string
  /** Signed read URLs by storage path, for every attachment of the whole export. */
  signedUrls: Map<string, string>
  /** Today in mission time, so an overdue follow-up reads as late. Optional. */
  today?: string
}

export interface ReportExportSheets {
  laporan: string[][]
  kontak: string[][]
  catatan: string[][]
  /** Headers whose cells are numbers, so the workbook types them instead of writing text. */
  numericColumns: Set<string>
}

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
  "Dikirim ke LeadEngine",
  "Kategori lead",
  "ID lead LeadEngine",
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

/**
 * One person met, on one line.
 *
 * Everything the rep recorded about them, in the order a human reads it, with
 * the empty parts left out rather than printed as separators with nothing
 * between them. A DISC reading is a judgement, so it only appears when there
 * is one and it stays behind the word DISC.
 */
export function contactLine(contact: ExportContact): string {
  const name = contact.fullName.trim()
  const jobTitle = contact.jobTitle?.trim()
  const parts = [jobTitle ? `${name} — ${jobTitle}` : name]
  const phone = contact.phone?.trim()
  const email = contact.email?.trim()
  if (phone) parts.push(phone)
  if (email) parts.push(email)
  if (contact.isDecisionMaker) parts.push("Pengambil keputusan")
  if (contact.discPrimary) {
    parts.push(`DISC ${contact.discPrimary}${contact.discSecondary ? `/${contact.discSecondary}` : ""}`)
  }
  return parts.join(" · ")
}

/** The files of one attachment answer, one per line: the name, and the link while it lasts. */
export function attachmentLines(
  fieldType: FieldType,
  value: unknown,
  signedUrls: Map<string, string>
): string {
  const files =
    fieldType === "AUDIO"
      ? parseAudioAnswer(value).map((item) => ({ path: item.path, name: item.name }))
      : parsePhotoAnswer(value).map((item) => ({ path: item.path, name: item.name }))

  return files
    .map((file) => {
      const url = signedUrls.get(file.path)
      // A path that could not be signed is still evidence the file exists;
      // writing the name alone beats writing nothing.
      return url ? `${file.name} · ${url}` : file.name
    })
    .join("\n")
}

/** Every attachment path in the export, so the whole file is signed in one pass. */
export function collectAttachmentPaths(
  rows: ReportExportRow[],
  fields: FormField[]
): { photoPaths: string[]; audioPaths: string[] } {
  const photoPaths = new Set<string>()
  const audioPaths = new Set<string>()

  for (const field of fields) {
    if (!isAttachmentType(field.fieldType)) continue
    for (const row of rows) {
      const value = row.custom[field.reportingKey]
      if (value === undefined || value === null) continue
      if (field.fieldType === "AUDIO") {
        for (const item of parseAudioAnswer(value)) audioPaths.add(item.path)
      } else {
        for (const item of parsePhotoAnswer(value)) photoPaths.add(item.path)
      }
    }
  }

  return { photoPaths: [...photoPaths], audioPaths: [...audioPaths] }
}

/** A custom answer as the tenant's field type says to read it. */
function customCell(field: FormField, value: unknown, signedUrls: Map<string, string>): string {
  if (isAttachmentType(field.fieldType)) return attachmentLines(field.fieldType, value, signedUrls)
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
 * back to the stored answer — which is how attachments and any core field
 * added later are carried without a change here.
 */
function coreCell(
  field: FormField,
  row: ReportExportRow,
  choices: ChoiceSet | null,
  signedUrls: Map<string, string>
): string | null {
  switch (field.reportingKey) {
    case "visit_outcome":
      return labelOf(choices, "visit_outcome", row.visitOutcome)
    case "contacts_met":
      return row.contacts.map(contactLine).join("\n")
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
      return isAttachmentType(field.fieldType)
        ? attachmentLines(field.fieldType, row.custom[field.reportingKey], signedUrls)
        : null
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
 * The export's three sheets, header row first.
 *
 * Column order is: what the activity was, then the report form as the admin
 * arranged it, then what became of the report. "Waktu kunjungan" is dropped
 * from the middle because the activity block already carries the reported
 * start and end as their own day and clock columns, and a second rendering of
 * the same answer is a column people reconcile instead of read.
 */
export function buildReportExport(
  rows: ReportExportRow[],
  fields: FormField[],
  choices: ChoiceSet | null,
  options: ReportExportOptions
): ReportExportSheets {
  const shown = visibleFields(fields).filter((field) => field.reportingKey !== TIME_FIELD_KEY)
  const today = options.today ?? ""

  const numericColumns = new Set<string>()
  for (const field of shown) {
    if (field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") numericColumns.add(field.label)
  }

  const header = [...ACTIVITY_COLUMNS, ...shown.map((field) => field.label), ...TRAIL_COLUMNS]

  const laporan: string[][] = [header]
  const kontak: string[][] = [CONTACT_COLUMNS]
  const catatan: string[][] = [NOTE_COLUMNS]

  for (const row of rows) {
    const visitDay = wibDay(row.actualStart)

    const answers = shown.map((field) => {
      const core = field.isCore ? coreCell(field, row, choices, options.signedUrls) : null
      return core ?? customCell(field, row.custom[field.reportingKey], options.signedUrls)
    })

    laporan.push([
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
      ...answers,
      text(row.clarificationNote),
      supportingNotesCell(row.supportingNotes),
      yesNo(row.pushedLeadId !== null),
      text(row.pushedCategory),
      text(row.pushedLeadId),
      followUpCell(row.followUp, today),
      text(row.submittedByName),
      wibDay(row.submittedAt),
      wibTime(row.submittedAt),
      `${options.origin}${paths.activity(row.missionId, { fokus: "laporan" })}`,
      row.missionId,
      row.reportId,
    ])

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

  return { laporan, kontak, catatan, numericColumns }
}
