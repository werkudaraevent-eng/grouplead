import { describe, expect, it } from "vitest"
import { buildBoardSnapshot, maskClientName, formatTeamNext } from "./board-snapshot"
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

// 2026-09-01T10:00 WIB
const NOW = new Date("2026-09-01T03:00:00.000Z")

describe("maskClientName", () => {
  it("keeps a legal prefix and reduces the distinguishing word to one letter", () => {
    expect(maskClientName("PT Arunika Kreasi")).toBe("PT A•••")
    expect(maskClientName("CV Bina Ruang")).toBe("CV B•••")
  })

  it("masks a name with no legal prefix down to its first letter", () => {
    expect(maskClientName("Bina Ruang Nusantara")).toBe("B•••")
  })

  it("does not leak the second word when the prefix is the whole name", () => {
    expect(maskClientName("PT")).toBe("P•••")
  })

  it("handles blank and whitespace-only input", () => {
    expect(maskClientName("")).toBe("•••")
    expect(maskClientName("   ")).toBe("•••")
  })

  it("never returns the original name for a real company", () => {
    const original = "Langit Panggung Indonesia"
    expect(maskClientName(original)).not.toBe(original)
    expect(maskClientName(original)).not.toContain("Panggung")
  })
})

describe("buildBoardSnapshot", () => {
  const missions = [
    mission({ id: "a", scheduledStart: "2026-09-01T06:00:00.000Z", status: "ACCEPTED" }),
    mission({ id: "b", scheduledStart: "2026-09-01T02:30:00.000Z", status: "COMPLETED" }),
    // Tomorrow — counts as open, but not part of today's board.
    mission({ id: "tomorrow", scheduledStart: "2026-09-02T02:30:00.000Z" }),
    // Unscheduled — cannot appear on a day board.
    mission({ id: "unscheduled", scheduledStart: null, status: "DRAFT" }),
  ]

  it("shows only today's missions, earliest first", () => {
    const snapshot = buildBoardSnapshot(missions, NOW, { masked: false })
    expect(snapshot.missions.map((item) => item.id)).toEqual(["b", "a"])
  })

  it("masks client names only when asked", () => {
    const open = buildBoardSnapshot(missions, NOW, { masked: false })
    expect(open.missions[0].clientLabel).toBe("PT Arunika Kreasi")

    const tv = buildBoardSnapshot(missions, NOW, { masked: true })
    expect(tv.missions[0].clientLabel).toBe("PT A•••")
  })

  it("never masks people — seeing who is in the field is the point", () => {
    const tv = buildBoardSnapshot(missions, NOW, { masked: true })
    expect(tv.missions[0].primarySalesName).toBe("Wg, Hanung")
    expect(tv.team[0].name).toBe("Wg, Hanung")
  })

  it("counts today's totals separately from open missions across all days", () => {
    const snapshot = buildBoardSnapshot(missions, NOW, { masked: false })
    expect(snapshot.counts.todayTotal).toBe(2)
    expect(snapshot.counts.accepted).toBe(1)
    expect(snapshot.counts.completed).toBe(1)
    // a (ACCEPTED) + tomorrow (ASSIGNED); the completed and draft ones are not open.
    expect(snapshot.counts.openMissions).toBe(2)
  })

  it("counts a supporting sales as being out, and dedupes within one mission", () => {
    const shared = [
      mission({ id: "x", primarySalesName: "Nadia", supportingSalesNames: ["Raka"] }),
      mission({
        id: "y",
        scheduledStart: "2026-09-01T07:00:00.000Z",
        primarySalesName: "Raka",
        supportingSalesNames: ["Raka"],
      }),
    ]
    const snapshot = buildBoardSnapshot(shared, NOW, { masked: true })
    expect(snapshot.team.map(({ name, missionCount }) => ({ name, missionCount }))).toEqual([
      { name: "Raka", missionCount: 2 },
      { name: "Nadia", missionCount: 1 },
    ])
  })

  it("takes a cancelled visit off the board entirely", () => {
    const called_off = [
      mission({ id: "gone", status: "CANCELLED" as MissionStatus, primarySalesName: "Nadia" }),
      mission({ id: "refused", scheduledStart: "2026-09-01T04:00:00.000Z", status: "REJECTED" as MissionStatus, primarySalesName: "Raka" }),
    ]
    const snapshot = buildBoardSnapshot(called_off, NOW, { masked: false })
    expect(snapshot.missions).toEqual([])
    expect(snapshot.days[0].missions).toEqual([])
  })

  it("does not count a cancelled visit as someone being in the field", () => {
    // The bug this guards: one cancelled visit made the wall say "1 kunjungan
    // · 1 orang di lapangan" while that person sat at their desk.
    const called_off = [mission({ id: "gone", status: "CANCELLED" as MissionStatus, primarySalesName: "Nadia" })]
    const snapshot = buildBoardSnapshot(called_off, NOW, { masked: false })
    expect(snapshot.team).toEqual([])
    expect(snapshot.counts.todayTotal).toBe(0)
    expect(snapshot.counts.openMissions).toBe(0)
  })

  it("keeps the visits around a cancelled one", () => {
    const mixed = [
      mission({ id: "keep", primarySalesName: "Nadia" }),
      mission({ id: "gone", scheduledStart: "2026-09-01T04:00:00.000Z", status: "CANCELLED" as MissionStatus, primarySalesName: "Nadia" }),
    ]
    const snapshot = buildBoardSnapshot(mixed, NOW, { masked: false })
    expect(snapshot.missions.map((item) => item.id)).toEqual(["keep"])
    expect(snapshot.team).toEqual([{ name: "Nadia", missionCount: 1, next: null }])
  })

  it("renders times in mission time, not UTC", () => {
    const snapshot = buildBoardSnapshot(missions, NOW, { masked: true })
    // 02:30Z is 09.30 WIB.
    expect(snapshot.missions[0].time).toBe("09.30")
  })

  it("treats a late-evening WIB mission as today, not tomorrow", () => {
    // 2026-09-01T23:30 WIB === 2026-09-01T16:30Z.
    const late = [mission({ id: "late", scheduledStart: "2026-09-01T16:30:00.000Z" })]
    expect(buildBoardSnapshot(late, NOW, { masked: true }).missions).toHaveLength(1)
  })

  it("returns an empty board rather than failing on a quiet day", () => {
    const snapshot = buildBoardSnapshot([], NOW, { masked: true })
    expect(snapshot.missions).toEqual([])
    expect(snapshot.team).toEqual([])
    expect(snapshot.counts.todayTotal).toBe(0)
  })

  it("ignores missions with an unparseable schedule", () => {
    const broken = [mission({ id: "broken", scheduledStart: "not-a-date" })]
    expect(buildBoardSnapshot(broken, NOW, { masked: true }).missions).toEqual([])
  })
})

