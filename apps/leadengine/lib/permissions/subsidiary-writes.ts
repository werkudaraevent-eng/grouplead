/**
 * What a change made on the holding writes to each subsidiary's row.
 *
 * The database holds `role_permissions_write_requires_read`: Buat, Ubah or
 * Hapus on a row whose Lihat is off is refused. The holding's own switch
 * grants Lihat alongside a write only when the *holding's* row has it off, so
 * the payload it propagates is often just `{ can_create: true }`. A
 * subsidiary whose Lihat is still off then breaks the constraint, and because
 * the subsidiaries are written in one UPDATE, one such row fails them all:
 * the admin read "Perubahan tidak sampai ke semua anak perusahaan" for every
 * unit at once.
 *
 * The rule each subsidiary follows is the holding's own: granting a write
 * implies Lihat. So a row (existing or new) that would end up with a write
 * and no Lihat gets `can_read: "company"` in the same write, and every other
 * row gets exactly the payload.
 */

export type ReadLevel = string

export interface SubsidiaryRow {
  id: string
  company_id: string
  module_id?: string
  can_read: ReadLevel
}

export interface SubsidiaryWritePlan {
  /** Rows written with the payload as it is. */
  plainIds: string[]
  /** Rows that also need Lihat turned on, because the payload grants a write. */
  impliedReadIds: string[]
  /** The payload for `impliedReadIds`. */
  impliedReadUpdates: Record<string, unknown>
}

/** The read level a write implies, the same one the holding's switch grants. */
export const IMPLIED_READ = "company"

/** Whether the payload switches on Buat, Ubah or Hapus without saying anything about Lihat. */
export function grantsWriteWithoutRead(updates: Record<string, unknown>): boolean {
  if ("can_read" in updates) return false
  return updates.can_create === true || updates.can_update === true || updates.can_delete === true
}

/** Split the existing subsidiary rows by whether they need the implied Lihat. */
export function planSubsidiaryUpdates(rows: readonly SubsidiaryRow[], updates: Record<string, unknown>): SubsidiaryWritePlan {
  const implies = grantsWriteWithoutRead(updates)
  const plainIds: string[] = []
  const impliedReadIds: string[] = []
  for (const row of rows) {
    if (implies && (row.can_read ?? "none") === "none") impliedReadIds.push(row.id)
    else plainIds.push(row.id)
  }
  return { plainIds, impliedReadIds, impliedReadUpdates: { ...updates, can_read: IMPLIED_READ } }
}

/**
 * The columns for a subsidiary that has no row yet: everything off, the
 * payload on top, and Lihat on when the payload grants a write.
 */
export function newSubsidiaryRow(base: Record<string, unknown>, updates: Record<string, unknown>): Record<string, unknown> {
  const row = { can_create: false, can_read: "none", can_update: false, can_delete: false, ...base, ...updates }
  if (grantsWriteWithoutRead(updates)) row.can_read = IMPLIED_READ
  return row
}
