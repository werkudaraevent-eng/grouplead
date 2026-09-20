import { describe, expect, it } from "vitest"
import { assembleFacts, shiftDay, wibDayOf, wibHourOf } from "./insight-facts"
import { dueTrigger, insightHref, parseInsightItems, type InsightRecord } from "./insights"

describe("wib helpers", () => {
  it("names the WIB day and hour of an instant", () => {
    // 2026-09-20T23:30 UTC is 06:30 WIB on the 21st.
    const instant = new Date("2026-09-20T23:30:00Z")
    expect(wibDayOf(instant)).toBe("2026-09-21")
    expect(wibHourOf(instant)).toBe(6)
    expect(shiftDay("2026-09-21", -1)).toBe("2026-09-20")
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01")
  })
})

describe("assembleFacts", () => {
  const names = new Map([["u1", "Sri"], ["u2", "Mya"]])
  const labels = new Map([["MET_DM", "Bertemu pengambil keputusan"], ["HOT", "Panas"]])
  const day = "2026-09-20"
  const now = new Date("2026-09-20T05:00:00Z") // 12:00 WIB
  const missions = [
    { id: "m1", client: "PT Andalan", scheduledStart: "2026-09-20T02:00:00Z", status: "COMPLETED", primaryId: "u1" },
    { id: "m2", client: "PT Baru", scheduledStart: "2026-09-19T03:00:00Z", status: "CONFIRMED", primaryId: "u2" },
    { id: "m3", client: "PT Cepat", scheduledStart: "2026-09-21T03:00:00Z", status: "CONFIRMED", primaryId: "u1" },
    { id: "m4", client: "PT Dulu", scheduledStart: "2026-09-10T03:00:00Z", status: "COMPLETED", primaryId: "u2" },
  ]
  const reports = [
    { missionId: "m1", status: "SUBMITTED", submittedAt: "2026-09-20T04:00:00Z", visitOutcome: "MET_DM", interestLevel: "HOT", opportunityExists: true, estimatedValue: 5_000_000, nextActionType: "SEND_PROPOSAL", followUpDate: "2026-09-25", meetingSummary: "  Bahas   paket   MICE  " },
    { missionId: "m4", status: "SUBMITTED", submittedAt: "2026-09-10T05:00:00Z", visitOutcome: null, interestLevel: null, opportunityExists: false, estimatedValue: null, nextActionType: "NONE", followUpDate: null, meetingSummary: null },
  ]
  const prospects = [
    { ownerId: "u2", nextContactAt: "2026-09-18", statusKind: "open" },
    { ownerId: "u1", nextContactAt: "2026-09-25", statusKind: "open" },
    { ownerId: "u2", nextContactAt: "2026-09-01", statusKind: "won" },
  ]

  it("counts today, pending, overdue and the two weeks for the unit", () => {
    const facts = assembleFacts({ day, now, names, labels, salesIds: null, missions, reports, prospects })
    expect(facts.today.scheduled).toBe(1)
    expect(facts.today.reportsSubmitted).toBe(1)
    expect(facts.today.reports[0]).toMatchObject({ client: "PT Andalan", sales: "Sri", outcome: "Bertemu pengambil keputusan", interest: "Panas", opportunity: true, summary: "Bahas paket MICE" })
    expect(facts.tomorrow.scheduled).toBe(1)
    // m2 is yesterday with no report: pending. m4 has a report.
    expect(facts.pending.count).toBe(1)
    expect(facts.pending.byPerson).toEqual([{ name: "Mya", count: 1 }])
    expect(facts.pending.oldestDays).toBe(1)
    expect(facts.prospects.overdue).toBe(1)
    expect(facts.week.reports).toBe(1)
    expect(facts.week.reportsPreviousWeek).toBe(1)
    expect(facts.week.appointments).toBe(2)
    expect(facts.week.estimatedValue).toBe(5_000_000)
    expect(facts.people).toBeNull()
  })

  it("limits a person-scoped insight to those people", () => {
    const facts = assembleFacts({ day, now, names, labels, salesIds: new Set(["u2"]), missions, reports, prospects })
    expect(facts.people).toEqual(["Mya"])
    expect(facts.today.reportsSubmitted).toBe(0)
    expect(facts.pending.count).toBe(1)
    expect(facts.prospects.overdue).toBe(1)
    expect(facts.week.reports).toBe(0)
  })
})

