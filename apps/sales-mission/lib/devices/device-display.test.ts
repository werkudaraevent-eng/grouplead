import { describe, expect, it } from "vitest"
import { activityLabel, appLabel, deviceMeta, deviceName, placeLabel, sortDevices, toDeviceViews, type DeviceRow } from "./device-display"

const NOW = new Date("2026-09-29T05:00:00Z") // 12.00 WIB

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
  it("names browser and system in Indonesian", () => {
    expect(deviceName({ browser: "Safari", os: "iPhone", kind: "phone" })).toBe("Safari di iPhone")
  })
  it("falls back to what is known", () => {
    expect(deviceName({ browser: "Chrome", os: null, kind: "unknown" })).toBe("Chrome")
    expect(deviceName({ browser: null, os: "Android", kind: "phone" })).toBe("Android")
    expect(deviceName({ browser: null, os: null, kind: "unknown" })).toBe("Perangkat tak dikenal")
  })
})

describe("placeLabel", () => {
  it("is the city when there is one", () => {
    expect(placeLabel("Jakarta", "ID")).toBe("Jakarta")
  })
  it("is the country's name without a city", () => {
    expect(placeLabel(null, "ID")).toBe("Indonesia")
    expect(placeLabel("  ", "sg")).toBe("Singapura")
  })
  it("is nothing without either, or with a malformed code", () => {
    expect(placeLabel(null, null)).toBeNull()
    expect(placeLabel(null, "Indonesia")).toBeNull()
  })
})

describe("activityLabel", () => {
  it("says this device is active now", () => {
    expect(activityLabel("2026-01-01T00:00:00Z", true, NOW)).toBe("Aktif sekarang")
  })
  it("counts a device seen minutes ago as active now", () => {
    expect(activityLabel("2026-09-29T04:52:00Z", false, NOW)).toBe("Aktif sekarang")
  })
  it("says how long ago otherwise, as Pemakaian does", () => {
    expect(activityLabel("2026-09-29T03:00:00Z", false, NOW)).toBe("2 jam lalu")
    expect(activityLabel("2026-09-28T03:00:00Z", false, NOW)).toBe("Kemarin")
    expect(activityLabel("2026-09-25T03:00:00Z", false, NOW)).toBe("4 hari lalu")
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
    expect(deviceMeta(row({ city: "Jakarta", last_seen_at: "2026-09-29T03:00:00Z", app: "leadengine" }), NOW)).toBe("Jakarta · 2 jam lalu · LeadEngine")
    expect(deviceMeta(row({ is_current: true, app: "sales_activity" }), NOW)).toBe("Aktif sekarang · Sales Activity")
    expect(deviceMeta(row({ last_seen_at: "2026-09-25T03:00:00Z" }), NOW)).toBe("4 hari lalu")
  })
})

describe("sortDevices and toDeviceViews", () => {
  const rows = [
    row({ session_id: "old", last_seen_at: "2026-09-01T00:00:00Z" }),
    row({ session_id: "recent", last_seen_at: "2026-09-29T03:00:00Z", user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36" }),
    row({ session_id: "here", is_current: true, last_seen_at: "2026-09-20T00:00:00Z", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1" }),
    row({ session_id: "never" }),
  ]

  it("puts this device first, then the most recently used", () => {
    expect(sortDevices(rows).map((r) => r.session_id)).toEqual(["here", "recent", "old", "never"])
  })

  it("draws a name, a kind and a meta line for each", () => {
    const views = toDeviceViews(rows, NOW)
    expect(views[0]).toEqual({ sessionId: "here", name: "Safari di iPhone", kind: "phone", meta: "Aktif sekarang", isCurrent: true })
    expect(views[1]).toMatchObject({ name: "Chrome di Windows", kind: "desktop", meta: "2 jam lalu", isCurrent: false })
    expect(views[3]).toMatchObject({ name: "Perangkat tak dikenal", kind: "unknown", meta: "" })
  })
})
