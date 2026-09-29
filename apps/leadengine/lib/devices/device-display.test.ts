import { describe, expect, it } from "vitest"
import {
    activityLabel,
    appLabel,
    deviceErrorMessage,
    deviceMeta,
    deviceName,
    placeLabel,
    sortDevices,
    toDeviceViews,
    type DeviceRow,
} from "./device-display"

const NOW = new Date("2026-09-29T05:00:00Z")

function row(overrides: Partial<DeviceRow>): DeviceRow {
    return {
        session_id: "s",
        app: null,
        user_agent: null,
        city: null,
        country: null,
        first_seen_at: null,
        last_seen_at: null,
        is_current: false,
        ...overrides,
    }
}

describe("deviceName", () => {
    it("names browser and system", () => {
        expect(deviceName({ browser: "Chrome", os: "Windows", kind: "desktop" })).toBe("Chrome on Windows")
    })
    it("falls back to what is known", () => {
        expect(deviceName({ browser: "Safari", os: null, kind: "unknown" })).toBe("Safari")
        expect(deviceName({ browser: null, os: "iPhone", kind: "phone" })).toBe("iPhone")
        expect(deviceName({ browser: null, os: null, kind: "unknown" })).toBe("Unknown device")
    })
})

describe("placeLabel", () => {
    it("is the city and the country's name", () => {
        expect(placeLabel("Jakarta", "ID")).toBe("Jakarta, Indonesia")
    })
    it("is whichever half is known", () => {
        expect(placeLabel(null, "SG")).toBe("Singapore")
        expect(placeLabel("Bandung", null)).toBe("Bandung")
    })
    it("is nothing without either, or with a malformed code", () => {
        expect(placeLabel(" ", null)).toBeNull()
        expect(placeLabel(null, "Indonesia")).toBeNull()
    })
})

describe("activityLabel", () => {
    it("says this device is active now", () => {
        expect(activityLabel("2026-01-01T00:00:00Z", true, NOW)).toBe("Active now")
    })
    it("counts a device seen minutes ago as active now", () => {
        expect(activityLabel("2026-09-29T04:52:00Z", false, NOW)).toBe("Active now")
    })
    it("says when it was last active otherwise", () => {
        expect(activityLabel("2026-09-29T03:00:00Z", false, NOW)).toBe("Last active 2 hours ago")
        expect(activityLabel("2026-09-28T03:00:00Z", false, NOW)).toBe("Last active yesterday")
        expect(activityLabel("2026-09-25T03:00:00Z", false, NOW)).toBe("Last active 4 days ago")
    })
    it("says nothing without a time", () => {
        expect(activityLabel(null, false, NOW)).toBeNull()
        expect(activityLabel("not a date", false, NOW)).toBeNull()
    })
})

describe("appLabel", () => {
    it("uses each product's own name", () => {
        expect(appLabel("leadengine")).toBe("LeadEngine")
        expect(appLabel("sales_activity")).toBe("Sales Activity")
        expect(appLabel(null)).toBeNull()
        expect(appLabel("crm")).toBeNull()
    })
})

describe("deviceMeta", () => {
    it("joins place, time and app, leaving out what is missing", () => {
        expect(deviceMeta(row({ city: "Jakarta", country: "ID", last_seen_at: "2026-09-29T03:00:00Z", app: "sales_activity" }), NOW))
            .toBe("Jakarta, Indonesia · Last active 2 hours ago · Sales Activity")
        expect(deviceMeta(row({ is_current: true, app: "leadengine" }), NOW)).toBe("Active now · LeadEngine")
        expect(deviceMeta(row({}), NOW)).toBe("")
    })
})

describe("sortDevices and toDeviceViews", () => {
    const rows = [
        row({ session_id: "old", last_seen_at: "2026-09-01T00:00:00Z" }),
        row({ session_id: "recent", last_seen_at: "2026-09-29T03:00:00Z", user_agent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36" }),
        row({ session_id: "here", is_current: true, last_seen_at: "2026-09-20T00:00:00Z", user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0" }),
    ]

    it("puts this device first, then the most recently used", () => {
        expect(sortDevices(rows).map((r) => r.session_id)).toEqual(["here", "recent", "old"])
    })

    it("draws a name, a kind and a meta line for each", () => {
        const views = toDeviceViews(rows, NOW)
        expect(views[0]).toEqual({ sessionId: "here", name: "Edge on Windows", kind: "desktop", meta: "Active now", isCurrent: true })
        expect(views[1]).toMatchObject({ name: "Chrome on Android", kind: "phone", meta: "Last active 2 hours ago", isCurrent: false })
        expect(views[2]).toMatchObject({ name: "Unknown device", kind: "unknown" })
    })
})

describe("deviceErrorMessage", () => {
    it("explains the refusals the database raises", () => {
        expect(deviceErrorMessage("current_session")).toMatch(/Sign out in the account menu/)
        expect(deviceErrorMessage("not_authenticated")).toMatch(/Sign in again/)
    })
    it("says to try again for anything else", () => {
        expect(deviceErrorMessage("boom")).toBe("The device could not be signed out. Try again.")
    })
})
