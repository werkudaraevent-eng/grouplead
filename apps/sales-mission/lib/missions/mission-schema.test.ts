import { describe, expect, it } from "vitest"
import {
  createMissionSchema,
  formatMissionSchedule,
  mapMissions,
  toMissionTimestamp,
  type AssignmentRow,
  type MissionRow,
} from "./mission-schema"

const PRIMARY_ID = "11111111-1111-4111-8111-111111111111"
const SUPPORT_ID = "22222222-2222-4222-8222-222222222222"

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    clientCompanyName: "PT Arunika Kreasi",
    missionType: "Meeting",
    date: "2026-08-25",
    startTime: "09:30",
    primarySalesId: PRIMARY_ID,
    supportingSalesIds: [],
    ...overrides,
  }
}

describe("createMissionSchema", () => {
  it("accepts a minimal valid mission", () => {
    const result = createMissionSchema.safeParse(validInput())
    expect(result.success).toBe(true)
  })

  it("trims the client company name", () => {
    const result = createMissionSchema.safeParse(validInput({ clientCompanyName: "  PT Arunika  " }))
    expect(result.success && result.data.clientCompanyName).toBe("PT Arunika")
  })

  it("rejects a blank client company name", () => {
    const result = createMissionSchema.safeParse(validInput({ clientCompanyName: "   " }))
    expect(result.success).toBe(false)
  })

  it("rejects an end time at or before the start time", () => {
    expect(createMissionSchema.safeParse(validInput({ endTime: "09:30" })).success).toBe(false)
    expect(createMissionSchema.safeParse(validInput({ endTime: "09:00" })).success).toBe(false)
    expect(createMissionSchema.safeParse(validInput({ endTime: "10:00" })).success).toBe(true)
  })

  it("rejects the primary sales appearing as supporting sales", () => {
    const result = createMissionSchema.safeParse(validInput({ supportingSalesIds: [PRIMARY_ID] }))
    expect(result.success).toBe(false)
  })

  it("rejects duplicated supporting sales", () => {
    const result = createMissionSchema.safeParse(validInput({ supportingSalesIds: [SUPPORT_ID, SUPPORT_ID] }))
    expect(result.success).toBe(false)
  })

  it("rejects a malformed date or time", () => {
    expect(createMissionSchema.safeParse(validInput({ date: "25-08-2026" })).success).toBe(false)
    expect(createMissionSchema.safeParse(validInput({ startTime: "9:30" })).success).toBe(false)
  })

  it("rejects a non-uuid primary sales id", () => {
    expect(createMissionSchema.safeParse(validInput({ primarySalesId: "wg-hanung" })).success).toBe(false)
  })

  it("accepts a mission with no linked company — a typed name is legitimate", () => {
    expect(createMissionSchema.safeParse(validInput()).success).toBe(true)
    expect(createMissionSchema.safeParse(validInput({ clientCompanyId: null })).success).toBe(true)
  })

  it("carries a linked company id through when one was picked", () => {
    const linked = validInput({ clientCompanyId: "44444444-4444-4444-8444-444444444444" })
    const result = createMissionSchema.safeParse(linked)
    expect(result.success && result.data.clientCompanyId).toBe("44444444-4444-4444-8444-444444444444")
  })

  it("rejects a malformed company id rather than silently dropping the link", () => {
    expect(createMissionSchema.safeParse(validInput({ clientCompanyId: "not-a-uuid" })).success).toBe(false)
  })
})

describe("toMissionTimestamp", () => {
  it("pins wall-clock input to Western Indonesian Time", () => {
    expect(toMissionTimestamp("2026-08-25", "09:30")).toBe("2026-08-25T09:30:00+07:00")
  })

  it("produces the instant seven hours behind in UTC", () => {
    const instant = new Date(toMissionTimestamp("2026-08-25", "09:30"))
    expect(instant.toISOString()).toBe("2026-08-25T02:30:00.000Z")
  })
})

