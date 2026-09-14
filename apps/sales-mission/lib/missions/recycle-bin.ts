/**
 * The recycle bin's one rule: a deleted mission is kept for this long, then
 * removed for good. Pure, so the page, the purge and the tests agree.
 */
export const RETENTION_DAYS = 30

export function purgeAt(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + RETENTION_DAYS * 86_400_000)
}

/** Whole days until the mission is purged; 0 once it is due. */
export function daysLeft(deletedAt: string, now: Date): number {
  const remaining = purgeAt(deletedAt).getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 86_400_000))
}

/** The instant before which a deletion has expired, for the purge query. */
export function purgeCutoff(now: Date): string {
  return new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString()
}
