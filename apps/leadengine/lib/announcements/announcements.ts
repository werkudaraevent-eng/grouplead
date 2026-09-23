import { CHANGELOG, type Announcement, type ChangelogEntry } from "@/features/changelog/changelog-data"

/**
 * Which releases get announced, and to whom it is still news.
 *
 * Two layers, the way a product team runs in-app announcements: the code
 * decides what *can* be announced (a changelog entry carrying an
 * `announcement` block, written with the feature), and an admin decides in
 * Settings → Announcements whether it *is*, and can announce it again after
 * a training. The whole group sees the same announcements (no business
 * unit). A person sees each one once: the seen mark in public.user_hints is
 * keyed on the announcement and the moment it was last announced, so
 * Announce again makes it new for everyone.
 */

export interface AnnouncementRow {
  key: string
  enabled: boolean
  /** Set only by Announce again; null while the release date is the stamp. */
  announced_at: string | null
}

export interface AnnouncementState extends Announcement {
  /** The release date, from the changelog (YYYY-MM-DD). */
  date: string
  enabled: boolean
  /** ISO instant the seen mark is keyed on: the last Announce again, else the release date. */
  announcedAt: string
  /** Whether an admin has ever announced it again (so announcedAt is theirs, not the release date). */
  reannounced: boolean
  /** public.user_hints key written when the person closes the dialog. */
  seenKey: string
  /** Whether an admin has ever saved a row for it. */
  configured: boolean
}

/** At most this many items in one dialog: the newest; the rest wait for the next visit. */
export const MAX_ANNOUNCED = 3

/** A release date is read as the start of that day in Jakarta, where the group works. */
export const releaseInstant = (date: string) => `${date}T00:00:00+07:00`

const stamp = (iso: string) => Math.floor(Date.parse(iso) / 1000)

/** Every announceable release, newest first (the changelog's order), with the admin's switches applied. */
export function announcementStates(
  rows: readonly AnnouncementRow[],
  entries: readonly ChangelogEntry[] = CHANGELOG,
): AnnouncementState[] {
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return entries.flatMap((entry) => {
    const announcement = entry.announcement
    if (!announcement) return []
    const row = byKey.get(announcement.key)
    const reannounced = Boolean(row?.announced_at) && Number.isFinite(Date.parse(row!.announced_at!))
    const announcedAt = reannounced ? row!.announced_at! : releaseInstant(entry.date)
    const enabled = row ? row.enabled : announcement.defaultOn ?? true
    return [
      {
        ...announcement,
        date: entry.date,
        enabled,
        announcedAt,
        reannounced,
        seenKey: `announce-${announcement.key}-${stamp(announcedAt)}`,
        configured: Boolean(row),
      },
    ]
  })
}

/** What the dialog shows this person now: on, not yet closed, newest first, capped. */
export function pendingAnnouncements(
  states: readonly AnnouncementState[],
  seen: ReadonlySet<string>,
): AnnouncementState[] {
  return states.filter((state) => state.enabled && !seen.has(state.seenKey)).slice(0, MAX_ANNOUNCED)
}

/** The keys the code knows, for validating a settings write. */
export function announcementKeys(entries: readonly ChangelogEntry[] = CHANGELOG): Set<string> {
  return new Set(announcementStates([], entries).map((state) => state.key))
}
