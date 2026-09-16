import { describe, expect, it } from "vitest"
import { buildCalendar, escapeText, eventFromMission, eventStatusFor, foldLine, toUtcStamp } from "./ics"
import { googleCalendarLink } from "./google-link"
import type { MissionListItem } from "@/lib/missions/mission-schema"

const now = new Date("2026-09-17T02:00:00Z")

function mission(overrides: Partial<MissionListItem> = {}): MissionListItem {
  return {
    id: "m1",
    clientCompanyName: "PT Aruna, Tbk",
    clientCompanyId: null,
    missionType: "Sales Mission",
    status: "ACCEPTED",
    location: "Jakarta Selatan",
    address: "Jl. Sudirman 1",
    objective: "Presentasi; tanda tangan",
    scheduledStart: "2026-09-21T09:00:00+07:00",
    scheduledEnd: null,
    primarySalesName: "Kensrie",
    supportingSalesNames: ["Irvani"],
    primarySalesId: "u1",
    assigneeIds: ["u1", "u2"],
    allowJoin: true,
    createdBy: "u9",
    createdByName: "Admin",
    createdAt: "2026-09-01T00:00:00Z",
    reportStatus: "NONE",
    visitOutcome: null,
    appointment: { salutation: null, contactId: null, name: null, jobTitle: null, division: null, phone: null, email: null, building: "Menara BCA", notes: null },
    supportingCount: 1,
    viewerRole: null,
    viewerResponse: null,
    pendingResponses: 0,
    updatedAt: "2026-09-10T03:04:05Z",
    ...overrides,
  }
}

describe("ics text", () => {
  it("escapes what RFC 5545 reserves", () => {
    expect(escapeText("a,b;c\\d\r\ne")).toBe("a\\,b\\;c\\\\d\\ne")
  })

  it("writes UTC stamps in basic format", () => {
    expect(toUtcStamp(new Date("2026-09-21T02:00:00Z"))).toBe("20260921T020000Z")
  })

  it("folds at 75 octets, never inside a multi-byte character", () => {
    const ascii = "X".repeat(200)
    const folded = foldLine(`SUMMARY:${ascii}`)
    expect(folded.length).toBe(3)
    for (const line of folded) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75)
    expect(folded[1].startsWith(" ")).toBe(true)
    const wide = "é".repeat(80)
    for (const line of foldLine(`SUMMARY:${wide}`)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75)
      expect(line.replace(/^ /, "")).toMatch(/^(SUMMARY:)?é*$/)
    }
  })
})

describe("events from visits", () => {
  it("maps a visit to an event with an hour's default length and the team in the description", () => {
    const event = eventFromMission(mission(), { url: "https://mission.werkudara.group/workspace/activities/m1", host: "mission.werkudara.group" })
    expect(event).not.toBeNull()
    expect(event!.uid).toBe("m1@mission.werkudara.group")
    expect(event!.start.toISOString()).toBe("2026-09-21T02:00:00.000Z")
    expect(event!.end.toISOString()).toBe("2026-09-21T03:00:00.000Z")
    expect(event!.summary).toBe("PT Aruna, Tbk · Sales Mission")
    expect(event!.location).toBe("Jl. Sudirman 1, Menara BCA, Jakarta Selatan")
    expect(event!.description).toContain("Sales utama: Kensrie · Pendukung: Irvani")
    expect(event!.status).toBe("CONFIRMED")
    expect(event!.sequence).toBe(Math.floor(new Date("2026-09-10T03:04:05Z").getTime() / 1000))
  })

  it("skips a visit without a start and keeps a cancelled one as cancelled", () => {
    expect(eventFromMission(mission({ scheduledStart: null }), { url: "u", host: "h" })).toBeNull()
    expect(eventStatusFor("CANCELLED")).toBe("CANCELLED")
    expect(eventStatusFor("REJECTED")).toBe("CANCELLED")
    expect(eventStatusFor("SCHEDULED")).toBe("TENTATIVE")
    expect(eventStatusFor("COMPLETED")).toBe("CONFIRMED")
  })

  it("writes a calendar with CRLF ends, escaped text, and one VEVENT per visit", () => {
    const event = eventFromMission(mission(), { url: "https://x/m1", host: "x" })!
    const text = buildCalendar({ name: "Sales Activity · Kensrie", events: [event], now })
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true)
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(text).toContain("X-WR-CALNAME:Sales Activity · Kensrie\r\n")
    expect(text).toContain("SUMMARY:PT Aruna\\, Tbk · Sales Mission\r\n")
    expect(text).toContain("DTSTART:20260921T020000Z\r\n")
    expect(text).toContain("DESCRIPTION:Presentasi\\; tanda tangan\\n\\n")
    expect(text).toContain("STATUS:CONFIRMED\r\n")
    expect(text.split("BEGIN:VEVENT").length - 1).toBe(1)
    // No bare LF anywhere.
    expect(text.replace(/\r\n/g, "")).not.toContain("\n")
  })
})

describe("google calendar link", () => {
  it("fills the template with UTC times", () => {
    const event = eventFromMission(mission(), { url: "https://x/m1", host: "x" })!
    const link = googleCalendarLink(event)
    expect(link.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(true)
    expect(link).toContain("dates=20260921T020000Z%2F20260921T030000Z")
    expect(decodeURIComponent(link.replace(/\+/g, " "))).toContain("text=PT Aruna, Tbk · Sales Mission")
  })
})
