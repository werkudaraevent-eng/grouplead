/**
 * What a board shows, as chosen by the person looking at it.
 *
 * Carried in the URL for both the dashboard in the app and the screen link,
 * so "set it up here, send it to the TV" is the same set of parameters. One
 * thing is deliberately NOT here: whether client names are shown. That is a
 * privacy decision, bound to the screen link when it is made, because a
 * parameter anyone holding the link could edit is not a control.
 */

export const BOARD_RANGES = ["today", "week"] as const
export type BoardRange = (typeof BOARD_RANGES)[number]

export const BOARD_RANGE_LABELS: Record<BoardRange, string> = {
  today: "Hari ini",
  week: "Minggu ini",
}

export const BOARD_PANELS = ["counts", "schedule", "team", "activity"] as const
export type BoardPanel = (typeof BOARD_PANELS)[number]

export const BOARD_PANEL_LABELS: Record<BoardPanel, string> = {
  counts: "Ringkasan di header",
  schedule: "Jadwal",
  team: "Tim",
  activity: "Aktivitas",
}

export interface BoardOptions {
  range: BoardRange
  /** User ids. Empty means everyone. */
  sales: string[]
  /** Location strings as stored on missions. Empty means everywhere. */
  location: string[]
  /** Which panels are on. Never empty: a board with nothing on it is a bug, not a choice. */
  panels: BoardPanel[]
}

export const DEFAULT_BOARD_OPTIONS: BoardOptions = {
  range: "today",
  sales: [],
  location: [],
  panels: [...BOARD_PANELS],
}

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "")
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))]
}

export function parseBoardOptions(params: Record<string, string | string[] | undefined>): BoardOptions {
  const range = Array.isArray(params.range) ? params.range[0] : params.range
  const panels = list(params.panels).filter((panel): panel is BoardPanel => BOARD_PANELS.includes(panel as BoardPanel))
  return {
    range: BOARD_RANGES.includes(range as BoardRange) ? (range as BoardRange) : "today",
    sales: list(params.sales),
    location: list(params.location),
    panels: panels.length > 0 ? panels : [...BOARD_PANELS],
  }
}

/** Only what differs from the default is written, so a plain link stays plain. */
export function serializeBoardOptions(options: BoardOptions): URLSearchParams {
  const params = new URLSearchParams()
  if (options.range !== "today") params.set("range", options.range)
  if (options.sales.length) params.set("sales", options.sales.join(","))
  if (options.location.length) params.set("location", options.location.join(","))
  if (options.panels.length !== BOARD_PANELS.length) params.set("panels", options.panels.join(","))
  return params
}

export function isDefaultBoardOptions(options: BoardOptions): boolean {
  return serializeBoardOptions(options).toString() === ""
}
