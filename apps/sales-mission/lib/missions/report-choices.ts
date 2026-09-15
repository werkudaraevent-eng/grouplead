/**
 * The visit report's three fixed choices, opened up.
 *
 * "Hasil kunjungan", "Tingkat minat" and "Next action" used to be enums in
 * code: the KPI screen, the CRM sync and the lead push switch on them, so
 * an admin could not touch them. Same answer as prospect statuses: every
 * option carries a locked kind that the code acts on, and a label, an order
 * and an active flag that are the admin's. New options are allowed as long
 * as they pick a kind. Pure, so the form, the server and the reports read
 * the same rules.
 */

export const CHOICE_FIELDS = ["visit_outcome", "interest_level", "next_action_type"] as const
export type ChoiceField = (typeof CHOICE_FIELDS)[number]

export const OUTCOME_KINDS = ["met_decision_maker", "met_staff", "rescheduled", "absent", "cancelled"] as const
export const INTEREST_KINDS = ["hot", "warm", "cold", "none"] as const
export const NEXT_ACTION_KINDS = ["action", "none"] as const

export const KINDS_BY_FIELD: Record<ChoiceField, readonly string[]> = {
  visit_outcome: OUTCOME_KINDS,
  interest_level: INTEREST_KINDS,
  next_action_type: NEXT_ACTION_KINDS,
}

export const FIELD_LABELS: Record<ChoiceField, string> = {
  visit_outcome: "Hasil kunjungan",
  interest_level: "Tingkat minat",
  next_action_type: "Next action",
}

/** What each kind makes the system do. Shown beside the lock in the editor. */
export const KIND_LABELS: Record<ChoiceField, Record<string, string>> = {
  visit_outcome: {
    met_decision_maker: "Bertemu pengambil keputusan",
    met_staff: "Bertemu orang lain",
    rescheduled: "Dijadwalkan ulang",
    absent: "Tidak bertemu siapa pun",
    cancelled: "Dibatalkan",
  },
  interest_level: { hot: "Panas", warm: "Hangat", cold: "Dingin", none: "Tidak berminat" },
  next_action_type: { action: "Ada tindak lanjut", none: "Tidak ada tindak lanjut" },
}

export const KIND_HINTS: Record<ChoiceField, Record<string, string>> = {
  visit_outcome: {
    met_decision_maker: "Dihitung sebagai kunjungan ke pengambil keputusan di KPI. Kontak wajib, dan didaftarkan ke CRM.",
    met_staff: "Kontak wajib, dan didaftarkan ke CRM.",
    rescheduled: "Kontak wajib, dan didaftarkan ke CRM.",
    absent: "Kontak tidak wajib. Tidak ada yang dikirim ke CRM.",
    cancelled: "Kontak wajib bila ada yang ditemui. Tidak ada yang dikirim ke CRM.",
  },
  interest_level: {
    hot: "Peluang boleh ditandai.",
    warm: "Peluang boleh ditandai.",
    cold: "Peluang boleh ditandai.",
    none: "Peluang tidak bisa ditandai; laporan tidak masuk antrean kirim lead.",
  },
  next_action_type: {
    action: "Butuh penanggung jawab dan tanggal. Masuk hitungan next action terbuka.",
    none: "Tanpa penanggung jawab dan tanggal.",
  },
}

export interface ReportChoice {
  id: string
  fieldKey: ChoiceField
  code: string
  label: string
  kind: string
  isActive: boolean
  displayOrder: number
}

export type ChoiceSet = Record<ChoiceField, ReportChoice[]>

