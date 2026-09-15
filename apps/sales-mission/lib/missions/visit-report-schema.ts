import { z } from "zod"
import { isValidPhone, normalizePhone } from "@/lib/format/phone"
import { visibleFields, type FormField } from "./form-fields"

/**
 * Visit report contract: vocabularies, validation, and the pure helpers the
 * form and the server action both use.
 *
 * The design rule behind every enum here: free text cannot be reported on. If a
 * question will ever be asked of the data — how many visits reached a decision
 * maker, which needs keep recurring, how many next actions are still open — the
 * answer has to live in a typed field with a fixed vocabulary. Only
 * `meetingSummary` is prose.
 *
 * Two schemas, deliberately: a draft autosaves constantly from a phone with bad
 * signal and must accept a half-filled form, while a submission is the record
 * of what happened and must be complete.
 */

export const VISIT_OUTCOMES = [
  "MET_DECISION_MAKER",
  "MET_STAFF",
  "RESCHEDULED_ON_SITE",
  "CLIENT_ABSENT",
  "CANCELLED_ON_SITE",
] as const
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number]

export const VISIT_OUTCOME_LABELS: Record<VisitOutcome, string> = {
  MET_DECISION_MAKER: "Bertemu pengambil keputusan",
  MET_STAFF: "Bertemu staf",
  RESCHEDULED_ON_SITE: "Dijadwalkan ulang di tempat",
  CLIENT_ABSENT: "Klien tidak ada",
  CANCELLED_ON_SITE: "Dibatalkan di tempat",
}

export const INTEREST_LEVELS = ["HOT", "WARM", "COLD", "NO_INTEREST"] as const
export type InterestLevel = (typeof INTEREST_LEVELS)[number]

export const INTEREST_LEVEL_LABELS: Record<InterestLevel, string> = {
  HOT: "Panas",
  WARM: "Hangat",
  COLD: "Dingin",
  NO_INTEREST: "Tidak berminat",
}

export const NEXT_ACTION_TYPES = [
  "SEND_PROPOSAL",
  "SITE_VISIT",
  "FOLLOW_UP_CALL",
  "WAITING_CLIENT",
  "NONE",
] as const
export type NextActionType = (typeof NEXT_ACTION_TYPES)[number]

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  SEND_PROPOSAL: "Kirim proposal",
  SITE_VISIT: "Survei lokasi",
  FOLLOW_UP_CALL: "Telepon lanjutan",
  WAITING_CLIENT: "Menunggu klien",
  NONE: "Tidak ada",
}

export const REPORT_STATUSES = ["DRAFT", "SUBMITTED", "NEEDS_CLARIFICATION"] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/**
 * Nobody was there to meet, so demanding a list of who was met would force
 * people to invent one. Every other outcome requires at least one contact.
 */
export function outcomeRequiresContacts(outcome: VisitOutcome | null | undefined): boolean {
  return outcome !== "CLIENT_ABSENT"
}

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Nama kontak wajib diisi").max(150),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z.string().trim().max(40).transform(normalizePhone).optional().or(z.literal("")),
  email: z.union([z.string().trim().email("Format email tidak valid").max(150), z.literal("")]).optional(),
  isDecisionMaker: z.boolean().default(false),
})

export type ReportContactInput = z.infer<typeof contactSchema>

/**
 * The person the appointment was made with, as a report contact. The visit
 * was arranged with them, so the report starts with them already listed and
 * the rep only confirms or replaces; nothing is typed twice. Null when the
 * mission was created without a named contact.
 */
export function contactFromAppointment(appointment: {
  name: string | null
  jobTitle: string | null
  phone: string | null
  email: string | null
}): ReportContactInput | null {
  const fullName = appointment.name?.trim() ?? ""
  if (!fullName) return null
  return {
    fullName,
    jobTitle: appointment.jobTitle?.trim() ?? "",
    phone: appointment.phone?.trim() ?? "",
    email: appointment.email?.trim() ?? "",
    isDecisionMaker: false,
  }
}

/** Whether a report contact is the appointment contact, by name. */
export function isAppointmentContact(contact: { fullName: string }, appointment: ReportContactInput | null): boolean {
  if (!appointment) return false
  return contact.fullName.trim().toLowerCase() === appointment.fullName.trim().toLowerCase()
}

