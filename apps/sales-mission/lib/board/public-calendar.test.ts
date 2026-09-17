import { describe, expect, it } from "vitest"
import { parsePublicSales, publicCalendarHref, publicCalendarMissions } from "./public-calendar"
import { boardTokenUrl } from "./board-access"
import type { MissionListItem, MissionStatus } from "@/lib/missions/mission-schema"

function mission(overrides: Partial<MissionListItem> & { id: string }): MissionListItem {
  return {
    clientCompanyName: "PT Arunika Kreasi",
    clientCompanyId: null,
    missionType: "Meeting",
    status: "ASSIGNED" as MissionStatus,
    location: "Jakarta Selatan",
    address: null,
    objective: null,
    scheduledStart: "2026-09-01T02:30:00.000Z",
    scheduledEnd: null,
    primarySalesName: "Wg, Hanung",
    supportingSalesNames: [],
    primarySalesId: null,
    assigneeIds: [],
    allowJoin: true,
    createdBy: "creator",
    createdByName: "Pembuat",
    createdAt: "2026-09-01T01:00:00.000Z",
    reportStatus: "NONE",
    visitOutcome: null,
    supportingCount: 0,
    viewerRole: null,
    viewerResponse: null,
    pendingResponses: 0,
    appointment: {
      salutation: null,
      contactId: null,
      name: null,
      jobTitle: null,
      division: null,
      phone: null,
      email: null,
      building: null,
      notes: null,
    },
    ...overrides,
  }
}

const ALICE = "11111111-1111-1111-1111-111111111111"
const BUDI = "22222222-2222-2222-2222-222222222222"

describe("parsePublicSales", () => {
  it("keeps user ids, once each", () => {
    expect(parsePublicSales(`${ALICE},${BUDI},${ALICE}`)).toEqual([ALICE, BUDI])
  })

  it("drops the 'me' sentinel, which has no meaning without a viewer", () => {
    expect(parsePublicSales(`me,${ALICE}`)).toEqual([ALICE])
    expect(parsePublicSales("me")).toEqual([])
  })

  it("reads nothing out of rubbish", () => {
    expect(parsePublicSales(undefined)).toEqual([])
    expect(parsePublicSales("")).toEqual([])
    expect(parsePublicSales("' OR 1=1 --")).toEqual([])
  })
})

describe("publicCalendarHref", () => {
  it("writes the month, and only what else was asked for", () => {
    expect(publicCalendarHref("tok", { month: "2026-09", sales: [] })).toBe("/jadwal/tok?month=2026-09")
    expect(publicCalendarHref("tok", { month: "2026-09", day: "2026-09-17", sales: [ALICE] })).toBe(
      `/jadwal/tok?month=2026-09&day=2026-09-17&sales=${ALICE}`
    )
  })

  it("escapes the token rather than pasting it into the path", () => {
    expect(publicCalendarHref("a/b?c", { month: "2026-09", sales: [] })).toBe("/jadwal/a%2Fb%3Fc?month=2026-09")
  })
})

describe("boardTokenUrl", () => {
  it("sends each kind of link to its own route", () => {
    expect(boardTokenUrl("https://x.test", "screen", "tok")).toBe("https://x.test/board?token=tok")
    expect(boardTokenUrl("https://x.test", "calendar", "tok")).toBe("https://x.test/jadwal/tok")
  })
})

describe("publicCalendarMissions", () => {
  const missions = [
    mission({ id: "a", assigneeIds: [ALICE] }),
    mission({ id: "b", assigneeIds: [BUDI], clientCompanyName: "CV Bina Ruang" }),
    mission({ id: "c", assigneeIds: [ALICE], status: "CANCELLED" as MissionStatus }),
    mission({ id: "d", assigneeIds: [BUDI], status: "REJECTED" as MissionStatus }),
  ]

  it("leaves cancelled and refused visits off the calendar", () => {
    expect(publicCalendarMissions(missions, { sales: [], masked: false }).map((m) => m.id)).toEqual(["a", "b"])
  })

  it("narrows to the people the link asked for", () => {
    expect(publicCalendarMissions(missions, { sales: [BUDI], masked: false }).map((m) => m.id)).toEqual(["b"])
  })

  it("masks client names when the link was made without them", () => {
    const [first, second] = publicCalendarMissions(missions, { sales: [], masked: true })
    expect(first.clientCompanyName).toBe("PT A•••")
    expect(second.clientCompanyName).toBe("CV B•••")
  })

  it("shows the real names when the link was made with them", () => {
    expect(publicCalendarMissions(missions, { sales: [], masked: false })[0].clientCompanyName).toBe("PT Arunika Kreasi")
  })

  it("never mutates what it was given", () => {
    publicCalendarMissions(missions, { sales: [], masked: true })
    expect(missions[0].clientCompanyName).toBe("PT Arunika Kreasi")
  })
})