describe("buildBoardSnapshot ranges and filters", () => {
  // NOW is Tue 1 Sep 2026 (see top of file). The week is Mon 31 Aug – Sun 6 Sep.
  const spread = [
    mission({ id: "mon", scheduledStart: "2026-08-31T02:30:00.000Z", assigneeIds: ["u1"], location: "Bogor" }),
    mission({ id: "tue", scheduledStart: "2026-09-01T02:30:00.000Z", assigneeIds: ["u2"], location: "Jakarta" }),
    mission({ id: "sun", scheduledStart: "2026-09-06T02:30:00.000Z", assigneeIds: ["u1", "u2"], location: "Jakarta" }),
    mission({ id: "next-mon", scheduledStart: "2026-09-07T02:30:00.000Z", assigneeIds: ["u1"] }),
  ]

  it("shows the Monday-first week and groups it by day", () => {
    const snapshot = buildBoardSnapshot(spread, NOW, { masked: false, range: "week" })
    expect(snapshot.from).toBe("2026-08-31")
    expect(snapshot.to).toBe("2026-09-06")
    expect(snapshot.missions.map((m) => m.id)).toEqual(["mon", "tue", "sun"])
    expect(snapshot.days).toHaveLength(7)
    expect(snapshot.days[1].isToday).toBe(true)
    expect(snapshot.days[6].missions.map((m) => m.id)).toEqual(["sun"])
  })

  it("narrows to the chosen people and places before counting anything", () => {
    const byPerson = buildBoardSnapshot(spread, NOW, { masked: false, range: "week", sales: ["u2"] })
    expect(byPerson.missions.map((m) => m.id)).toEqual(["tue", "sun"])
    const byPlace = buildBoardSnapshot(spread, NOW, { masked: false, range: "week", location: ["bogor"] })
    expect(byPlace.missions.map((m) => m.id)).toEqual(["mon"])
    expect(byPlace.counts.openMissions).toBe(1)
  })

  it("tells each person where they are headed next", () => {
    // NOW is 10:00 WIB; the Tuesday visit at 09:30 has started, so it is not "next".
    const snapshot = buildBoardSnapshot(spread, NOW, { masked: true, range: "week" })
    const u2 = snapshot.team.find((m) => m.name === "Wg, Hanung")
    expect(u2?.next?.time).toBe("09.30")
    expect(u2?.next?.client).toMatch(/^PT A•••$/)
    expect(u2?.next?.isToday).toBe(false)
    expect(u2?.next?.day).toBe("Min, 6 Sep")
    expect(formatTeamNext(u2?.next ?? null)).toMatch(/09\.30 · PT A•••$/)
  })
})