/** The codes the columns have always stored, with the labels the form always showed. */
export const DEFAULT_REPORT_CHOICES: ReadonlyArray<Pick<ReportChoice, "fieldKey" | "code" | "label" | "kind" | "displayOrder">> = [
  { fieldKey: "visit_outcome", code: "MET_DECISION_MAKER", label: "Bertemu pengambil keputusan", kind: "met_decision_maker", displayOrder: 10 },
  { fieldKey: "visit_outcome", code: "MET_STAFF", label: "Bertemu staf", kind: "met_staff", displayOrder: 20 },
  { fieldKey: "visit_outcome", code: "RESCHEDULED_ON_SITE", label: "Dijadwalkan ulang di tempat", kind: "rescheduled", displayOrder: 30 },
  { fieldKey: "visit_outcome", code: "CLIENT_ABSENT", label: "Klien tidak ada", kind: "absent", displayOrder: 40 },
  { fieldKey: "visit_outcome", code: "CANCELLED_ON_SITE", label: "Dibatalkan di tempat", kind: "cancelled", displayOrder: 50 },
  { fieldKey: "interest_level", code: "HOT", label: "Panas", kind: "hot", displayOrder: 10 },
  { fieldKey: "interest_level", code: "WARM", label: "Hangat", kind: "warm", displayOrder: 20 },
  { fieldKey: "interest_level", code: "COLD", label: "Dingin", kind: "cold", displayOrder: 30 },
  { fieldKey: "interest_level", code: "NO_INTEREST", label: "Tidak berminat", kind: "none", displayOrder: 40 },
  { fieldKey: "next_action_type", code: "SEND_PROPOSAL", label: "Kirim proposal", kind: "action", displayOrder: 10 },
  { fieldKey: "next_action_type", code: "SITE_VISIT", label: "Survei lokasi", kind: "action", displayOrder: 20 },
  { fieldKey: "next_action_type", code: "FOLLOW_UP_CALL", label: "Telepon lanjutan", kind: "action", displayOrder: 30 },
  { fieldKey: "next_action_type", code: "WAITING_CLIENT", label: "Menunggu klien", kind: "action", displayOrder: 40 },
  { fieldKey: "next_action_type", code: "NONE", label: "Tidak ada", kind: "none", displayOrder: 50 },
]

export function emptyChoiceSet(): ChoiceSet {
  return { visit_outcome: [], interest_level: [], next_action_type: [] }
}

/** The defaults as a set, for callers with no tenant at hand (tests, schema fallbacks). */
export function defaultChoiceSet(): ChoiceSet {
  const set = emptyChoiceSet()
  for (const seed of DEFAULT_REPORT_CHOICES) {
    set[seed.fieldKey].push({ id: `default-${seed.code}`, isActive: true, ...seed })
  }
  return set
}

/** Kind for an unknown code: the safest reading, which asks for the most. */
const FALLBACK_KIND: Record<ChoiceField, string> = {
  visit_outcome: "met_staff",
  interest_level: "warm",
  next_action_type: "action",
}

function find(choices: ChoiceSet | null | undefined, field: ChoiceField, code: string | null | undefined): ReportChoice | undefined {
  if (!code) return undefined
  const list = choices?.[field]
  return (list && list.find((choice) => choice.code === code)) ?? defaultChoiceSet()[field].find((choice) => choice.code === code)
}

/** The kind behind a stored code. Falls back to the seed, then to the field's safest kind. */
export function kindOf(choices: ChoiceSet | null | undefined, field: ChoiceField, code: string | null | undefined): string {
  return find(choices, field, code)?.kind ?? FALLBACK_KIND[field]
}

/** The label for a stored code, or the code itself when nothing knows it. */
export function labelOf(choices: ChoiceSet | null | undefined, field: ChoiceField, code: string | null | undefined): string {
  if (!code) return ""
  return find(choices, field, code)?.label ?? code
}

