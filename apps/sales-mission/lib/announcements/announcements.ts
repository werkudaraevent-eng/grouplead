import { CHANGELOG, type Announcement } from "@/lib/changelog"

/**
 * Which releases get announced, and to whom it is still news.
 *
 * Two layers, the way a product team runs in-app announcements: the code
 * decides what *can* be announced (a changelog entry carrying an
 * `announcement` block, written with the feature), and the unit's admin
 * decides from Pengaturan whether it *is*, and can announce it again after
 * a training. A person sees each announcement once: the "seen" mark in
 * user_hints is keyed on the announcement and the moment it was last
 * (re)announced, so Umumkan ulang makes it new for everyone.
 */

export interface AnnouncementRow {
  key: string
  enabled: boolean
  /** Set only by Umumkan ulang; null while the release date is the stamp. */
  announced_at: string | null
}

export interface AnnouncementState extends Announcement {
  /** The release date, from the changelog. */
  date: string
  enabled: boolean
  /** ISO instant of the last Umumkan ulang; the release date when never re-announced. */
  announcedAt: string
  /** user_hints key written when the person closes the dialog. */
  seenKey: string
  /** user_hints key written when the person opens Yang baru afterwards. */
  readKey: string
  /** Whether an admin has ever used Umumkan ulang on it. A switch alone does not count. */
  reannounced: boolean
}

/** At most this many items in one dialog: the newest, the rest wait in Yang baru. */
export const MAX_ANNOUNCED = 3

const stamp = (iso: string) => Math.floor(Date.parse(iso) / 1000)

/** Every announceable release, newest first, with this unit's on/off applied. */
export function announcementStates(rows: readonly AnnouncementRow[]): AnnouncementState[] {
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return CHANGELOG.flatMap((entry) => {
    const announcement = entry.announcement
    if (!announcement) return []
    const row = byKey.get(announcement.key)
    const announcedAt = row?.announced_at ?? `${entry.date}T00:00:00+07:00`
    const enabled = row ? row.enabled : announcement.defaultOn ?? true
    const at = stamp(announcedAt)
    return [
      {
        ...announcement,
        date: entry.date,
        enabled,
        announcedAt,
        seenKey: `announce-${announcement.key}-${at}`,
        readKey: `read-${announcement.key}-${at}`,
        reannounced: Boolean(row?.announced_at),
      },
    ]
  })
}

/** What the dialog shows this person now: on, not yet closed, newest first, capped. */
export function pendingAnnouncements(states: readonly AnnouncementState[], seen: ReadonlySet<string>): AnnouncementState[] {
  return states.filter((state) => state.enabled && !seen.has(state.seenKey)).slice(0, MAX_ANNOUNCED)
}

/** What still earns the dot on Yang baru: on, and the page not opened since. */
export function unreadAnnouncements(states: readonly AnnouncementState[], seen: ReadonlySet<string>): AnnouncementState[] {
  return states.filter((state) => state.enabled && !seen.has(state.readKey))
}

/** The keys the code knows, for validating a settings write. */
export function announcementKeys(): Set<string> {
  return new Set(announcementStates([]).map((state) => state.key))
}
