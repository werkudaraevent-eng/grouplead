/**
 * Prospect statuses: admin-editable labels over a fixed set of kinds.
 *
 * The admin renames, recolours, reorders, adds and archives statuses. What
 * they cannot change is the `kind`, because the kind is what the code acts
 * on: which status a new prospect starts in, which one a conversion lands
 * on, which ones count as "still being worked" for the follow-up queue, and
 * how the funnel is computed. Labels are the team's words; kinds are the
 * system's.
 */

export const STATUS_KINDS = ["open", "in_progress", "won", "lost"] as const
export type StatusKind = (typeof STATUS_KINDS)[number]

export const KIND_LABELS: Record<StatusKind, string> = {
  open: "Belum digarap",
  in_progress: "Sedang digarap",
  won: "Janji temu berhasil",
  lost: "Tidak berhasil",
}

export const KIND_DESCRIPTIONS: Record<StatusKind, string> = {
  open: "Status awal setiap prospek. Harus ada tepat satu yang aktif.",
  in_progress: "Sudah dihubungi, belum ada keputusan. Boleh membawa tanggal hubungi lagi.",
  won: "Janji temu disepakati. Diberikan otomatis saat prospek dijadikan mission.",
  lost: "Prospek menolak atau tidak bisa dihubungi. Meminta alasan singkat.",
}

/** Which kinds an admin may create new statuses under. The two anchors stay single. */
export const ADDABLE_KINDS: readonly StatusKind[] = ["in_progress", "lost"]

export const STATUS_COLORS = ["neutral", "primary", "warning", "success", "danger", "accent"] as const
export type StatusColor = (typeof STATUS_COLORS)[number]

export const COLOR_LABELS: Record<StatusColor, string> = {
  neutral: "Abu",
  primary: "Biru",
  warning: "Kuning",
  success: "Hijau",
  danger: "Merah",
  accent: "Oranye",
}

/** The dot beside a status label, per colour role. Same tokens the mission badges use. */
export const COLOR_DOT: Record<StatusColor, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  warning: "bg-[var(--warning-foreground)]",
  success: "bg-[var(--success-foreground)]",
  danger: "bg-[var(--danger-foreground)]",
  accent: "bg-accent",
}

export interface ProspectStatus {
  id: string
  code: string
  label: string
  kind: StatusKind
  color: StatusColor
  isActive: boolean
  displayOrder: number
}

export interface StatusSeed {
  code: string
  label: string
  kind: StatusKind
  color: StatusColor
  displayOrder: number
}

/** The vocabulary the team asked for, in their words. */
export const DEFAULT_PROSPECT_STATUSES: readonly StatusSeed[] = [
  { code: "uncontacted", label: "Uncontacted", kind: "open", color: "neutral", displayOrder: 10 },
  { code: "in_progress", label: "In Progress", kind: "in_progress", color: "warning", displayOrder: 20 },
  { code: "confirmed", label: "Confirmed", kind: "won", color: "success", displayOrder: 30 },
  { code: "declined", label: "Cancelled / Declined", kind: "lost", color: "danger", displayOrder: 40 },
]

export function activeStatuses(statuses: ProspectStatus[]): ProspectStatus[] {
  return statuses.filter((status) => status.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
}

function firstOfKind(statuses: ProspectStatus[], kind: StatusKind): ProspectStatus | null {
  const active = activeStatuses(statuses).find((status) => status.kind === kind)
  if (active) return active
  // Never undefined while any status exists: an archived anchor still beats nothing.
  return statuses.filter((status) => status.kind === kind).sort((a, b) => a.displayOrder - b.displayOrder)[0] ?? null
}

/** Where a new or imported prospect starts. */
export function entryStatus(statuses: ProspectStatus[]): ProspectStatus | null {
  return firstOfKind(statuses, "open")
}

/** Where a conversion lands. */
export function wonStatus(statuses: ProspectStatus[]): ProspectStatus | null {
  return firstOfKind(statuses, "won")
}

/** A status that keeps the prospect in the follow-up queue. */
export function isWorkable(kind: StatusKind): boolean {
  return kind === "open" || kind === "in_progress"
}

export function needsReason(kind: StatusKind): boolean {
  return kind === "lost"
}

/**
 * Whether the status can be archived. The last active `open` and the last
 * active `won` cannot: new prospects would have nowhere to start and a
 * conversion nowhere to land.
 */
export function archiveViolation(statuses: ProspectStatus[], id: string): string | null {
  const target = statuses.find((status) => status.id === id)
  if (!target) return "Status tidak ditemukan."
  if (target.kind === "open" || target.kind === "won") {
    const others = activeStatuses(statuses).filter((status) => status.kind === target.kind && status.id !== id)
    if (others.length === 0) {
      return target.kind === "open"
        ? "Harus ada satu status awal yang aktif. Buat penggantinya dulu."
        : "Harus ada satu status janji temu berhasil yang aktif. Buat penggantinya dulu."
    }
  }
  return null
}

/** A code from a label: lowercase, underscores, unique among the given codes. */
export function toStatusCode(label: string, taken: string[]): string {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, (digit) => `s${digit}`) || "status"
  if (!taken.includes(base)) return base
  let index = 2
  while (taken.includes(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

export function nextStatusOrder(statuses: ProspectStatus[]): number {
  return statuses.reduce((max, status) => Math.max(max, status.displayOrder), 0) + 10
}

/** Move one active status up or down; returns every status with new orders, renumbered in tens. */
export function reorderStatus(statuses: ProspectStatus[], id: string, direction: "up" | "down"): ProspectStatus[] {
  const active = activeStatuses(statuses)
  const index = active.findIndex((status) => status.id === id)
  if (index === -1) return statuses
  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= active.length) return statuses
  const order = [...active]
  ;[order[index], order[target]] = [order[target], order[index]]
  const renumbered = new Map(order.map((status, position) => [status.id, (position + 1) * 10]))
  return statuses.map((status) => (renumbered.has(status.id) ? { ...status, displayOrder: renumbered.get(status.id)! } : status))
}

/**
 * What a prospect shows as its status once it has a mission: the mission's
 * fate overrides the stored "Confirmed". Stored otherwise.
 */
export type DisplayState = "stored" | "rescheduled" | "completed" | "mission_cancelled"

export const DERIVED_STATES: ReadonlyArray<{ value: Exclude<DisplayState, "stored">; label: string; color: StatusColor }> = [
  { value: "rescheduled", label: "Rescheduled", color: "accent" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "mission_cancelled", label: "Cancelled", color: "danger" },
]

export function displayStatus(
  stored: Pick<ProspectStatus, "label" | "color" | "kind">,
  state: DisplayState
): { label: string; color: StatusColor; derived: boolean } {
  const derived = DERIVED_STATES.find((item) => item.value === state)
  if (derived) return { label: derived.label, color: derived.color, derived: true }
  return { label: stored.label, color: stored.color, derived: false }
}
