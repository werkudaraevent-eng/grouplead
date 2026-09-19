/**
 * An audio answer: what an AUDIO field stores.
 *
 * The phone records (Memo Suara, or any recorder that survives a locked
 * screen and an incoming call); the app keeps the file. It lives in the
 * private bucket under <company>/<scope>/<uuid>.m4a; the answer is the
 * list of those paths with the facts a list screen needs without opening
 * the file. Pure, so the form, the server and the detail page agree.
 */

export const AUDIO_BUCKET = "sales_mission_audio"
export const AUDIO_MAX_FILES = 3
/** Matches Supabase's default per-file cap; a compressed Voice Memo runs about 30 MB an hour. */
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024

export interface AudioAnswer {
  path: string
  name: string
  size: number
  /** Length in milliseconds, read on the device when the file was picked. */
  durationMs?: number
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
export const AUDIO_EXTENSIONS = ["m4a", "mp4", "aac", "mp3", "webm", "ogg", "wav", "caf"] as const
export const AUDIO_PATH_PATTERN = new RegExp(`^${UUID}/[A-Za-z0-9_-]{1,60}/${UUID}\\.(${AUDIO_EXTENSIONS.join("|")})$`)

/** What the bucket accepts; the same list gates the picker and the upload. */
export const AUDIO_MIME_TYPES = [
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/mpeg", "audio/mp3",
  "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave", "audio/x-caf",
] as const

/** The extension a file gets from its type, or its name when the browser reports none (iOS often sends "" for a Voice Memo). */
export function audioExtension(type: string, name: string): (typeof AUDIO_EXTENSIONS)[number] | null {
  const byType: Record<string, (typeof AUDIO_EXTENSIONS)[number]> = {
    "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/webm": "webm", "audio/ogg": "ogg",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/x-caf": "caf",
  }
  if (byType[type]) return byType[type]
  const fromName = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return (AUDIO_EXTENSIONS as readonly string[]).includes(fromName ?? "") ? (fromName as (typeof AUDIO_EXTENSIONS)[number]) : null
}

function isAudio(value: unknown): value is AudioAnswer {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.path === "string" &&
    AUDIO_PATH_PATTERN.test(item.path) &&
    typeof item.name === "string" &&
    item.name.length <= 200 &&
    typeof item.size === "number" &&
    item.size >= 0 &&
    item.size <= AUDIO_MAX_BYTES &&
    (item.durationMs === undefined || (typeof item.durationMs === "number" && item.durationMs >= 0))
  )
}

/** The valid recordings in a stored value; anything malformed is dropped rather than shown broken. */
export function parseAudioAnswer(value: unknown): AudioAnswer[] {
  const list = typeof value === "string" ? safeJson(value) : value
  if (!Array.isArray(list)) return []
  return list.filter(isAudio).map((item) => ({
    path: item.path,
    name: item.name,
    size: item.size,
    ...(typeof item.durationMs === "number" ? { durationMs: item.durationMs } : {}),
  }))
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Why a submitted audio answer is refused, or null. */
export function audioAnswerViolation(value: unknown, label: string, max = AUDIO_MAX_FILES): string | null {
  if (value === null || value === undefined || value === "") return null
  const list = typeof value === "string" ? (value.trim() === "" ? null : safeJson(value)) : value
  if (list === null) return typeof value === "string" && value.trim() !== "" ? `${label} tidak valid.` : null
  if (!Array.isArray(list)) return `${label} tidak valid.`
  if (list.length > max) return `${label} maksimal ${max} rekaman.`
  if (!list.every(isAudio)) return `${label} berisi berkas yang tidak dikenal.`
  return null
}

/** Whether a stored path belongs to this company's folder. Every server move checks it. */
export function isCompanyAudio(path: string, companyId: string): boolean {
  return AUDIO_PATH_PATTERN.test(path) && path.startsWith(`${companyId}/`)
}

export function describeAudioCount(count: number): string {
  return count === 1 ? "1 rekaman" : `${count} rekaman`
}

/** "1:05:09" past an hour, "12:07" under it. */
export function formatDuration(durationMs: number): string {
  const total = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes)
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`
}

/** "3,2 MB" the way a phone shows a file size. */
export function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}