/** Shape shared by both variants. Everything optional; the strict rules live in the submit schema. */
const baseShape = {
  visitOutcome: z.enum(VISIT_OUTCOMES).nullish(),
  meetingSummary: z.string().trim().max(5000).optional().or(z.literal("")),
  clientNeeds: z.array(z.string().trim().min(1)).default([]),
  productInterest: z.array(z.string().trim().min(1)).default([]),
  interestLevel: z.enum(INTEREST_LEVELS).nullish(),
  opportunityExists: z.boolean().default(false),
  estimatedValue: z.number().nonnegative("Nilai tidak boleh negatif").nullish(),
  competitorMentioned: z.string().trim().max(300).optional().or(z.literal("")),
  nextActionType: z.enum(NEXT_ACTION_TYPES).default("NONE"),
  nextActionOwner: z.string().uuid().nullish(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").nullish(),
  contacts: z.array(contactSchema).default([]),
  /** Answers to the fields the admin added, keyed by reporting key. */
  custom: z.record(z.string(), z.unknown()).default({}),
}

/** Autosave. Accepts a half-filled form so a draft is never lost to validation. */
export const visitReportDraftSchema = z.object(baseShape)
export type VisitReportDraft = z.infer<typeof visitReportDraftSchema>

/** Submission. This is the record of what happened, so it must be complete. */
export const visitReportSubmitSchema = z
  .object({
    ...baseShape,
    /** Why a sent report is being changed. Required by the action when the report was already sent. */
    changeReason: z.string().trim().max(300, "Alasan maksimal 300 karakter").optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
  if (!value.visitOutcome) {
    ctx.addIssue({ code: "custom", path: ["visitOutcome"], message: "Pilih hasil kunjungan" })
  }

  if (!value.meetingSummary || value.meetingSummary.trim().length === 0) {
    ctx.addIssue({ code: "custom", path: ["meetingSummary"], message: "Ringkasan pertemuan wajib diisi" })
  }

  if (!value.interestLevel) {
    ctx.addIssue({ code: "custom", path: ["interestLevel"], message: "Pilih tingkat minat" })
  }

  if (value.clientNeeds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["clientNeeds"], message: "Pilih minimal satu kebutuhan klien" })
  }

  if (outcomeRequiresContacts(value.visitOutcome) && value.contacts.length === 0) {
    ctx.addIssue({ code: "custom", path: ["contacts"], message: "Catat minimal satu kontak yang ditemui" })
  }

  value.contacts.forEach((contact, index) => {
    if (!isValidPhone(contact.phone ?? "")) {
      ctx.addIssue({ code: "custom", path: ["contacts", index, "phone"], message: "Nomor telepon tidak valid, isi 9 sampai 15 digit" })
    }
  })

  if (value.nextActionType !== "NONE") {
    if (!value.nextActionOwner) {
      ctx.addIssue({ code: "custom", path: ["nextActionOwner"], message: "Tentukan penanggung jawab next action" })
    }
    if (!value.followUpDate) {
      ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Tentukan tanggal follow-up" })
    }
  }

  // An opportunity with no interest recorded is a contradiction that would
  // otherwise reach the CRM push modal and create a junk lead.
  if (value.opportunityExists && value.interestLevel === "NO_INTEREST") {
    ctx.addIssue({
      code: "custom",
      path: ["opportunityExists"],
      message: "Peluang tidak bisa ditandai saat tingkat minat 'Tidak berminat'",
    })
  }
})

export type VisitReportSubmit = z.infer<typeof visitReportSubmitSchema>

export interface VisitReportSummary {
  id: string
  missionId: string
  status: ReportStatus
  visitOutcome: VisitOutcome | null
  interestLevel: InterestLevel | null
  opportunityExists: boolean
  nextActionType: NextActionType
  followUpDate: string | null
  clarificationNote: string | null
  submittedAt: string | null
  contactCount: number
}

/**
 * Whether this report may be pushed to LeadEngine as a lead.
 *
 * Both conditions matter: an unsubmitted report is still changing, and a report
 * without an opportunity has nothing to push. Keeping this in one function
 * means the button, the server action, and the tests cannot disagree.
 */
export function canPushLead(report: Pick<VisitReportSummary, "status" | "opportunityExists">): boolean {
  return report.opportunityExists && report.status === "SUBMITTED"
}

/** Reports that still owe someone an action, for the follow-up queue. */
export function hasOpenNextAction(
  report: Pick<VisitReportSummary, "status" | "nextActionType">
): boolean {
  return report.status !== "DRAFT" && report.nextActionType !== "NONE"
}

/** Progress hint for the mobile form, so the field rep knows what is left. */
export function missingSubmitFields(draft: VisitReportDraft): string[] {
  const result = visitReportSubmitSchema.safeParse(draft)
  if (result.success) return []

  const seen = new Set<string>()
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "")
    if (field) seen.add(field)
  }
  return [...seen]
}

/** Core report keys → the draft property that answers them. */
const CORE_DRAFT_KEYS: Record<string, keyof VisitReportDraft> = {
  visit_outcome: "visitOutcome",
  contacts_met: "contacts",
  meeting_summary: "meetingSummary",
  client_needs: "clientNeeds",
  product_interest: "productInterest",
  interest_level: "interestLevel",
  estimated_value: "estimatedValue",
  competitor_mentioned: "competitorMentioned",
  next_action_type: "nextActionType",
  next_action_owner: "nextActionOwner",
  follow_up_date: "followUpDate",
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
}

/**
 * What the admin's configuration requires beyond what the code requires.
 *
 * The code's own rules (outcome, summary, interest, needs, contacts unless
 * absent, owner and date once there is a next action) stay in the schema
 * above and cannot be loosened. This adds the admin's tightening of any
 * other core field and every custom field they marked required. Returns
 * reporting keys, so the caller can label them from the same configuration.
 */
export function missingConfiguredFields(draft: VisitReportDraft, fields: FormField[]): string[] {
  const missing: string[] = []
  for (const field of visibleFields(fields)) {
    if (!field.isRequired) continue
    if (field.isCore) {
      const key = CORE_DRAFT_KEYS[field.reportingKey]
      if (!key) continue
      // Owner and date are conditional on a next action; the schema handles them.
      if (field.reportingKey === "next_action_owner" || field.reportingKey === "follow_up_date") continue
      if (isBlank(draft[key])) missing.push(field.reportingKey)
      continue
    }
    // A required yes/no is satisfied by "no".
    if (field.fieldType === "BOOLEAN") continue
    if (isBlank(draft.custom[field.reportingKey])) missing.push(field.reportingKey)
  }
  return missing
}
