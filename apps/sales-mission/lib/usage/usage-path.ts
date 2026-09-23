/**
 * Which page a usage row is about, and what it is called on screen.
 *
 * A path is recorded the way a product analytics tool records a screen: its
 * route, not its address. Ids become `:id` and the query string is dropped,
 * so `/workspace/activities/8f3c…?fokus=laporan` is counted as
 * `/workspace/activities/:id` — one row per kind of page, and no record id
 * ever lands in a usage table (Salesforce's Lightning Usage App counts pages
 * the same way, by page type).
 */

/** The longest path a usage row accepts, in the database check as well. */
export const USAGE_PATH_MAX = 200

/** Every path the beacon records lives under this. */
export const USAGE_PATH_PREFIX = "/workspace"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC = /^\d+$/
/** An opaque token (a long run of letters and digits): an id by another name. */
const OPAQUE = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/

function isIdSegment(segment: string): boolean {
  return UUID.test(segment) || NUMERIC.test(segment) || OPAQUE.test(segment)
}

/**
 * The route a URL path belongs to: query and fragment dropped, empty and
 * trailing segments removed, ids replaced by `:id`. Idempotent, so the
 * server can run it again on what the browser already normalised.
 */
export function normalizeUsagePath(raw: string): string {
  const bare = raw.split(/[?#]/, 1)[0] ?? ""
  const segments = bare
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => (isIdSegment(segment) ? ":id" : segment))
  const path = `/${segments.join("/")}`
  return path.length > USAGE_PATH_MAX ? path.slice(0, USAGE_PATH_MAX) : path
}

/** A path the usage tables accept: under /workspace and short enough. */
export function isUsagePath(path: string): boolean {
  return (path === USAGE_PATH_PREFIX || path.startsWith(`${USAGE_PATH_PREFIX}/`)) && path.length <= USAGE_PATH_MAX
}

const PAGE_LABELS: Record<string, string> = {
  "/workspace": "Hari ini",
  "/workspace/activities": "Aktivitas",
  "/workspace/activities/new": "Buat aktivitas",
  "/workspace/activities/:id": "Detail aktivitas",
  "/workspace/activities/:id/edit": "Ubah aktivitas",
  "/workspace/activities/:id/report": "Laporan kunjungan",
  "/workspace/prospects": "Prospek",
  "/workspace/prospects/new": "Prospek baru",
  "/workspace/prospects/:id": "Detail prospek",
  "/workspace/prospects/:id/edit": "Ubah prospek",
  "/workspace/reports": "Laporan · Daftar",
  "/workspace/reports/ringkasan": "Laporan · Ringkasan",
  "/workspace/reports/insight": "Laporan · Insight",
  "/workspace/calendar": "Kalender",
  "/workspace/kalender-saya": "Kalender saya",
  "/workspace/board": "Papan live",
  "/workspace/notifications": "Notifikasi",
  "/workspace/panduan": "Panduan",
  "/workspace/pasang": "Pasang di ponsel",
  "/workspace/yang-baru": "Yang baru",
  "/workspace/settings": "Pengaturan",
}

/** Pengaturan's pages by what follows /workspace/settings/, named as their cards are. */
const SETTINGS_LABELS: Record<string, string> = {
  activities: "Aturan aktivitas",
  ai: "AI",
  "ai/pemakaian": "Pemakaian AI",
  announcements: "Pengumuman",
  board: "Tautan publik",
  data: "Data",
  "follow-up": "Tindak lanjut",
  form: "Form aktivitas",
  history: "Riwayat perubahan",
  "prospect-form": "Form prospek",
  "prospect-statuses": "Status prospek",
  "recycle-bin": "Sampah",
  "report-form": "Form laporan",
  usage: "Pemakaian",
}

/**
 * The product's own name for a recorded path ("Detail aktivitas",
 * "Laporan · Ringkasan", "Pengaturan · Riwayat perubahan"). A path the app
 * does not know yet (a page added later) is shown as itself rather than
 * guessed at.
 */
export function usagePageLabel(path: string): string {
  const known = PAGE_LABELS[path]
  if (known) return known
  const settingsPrefix = "/workspace/settings/"
  if (path.startsWith(settingsPrefix)) {
    const setting = SETTINGS_LABELS[path.slice(settingsPrefix.length)]
    if (setting) return `Pengaturan · ${setting}`
  }
  return path
}
