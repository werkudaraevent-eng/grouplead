/**
 * Record scope: whose records a permission reaches.
 *
 * The matrix answers "may this role do X on module M". On a record-bound
 * action there is a second question, "on whose record?", and every big CRM
 * answers it with a scope beside the action (HubSpot: Everything / Team only /
 * Owned only; Salesforce: ownership plus the role hierarchy). This module is
 * that second answer, pure, so the rule is one place and testable:
 *
 *   own  — records the viewer owns
 *   team — own, plus records owned by anyone below the viewer in the
 *          reports_to chain (Settings → Users → Atasan)
 *   all  — every record of the tenant
 *
 * Who owns what is decided by the small helpers at the bottom, and by nothing
 * else; the help panel in Role & Izin quotes the same definitions.
 */

export type RecordScope = "own" | "team" | "all"

export const RECORD_SCOPES: readonly RecordScope[] = ["own", "team", "all"]

export function isRecordScope(value: unknown): value is RecordScope {
  return typeof value === "string" && (RECORD_SCOPES as readonly string[]).includes(value)
}

export interface ScopeContext {
  scope: RecordScope
  viewerId: string
  /** People below the viewer in the reports_to chain. Empty unless scope is "team". */
  subordinateIds: ReadonlySet<string>
}

/**
 * The two ways a record can be within reach. A person can hold both: an
 * admin who is also the sales utama owns the mission and supervises it. Callers
 * that treat the author differently from a supervisor (the report edit window)
 * read the two sides separately.
 */
export interface ScopeRelation {
  owns: boolean
  supervises: boolean
}

export function relate(ctx: ScopeContext, ownerIds: ReadonlyArray<string | null | undefined>): ScopeRelation {
  const owners = ownerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
  // A record nobody owns is inside everyone's own scope: an unclaimed prospect
  // may be taken by anyone allowed to update prospects at all.
  if (owners.length === 0) return { owns: true, supervises: false }
  const owns = owners.includes(ctx.viewerId)
  const supervises =
    ctx.scope === "all" || (ctx.scope === "team" && owners.some((id) => ctx.subordinateIds.has(id)))
  return { owns, supervises }
}

export function inScope(ctx: ScopeContext, ownerIds: ReadonlyArray<string | null | undefined>): boolean {
  const relation = relate(ctx, ownerIds)
  return relation.owns || relation.supervises
}

/** May the viewer hand a record to this person? Self is always in reach. */
export function personInScope(ctx: ScopeContext, userId: string): boolean {
  if (userId === ctx.viewerId) return true
  if (ctx.scope === "all") return true
  if (ctx.scope === "team") return ctx.subordinateIds.has(userId)
  return false
}

/* ── Who owns what ─────────────────────────────────────────── */

/** A mission belongs to its sales utama and to whoever scheduled it. */
export const missionOwners = (mission: { createdBy: string; primarySalesId: string | null }): (string | null)[] => [
  mission.primarySalesId,
  mission.createdBy,
]

/** A visit report belongs to the mission's sales utama, who writes it. */
export const reportOwners = (mission: { primarySalesId: string | null }): (string | null)[] => [mission.primarySalesId]

/** A prospect belongs to whoever holds it; nobody, and it is anyone's. */
export const prospectOwners = (prospect: { ownerId: string | null }): (string | null)[] => [prospect.ownerId]

/* ── Words ─────────────────────────────────────────────────── */

export const SCOPE_LABELS: Record<RecordScope, { label: string; description: string }> = {
  own: {
    label: "Milik sendiri",
    description: "Hanya record miliknya: mission yang ia sales utama atau ia jadwalkan, laporan mission-nya sendiri, prospek yang ia pegang.",
  },
  team: {
    label: "Tim",
    description: "Miliknya, ditambah milik orang yang Atasan-nya adalah dia, berantai ke bawah (Settings → Users).",
  },
  all: {
    label: "Semua",
    description: "Semua record di unit bisnis.",
  },
}

export type ScopedNoun = "mission" | "laporan" | "prospek"

const OWNER_WORDS: Record<ScopedNoun, string> = {
  mission: "sales utama atau yang menjadwalkannya",
  laporan: "sales utama mission itu",
  prospek: "pemegangnya",
}

/**
 * One sentence for a list that is narrower than the tenant, so a short
 * list reads as a rule, not as missing data. Null when nothing is hidden.
 */
export function describeReadScope(scope: RecordScope, noun: ScopedNoun): string | null {
  switch (scope) {
    case "own":
      return `Anda melihat ${noun} milik sendiri saja (Cakupan lihat peran Anda: Sendiri).`
    case "team":
      return `Anda melihat ${noun} milik sendiri dan tim di bawah Anda (Cakupan lihat peran Anda: Tim).`
    default:
      return null
  }
}

/**
 * One sentence for a refusal, in the words the matrix uses, so an admin
 * reading the message knows which control to change.
 */
export function describeOutOfScope(scope: RecordScope, noun: ScopedNoun): string {
  const owner = OWNER_WORDS[noun]
  switch (scope) {
    case "own":
      return `Peran Anda hanya boleh mengubah ${noun} miliknya sendiri (${owner}). Cakupan diatur di Role & Izin.`
    case "team":
      return `Peran Anda hanya boleh mengubah ${noun} miliknya sendiri atau milik tim di bawahnya (${owner}). Cakupan diatur di Role & Izin.`
    default:
      return `Peran Anda tidak punya izin untuk ${noun} ini. Izin diatur di Role & Izin.`
  }
}