/** Active choices in order, plus the one a report already carries if it was archived, so the form still shows it. */
export function choicesFor(choices: ChoiceSet | null | undefined, field: ChoiceField, current?: string | null): ReportChoice[] {
  const list = choices?.[field]?.length ? choices[field] : defaultChoiceSet()[field]
  const active = list.filter((choice) => choice.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
  if (current && !active.some((choice) => choice.code === current)) {
    const stale = list.find((choice) => choice.code === current)
    if (stale) return [...active, stale]
  }
  return active
}

export function isKnownChoice(choices: ChoiceSet | null | undefined, field: ChoiceField, code: string): boolean {
  return Boolean(find(choices, field, code))
}

export function outcomeRequiresContacts(code: string | null | undefined, choices?: ChoiceSet | null): boolean {
  return kindOf(choices, "visit_outcome", code) !== "absent"
}

/** A visit where somebody was met is what the CRM learns from. */
export function outcomeReachesCrm(code: string | null | undefined, choices?: ChoiceSet | null): boolean {
  const kind = kindOf(choices, "visit_outcome", code)
  return kind === "met_decision_maker" || kind === "met_staff" || kind === "rescheduled"
}

export function isDecisionMakerOutcome(code: string | null | undefined, choices?: ChoiceSet | null): boolean {
  return Boolean(code) && kindOf(choices, "visit_outcome", code) === "met_decision_maker"
}

export function isNoInterest(code: string | null | undefined, choices?: ChoiceSet | null): boolean {
  return Boolean(code) && kindOf(choices, "interest_level", code) === "none"
}

export function isNoAction(code: string | null | undefined, choices?: ChoiceSet | null): boolean {
  if (!code) return true
  return kindOf(choices, "next_action_type", code) === "none"
}

/** The code a report without a next action stores: the active "none" choice, or NONE. */
export function noActionCode(choices?: ChoiceSet | null): string {
  return choicesFor(choices, "next_action_type").find((choice) => choice.kind === "none")?.code ?? "NONE"
}

/**
 * The rules the tenant's kinds impose on a report, re-applied on the server
 * with the real set. The static schema applies the same rules with the
 * seed, which is right for every tenant that never added a choice.
 */
export function reportChoiceViolation(
  choices: ChoiceSet,
  report: {
    visitOutcome: string | null | undefined
    interestLevel: string | null | undefined
    nextActionType: string
    opportunityExists: boolean
    contactCount: number
    nextActionOwner: string | null | undefined
    followUpDate: string | null | undefined
  }
): string | null {
  if (report.visitOutcome && !isKnownChoice(choices, "visit_outcome", report.visitOutcome)) return "Hasil kunjungan itu tidak ada dalam daftar."
  if (report.interestLevel && !isKnownChoice(choices, "interest_level", report.interestLevel)) return "Tingkat minat itu tidak ada dalam daftar."
  if (!isKnownChoice(choices, "next_action_type", report.nextActionType)) return "Next action itu tidak ada dalam daftar."
  if (outcomeRequiresContacts(report.visitOutcome, choices) && report.contactCount === 0) return "Catat minimal satu kontak yang ditemui."
  if (report.opportunityExists && isNoInterest(report.interestLevel, choices)) return "Peluang tidak bisa ditandai saat tingkat minat berjenis 'Tidak berminat'."
  if (!isNoAction(report.nextActionType, choices)) {
    if (!report.nextActionOwner) return "Tentukan penanggung jawab next action."
    if (!report.followUpDate) return "Tentukan tanggal follow-up."
  }
  return null
}

/** A stored code from a label: UPPER_SNAKE, unique among the given codes. */
export function toChoiceCode(label: string, taken: string[]): string {
  const base = label
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .replace(/^[0-9]/, (digit) => `C${digit}`) || "CHOICE"
  if (!taken.includes(base)) return base
  let index = 2
  while (taken.includes(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

export function nextChoiceOrder(list: ReportChoice[]): number {
  return list.reduce((max, choice) => Math.max(max, choice.displayOrder), 0) + 10
}

/**
 * Whether a choice can be archived. Every field keeps at least one active
 * choice, and "Next action" keeps one of kind none: a report with nothing
 * to do next needs somewhere to say so.
 */
export function archiveChoiceViolation(list: ReportChoice[], id: string): string | null {
  const target = list.find((choice) => choice.id === id)
  if (!target) return "Pilihan tidak ditemukan."
  const others = list.filter((choice) => choice.isActive && choice.id !== id)
  if (others.length === 0) return "Harus ada minimal satu pilihan yang aktif."
  if (target.fieldKey === "next_action_type" && target.kind === "none" && !others.some((choice) => choice.kind === "none")) {
    return "Harus ada satu pilihan 'Tidak ada tindak lanjut' yang aktif."
  }
  return null
}

/** Move one active choice up or down; returns the list with new orders, renumbered in tens. */
export function reorderChoice(list: ReportChoice[], id: string, direction: "up" | "down"): ReportChoice[] {
  const active = list.filter((choice) => choice.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
  const index = active.findIndex((choice) => choice.id === id)
  if (index === -1) return list
  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= active.length) return list
  const order = [...active]
  ;[order[index], order[target]] = [order[target], order[index]]
  const renumbered = new Map(order.map((choice, position) => [choice.id, (position + 1) * 10]))
  return list.map((choice) => (renumbered.has(choice.id) ? { ...choice, displayOrder: renumbered.get(choice.id)! } : choice))
}