describe("mapMissions", () => {
  const missions: MissionRow[] = [
    {
      id: "mission-1",
      client_company_name_snapshot: "PT Arunika Kreasi",
      client_company_id: null,
      mission_type: "Meeting",
      status: "ASSIGNED",
      objective: "Bahas kebutuhan event",
      location: "Jakarta Selatan",
      scheduled_start: "2026-08-25T02:30:00.000Z",
      scheduled_end: null,
      allow_join: true,
      created_by: PRIMARY_ID,
      created_at: "2026-08-22T01:00:00.000Z",
    },
    {
      id: "mission-2",
      client_company_name_snapshot: "Bina Ruang Nusantara",
      client_company_id: null,
      mission_type: "Visit",
      status: "SCHEDULED",
      objective: null,
      location: null,
      scheduled_start: null,
      scheduled_end: null,
      allow_join: false,
      created_by: PRIMARY_ID,
      created_at: "2026-08-22T01:00:00.000Z",
    },
  ]

  const assignments: AssignmentRow[] = [
    { mission_id: "mission-1", user_id: PRIMARY_ID, assignment_role: "PRIMARY", response: "PENDING" },
    { mission_id: "mission-1", user_id: SUPPORT_ID, assignment_role: "SUPPORTING", response: "PENDING" },
  ]

  const names = new Map([
    [PRIMARY_ID, "Wg, Hanung"],
    [SUPPORT_ID, "Nadia Prameswari"],
  ])

  it("resolves primary and supporting names", () => {
    const [first] = mapMissions(missions, assignments, names)
    expect(first.primarySalesName).toBe("Wg, Hanung")
    expect(first.supportingSalesNames).toEqual(["Nadia Prameswari"])
  })

  it("leaves a mission without assignments intact", () => {
    const [, second] = mapMissions(missions, assignments, names)
    expect(second.primarySalesName).toBeNull()
    expect(second.supportingSalesNames).toEqual([])
  })

  it("drops names it cannot resolve rather than rendering undefined", () => {
    const [first] = mapMissions(missions, assignments, new Map([[PRIMARY_ID, "Wg, Hanung"]]))
    expect(first.supportingSalesNames).toEqual([])
  })

  it("returns one item per mission, preserving order", () => {
    const result = mapMissions(missions, assignments, names)
    expect(result.map((item) => item.id)).toEqual(["mission-1", "mission-2"])
  })

  it("counts supporting sales even when a name cannot be resolved", () => {
    // The count drives the join cap, so it must not shrink just because a
    // profile row is missing a name.
    const [first] = mapMissions(missions, assignments, new Map([[PRIMARY_ID, "Wg, Hanung"]]))
    expect(first.supportingCount).toBe(1)
    expect(first.supportingSalesNames).toEqual([])
  })

  it("reports the viewer's own role, and null when they are not assigned", () => {
    const asPrimary = mapMissions(missions, assignments, names, PRIMARY_ID)
    expect(asPrimary[0].viewerRole).toBe("PRIMARY")
    expect(asPrimary[1].viewerRole).toBeNull()

    const asSupport = mapMissions(missions, assignments, names, SUPPORT_ID)
    expect(asSupport[0].viewerRole).toBe("SUPPORTING")

    const asStranger = mapMissions(missions, assignments, names, "33333333-3333-4333-8333-333333333333")
    expect(asStranger[0].viewerRole).toBeNull()
  })

  it("carries allow_join through, defaulting a missing value to open", () => {
    const result = mapMissions(missions, assignments, names)
    expect(result[0].allowJoin).toBe(true)
    expect(result[1].allowJoin).toBe(false)

    const legacy = mapMissions(
      [{ ...missions[0], allow_join: undefined as unknown as boolean }],
      assignments,
      names
    )
    expect(legacy[0].allowJoin).toBe(true)
  })
})

describe("formatMissionSchedule", () => {
  // 2026-08-22T10:00 WIB
  const now = new Date("2026-08-22T03:00:00.000Z")

  it("labels the same Jakarta day as today", () => {
    expect(formatMissionSchedule("2026-08-22T02:30:00.000Z", now)).toBe("Hari ini, 09.30")
  })

  it("labels the next Jakarta day as tomorrow", () => {
    expect(formatMissionSchedule("2026-08-23T02:30:00.000Z", now)).toBe("Besok, 09.30")
  })

  it("uses a date for anything further out", () => {
    expect(formatMissionSchedule("2026-08-30T02:30:00.000Z", now)).toContain("Agu")
  })

  it("treats late-evening WIB as the correct local day, not the UTC one", () => {
    // 2026-08-22T23:30 WIB is already 2026-08-22T16:30Z — same Jakarta day.
    expect(formatMissionSchedule("2026-08-22T16:30:00.000Z", now)).toBe("Hari ini, 23.30")
  })

  it("handles a missing or unparseable schedule", () => {
    expect(formatMissionSchedule(null, now)).toBe("Belum dijadwalkan")
    expect(formatMissionSchedule("not-a-date", now)).toBe("Jadwal tidak valid")
  })
})