describe("parseInsightItems", () => {
  it("reads the asked-for JSON, also when fenced or wrapped in prose", () => {
    const answer = 'Berikut:\n```json\n{"items":[{"text":"Dua laporan  masuk hari ini.","kind":"naik","link":"laporan_hari_ini"},{"text":"Satu prospek lewat tanggal.","kind":"perlu_tindakan","link":"prospek_jatuh_tempo"}]}\n```'
    expect(parseInsightItems(answer)).toEqual([
      { text: "Dua laporan masuk hari ini.", kind: "naik", link: "laporan_hari_ini" },
      { text: "Satu prospek lewat tanggal.", kind: "perlu_tindakan", link: "prospek_jatuh_tempo" },
    ])
  })
  it("tolerates a bare array, unknown kinds and links, and caps at five", () => {
    const items = parseInsightItems(JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ text: `Poin ${i}`, kind: "aneh", link: "nowhere" }))))
    expect(items).toHaveLength(5)
    expect(items![0]).toEqual({ text: "Poin 0", kind: "info", link: null })
  })
  it("is null for prose or empty lists", () => {
    expect(parseInsightItems("Maaf, tidak ada data.")).toBeNull()
    expect(parseInsightItems('{"items":[]}')).toBeNull()
  })
})

describe("insightHref", () => {
  it("turns a link key into an app URL for the day", () => {
    expect(insightHref("laporan_hari_ini", "2026-09-20")).toContain("/workspace/reports?")
    expect(insightHref("aktivitas_besok", "2026-09-30")).toContain("from=2026-10-01")
    expect(insightHref("prospek_jatuh_tempo", "2026-09-20")).toContain("due=1")
    expect(insightHref(null, "2026-09-20")).toBeNull()
  })
})

describe("dueTrigger", () => {
  const base: InsightRecord = { id: "x", scope: "unit", userId: null, day: "2026-09-20", status: "ready", items: [], model: null, error: null, trigger: "schedule", reportsSeen: 2, regenerations: 0, generatedAt: "2026-09-19T23:05:00Z" }
  // An instant on 2026-09-20 at the given WIB clock time.
  const at = (wibHour: number, minute = 0) => new Date(Date.UTC(2026, 8, 20, wibHour - 7, minute))
  it("runs the morning insight once the hour has come and nothing exists", () => {
    expect(dueTrigger(null, { hour: 6 }, 0, at(5, 50))).toBeNull()
    expect(dueTrigger(null, { hour: 6 }, 0, at(6, 5))).toBe("schedule")
  })
  it("rewrites when reports arrived after the last run and the gap passed", () => {
    expect(dueTrigger(base, { hour: 6 }, 2, at(9))).toBeNull()
    expect(dueTrigger(base, { hour: 6 }, 3, at(6, 8))).toBeNull()
    expect(dueTrigger(base, { hour: 6 }, 3, at(9))).toBe("report")
    expect(dueTrigger({ ...base, regenerations: 12 }, { hour: 6 }, 9, at(9))).toBeNull()
  })
  it("lets the morning run replace a row made on open earlier, and leaves a pending claim alone", () => {
    expect(dueTrigger({ ...base, trigger: "view" }, { hour: 6 }, 2, at(7))).toBe("schedule")
    expect(dueTrigger({ ...base, status: "pending", generatedAt: null }, { hour: 6 }, 5, at(9))).toBeNull()
  })
})
