import { z } from "zod"
import { isValidPhone, normalizePhone } from "@/lib/format/phone"
import type { DisplayState, StatusColor, StatusKind } from "./prospect-status"

/** What reaches a prospect through the form, the import and the actions. */
export const prospectInputSchema = z.object({
  clientCompanyName: z.string().trim().min(1, "Nama perusahaan wajib diisi").max(200),
  clientCompanyId: z.string().uuid().optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  contactSalutation: z.string().trim().max(50).optional().or(z.literal("")),
  contactName: z.string().trim().max(150).optional().or(z.literal("")),
  contactJobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  contactDivision: z.string().trim().max(150).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(50).refine(isValidPhone, "Nomor telepon tidak valid, isi 9 sampai 15 digit").transform(normalizePhone).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(200).email("Format email tidak valid").optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  ownerId: z.string().uuid().optional().or(z.literal("")),
})
export type ProspectInput = z.infer<typeof prospectInputSchema>

export const CHANNELS = ["PHONE", "WHATSAPP", "EMAIL", "VISIT", "OTHER"] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABELS: Record<Channel, string> = {
  PHONE: "Telepon",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  VISIT: "Kunjungan",
  OTHER: "Lainnya",
}

export const OUTCOMES = ["REACHED", "NO_ANSWER", "CALLBACK", "WRONG_NUMBER", "DECLINED", "APPOINTMENT"] as const
export type Outcome = (typeof OUTCOMES)[number]
export const OUTCOME_LABELS: Record<Outcome, string> = {
  REACHED: "Tersambung, belum ada keputusan",
  NO_ANSWER: "Tidak diangkat",
  CALLBACK: "Minta dihubungi lagi",
  WRONG_NUMBER: "Nomor salah / tidak aktif",
  DECLINED: "Menolak",
  APPOINTMENT: "Janji temu disepakati",
}

/** The status kind an outcome naturally leads to; the dialog preselects it. */
export function suggestedStatusKind(outcome: Outcome): StatusKind {
  switch (outcome) {
    case "APPOINTMENT":
      return "won"
    case "DECLINED":
    case "WRONG_NUMBER":
      return "lost"
    default:
      return "in_progress"
  }
}

export const LOST_REASONS = ["Menolak", "Tidak relevan", "Nomor tidak valid", "Sudah pakai vendor lain", "Lainnya"] as const

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** A status change, with what the target kind demands. */
export const statusChangeSchema = z.object({
  statusId: z.string().uuid("Pilih status"),
  nextContactAt: z.string().regex(DATE_PATTERN, "Tanggal tidak valid").nullish(),
  lostReason: z.string().trim().max(300).nullish(),
})
export type StatusChangeInput = z.infer<typeof statusChangeSchema>

/** Rules a schema cannot see because they depend on the chosen status's kind. */
export function validateStatusChange(kind: StatusKind, input: { nextContactAt?: string | null; lostReason?: string | null }): string | null {
  if (kind === "won") return "Janji temu berhasil diberikan lewat Jadwalkan kunjungan, bukan diubah manual."
  if (kind === "lost" && !input.lostReason?.trim()) return "Tulis alasannya singkat."
  return null
}

export const attemptInputSchema = z.object({
  channel: z.enum(CHANNELS),
  outcome: z.enum(OUTCOMES),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  attemptedAt: z.string().datetime({ offset: true }).optional(),
  /** Status to move to after this attempt; omitted keeps the current one. */
  statusId: z.string().uuid().nullish(),
  nextContactAt: z.string().regex(DATE_PATTERN, "Tanggal tidak valid").nullish(),
  lostReason: z.string().trim().max(300).nullish(),
})
export type AttemptInput = z.infer<typeof attemptInputSchema>

export interface ProspectListItem {
  id: string
  statusId: string
  statusLabel: string
  statusKind: StatusKind
  statusColor: StatusColor
  displayState: DisplayState
  ownerId: string | null
  ownerName: string | null
  ownerAvatarUrl: string | null
  clientCompanyName: string
  clientCompanyId: string | null
  industry: string | null
  location: string | null
  address: string | null
  website: string | null
  contactSalutation: string | null
  contactName: string | null
  contactJobTitle: string | null
  contactDivision: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
  source: "manual" | "import"
  importBatchId: string | null
  nextContactAt: string | null
  lastContactedAt: string | null
  attemptCount: number
  lostReason: string | null
  missionId: string | null
  convertedAt: string | null
  createdBy: string | null
  createdAt: string
}

export interface ProspectAttempt {
  id: string
  channel: Channel
  outcome: Outcome
  note: string | null
  attemptedAt: string
  statusAfterLabel: string | null
  createdByName: string | null
}

export interface ProspectDetail extends ProspectListItem {
  attempts: ProspectAttempt[]
  batchFileName: string | null
  createdByName: string | null
  mission: { id: string; status: string; scheduledStart: string | null } | null
}

/** "hari ini", "besok", "terlambat 3 hari", "Rab, 17 Sep". Days in mission time. */
export function describeDueDate(date: string, today: string): { text: string; overdue: boolean; due: boolean } {
  const target = new Date(`${date}T00:00:00Z`).getTime()
  const now = new Date(`${today}T00:00:00Z`).getTime()
  const days = Math.round((target - now) / 86_400_000)
  if (days === 0) return { text: "hari ini", overdue: false, due: true }
  if (days === 1) return { text: "besok", overdue: false, due: false }
  if (days < 0) return { text: `terlambat ${-days} hari`, overdue: true, due: true }
  const label = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(target))
  return { text: label, overdue: false, due: false }
}
