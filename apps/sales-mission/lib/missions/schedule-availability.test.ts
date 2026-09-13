import { describe, expect, it } from "vitest"
import { DEFAULT_CONFLICT_SETTINGS } from "./mission-join"
import { busyBlocksOn, busyDays, judgeSlot, minuteOfDay, type PersonSchedule } from "./schedule-availability"

// All timestamps are UTC; 02:30Z is 09:30 WIB.
const yulia: PersonSchedule = {
  userId: "y",
  name: "Yulia",
  blocks: [
    { missionId: "a", scheduledStart: "2026-09-15T02:30:00.000Z", scheduledEnd: "2026-09-15T04:00:00.000Z", location: "Jakarta Selatan" },
    { missionId: "b", scheduledStart: "2026-09-17T07:00:00.000Z", scheduledEnd: null, location: null },
  ],
}
const dimas: PersonSchedule = {
  userId: "d",
  name: "Dimas",
  blocks: [{ missionId: "c", scheduledStart: "2026-09-15T06:00:00.000Z", scheduledEnd: "2026-09-15T07:00:00.000Z", location: "Bekasi" }],
}

describe("minuteOfDay", () => {
  it("reads the wall clock in mission time, not the server's", () => {
    expect(minuteOfDay("2026-09-15T02:30:00.000Z")).toBe(9 * 60 + 30)
    // 23:30 WIB is 16:30Z the same day; it must not wrap to the next morning.
    expect(minuteOfDay("2026-09-15T16:30:00.000Z")).toBe(23 * 60 + 30)
  })
})

describe("busyDays", () => {
  it("marks the days anyone being assigned already has a visit", () => {
    expect([...busyDays([yulia, dimas])].sort()).toEqual(["2026-09-15", "2026-09-17"])
  })
})

describe("busyBlocksOn", () => {
  it("paints everyone's visits for the day, earliest first, named", () => {
    const blocks = busyBlocksOn("2026-09-15", [dimas, yulia])
    expect(blocks.map((b) => [b.personName, b.label])).toEqual([
      ["Yulia", "09:30–11:00"],
      ["Dimas", "13:00–14:00"],
    ])
  })

  it("draws a visit with no end as an hour, matching the conflict rule", () => {
    const [block] = busyBlocksOn("2026-09-17", [yulia])
    expect(block.label).toBe("14:00–15:00")
  })

  it("shows nothing on a free day", () => {
    expect(busyBlocksOn("2026-09-16", [yulia, dimas])).toEqual([])
  })
})

describe("judgeSlot", () => {
  const settings = DEFAULT_CONFLICT_SETTINGS

  it("is clear on a free day", () => {
    const verdict = judgeSlot({ date: "2026-09-16", startTime: "09:30", endTime: "", location: null }, [yulia, dimas], settings)
    expect(verdict.clear).toBe(true)
  })

  it("names the person and the visit that clash", () => {
    const verdict = judgeSlot({ date: "2026-09-15", startTime: "10:00", endTime: "11:00", location: null }, [yulia, dimas], settings)
    expect(verdict.clear).toBe(false)
    expect(verdict.clashes).toEqual([{ personName: "Yulia", label: "09:30–11:00" }])
  })

  it("applies the travel buffer, so a slot right after a visit still clashes", () => {
    // Yulia ends 11:00; 11:15 is inside the 30-minute buffer.
    const verdict = judgeSlot({ date: "2026-09-15", startTime: "11:15", endTime: "12:00", location: "Bogor" }, [yulia], settings)
    expect(verdict.clear).toBe(false)
  })

  it("ignores the mission being rescheduled against its own old slot", () => {
    const verdict = judgeSlot({ date: "2026-09-15", startTime: "09:30", endTime: "11:00", location: null, missionId: "a" }, [yulia], settings)
    expect(verdict.clear).toBe(true)
  })

  it("judges each person against their own calendar only", () => {
    // 13:00 clashes with Dimas, not Yulia.
    const verdict = judgeSlot({ date: "2026-09-15", startTime: "13:00", endTime: "13:30", location: null }, [yulia, dimas], settings)
    expect(verdict.clashes.map((c) => c.personName)).toEqual(["Dimas"])
  })
})
