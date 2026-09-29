import { formatRelativeTime } from "@/lib/relative-time"
import { parseUserAgent, type DeviceKind, type ParsedUserAgent } from "./user-agent"

/**
 * How one signed-in device reads in Settings › Account › Active devices: its
 * name ("Chrome on Windows"), then one line of where, when and which app
 * ("Jakarta, Indonesia · Last active 2 hours ago · Sales Activity"). The
 * rows come from `public.fn_list_my_devices()`, shared with Sales
 * Activity, whose Perangkat aktif page says the same in Indonesian.
 */

export type DeviceApp = "leadengine" | "sales_activity"

/** A row of `fn_list_my_devices()`. */
export interface DeviceRow {
    session_id: string
    app: DeviceApp | null
    user_agent: string | null
    city: string | null
    country: string | null
    first_seen_at: string | null
    last_seen_at: string | null
    is_current: boolean
}

/** What the card draws for one device. */
export interface DeviceView {
    sessionId: string
    name: string
    kind: DeviceKind
    meta: string
    isCurrent: boolean
}

/**
 * Seen this recently reads as "Active now". The apps record a device at
 * most every five minutes while it is in use, so ten minutes covers a
 * device someone is on without calling one idle for an hour "now".
 */
export const ACTIVE_NOW_MS = 10 * 60_000

const APP_LABELS: Record<DeviceApp, string> = {
    leadengine: "LeadEngine",
    sales_activity: "Sales Activity",
}

export function appLabel(app: string | null | undefined): string | null {
    return app && app in APP_LABELS ? APP_LABELS[app as DeviceApp] : null
}

/** "Chrome on Windows"; one half when only one is known; otherwise "Unknown device". */
export function deviceName(parsed: ParsedUserAgent): string {
    if (parsed.browser && parsed.os) return `${parsed.browser} on ${parsed.os}`
    return parsed.browser ?? parsed.os ?? "Unknown device"
}

const regionNames = (() => {
    try {
        return new Intl.DisplayNames(["en"], { type: "region" })
    } catch {
        return null
    }
})()

function countryName(country: string | null | undefined): string | null {
    const code = country?.trim().toUpperCase()
    if (!code || !/^[A-Z]{2}$/.test(code)) return null
    try {
        return regionNames?.of(code) ?? code
    } catch {
        return code
    }
}

/** "Jakarta, Indonesia", or whichever half Vercel knew, or nothing. */
export function placeLabel(city: string | null | undefined, country: string | null | undefined): string | null {
    const parts = [city?.trim() || null, countryName(country)].filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(", ") : null
}

/** "Active now" for this device and one seen in the last minutes; otherwise "Last active 2 hours ago". */
export function activityLabel(lastSeenAt: string | null | undefined, isCurrent: boolean, now: Date): string | null {
    if (isCurrent) return "Active now"
    if (!lastSeenAt) return null
    const when = Date.parse(lastSeenAt)
    if (Number.isNaN(when)) return null
    if (now.getTime() - when < ACTIVE_NOW_MS) return "Active now"
    const ago = formatRelativeTime(lastSeenAt, now)
    return ago ? `Last active ${ago}` : null
}

export function deviceMeta(row: DeviceRow, now: Date): string {
    return [placeLabel(row.city, row.country), activityLabel(row.last_seen_at, row.is_current, now), appLabel(row.app)]
        .filter((part): part is string => Boolean(part))
        .join(" · ")
}

/** This device first, then the most recently used. */
export function sortDevices(rows: readonly DeviceRow[]): DeviceRow[] {
    const at = (row: DeviceRow) => {
        const when = row.last_seen_at ? Date.parse(row.last_seen_at) : Number.NaN
        return Number.isNaN(when) ? 0 : when
    }
    return [...rows].sort((a, b) => Number(b.is_current) - Number(a.is_current) || at(b) - at(a))
}

export function toDeviceViews(rows: readonly DeviceRow[], now: Date): DeviceView[] {
    return sortDevices(rows).map((row) => {
        const parsed = parseUserAgent(row.user_agent)
        return {
            sessionId: row.session_id,
            name: deviceName(parsed),
            kind: parsed.kind,
            meta: deviceMeta(row, now),
            isCurrent: row.is_current,
        }
    })
}

/**
 * The refusals the device functions raise, in the words the card shows.
 * Anything else is a failure to retry.
 */
export function deviceErrorMessage(message: string | null | undefined): string {
    switch (message) {
        case "current_session":
            return "This is the device you are using. To leave it, use Sign out in the account menu."
        case "no_current_session":
            return "This device's session could not be read. Reload the page and try again."
        case "not_authenticated":
            return "Your session has ended. Sign in again, then try again."
        default:
            return "The device could not be signed out. Try again."
    }
}
