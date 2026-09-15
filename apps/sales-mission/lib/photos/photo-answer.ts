/**
 * A photo answer: what a PHOTO field stores.
 *
 * The file itself lives in the private bucket under
 * <company>/<scope>/<uuid>.jpg; the answer is the list of those paths with
 * the facts a list screen needs without opening the file. Pure, so the
 * form, the server and the detail page agree on the shape.
 */

export const PHOTO_BUCKET = "sales_mission_photos"
export const PHOTO_MAX_FILES = 5
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
/** Longest edge after the phone-side downscale. Enough to read a business card. */
export const PHOTO_MAX_EDGE = 1600

export interface PhotoAnswer {
  path: string
  name: string
  size: number
  width?: number
  height?: number
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
export const PHOTO_PATH_PATTERN = new RegExp(`^${UUID}/[A-Za-z0-9_-]{1,60}/${UUID}\\.(jpg|jpeg|png|webp)$`)

function isPhoto(value: unknown): value is PhotoAnswer {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.path === "string" &&
    PHOTO_PATH_PATTERN.test(item.path) &&
    typeof item.name === "string" &&
    item.name.length <= 200 &&
    typeof item.size === "number" &&
    item.size >= 0 &&
    item.size <= PHOTO_MAX_BYTES
  )
}

/** The valid photos in a stored value; anything malformed is dropped rather than shown broken. */
export function parsePhotoAnswer(value: unknown): PhotoAnswer[] {
  const list = typeof value === "string" ? safeJson(value) : value
  if (!Array.isArray(list)) return []
  return list.filter(isPhoto).map((item) => ({
    path: item.path,
    name: item.name,
    size: item.size,
    ...(typeof item.width === "number" ? { width: item.width } : {}),
    ...(typeof item.height === "number" ? { height: item.height } : {}),
  }))
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Why a submitted photo answer is refused, or null. */
export function photoAnswerViolation(value: unknown, label: string, max = PHOTO_MAX_FILES): string | null {
  if (value === null || value === undefined || value === "") return null
  // A posted form carries the list as JSON; text that is not JSON is not an empty answer.
  const list = typeof value === "string" ? (value.trim() === "" ? null : safeJson(value)) : value
  if (list === null) return typeof value === "string" && value.trim() !== "" ? `${label} tidak valid.` : null
  if (!Array.isArray(list)) return `${label} tidak valid.`
  if (list.length > max) return `${label} maksimal ${max} foto.`
  if (!list.every(isPhoto)) return `${label} berisi berkas yang tidak dikenal.`
  return null
}

/** Whether a stored path belongs to this company's folder. Every server move checks it. */
export function isCompanyPhoto(path: string, companyId: string): boolean {
  return PHOTO_PATH_PATTERN.test(path) && path.startsWith(`${companyId}/`)
}

/** Fits the longest edge to the cap, keeping the ratio. */
export function fitWithin(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function describePhotoCount(count: number): string {
  return count === 1 ? "1 foto" : `${count} foto`
}
