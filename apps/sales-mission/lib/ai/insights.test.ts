import { describe, expect, it } from "vitest"
import { assembleFacts, dayGap, rupiah, shiftDay, wibDayOf, wibHourOf, type ContactRow, type FollowUpRow, type HistoryRow, type ReportRow } from "./insight-facts"
import { briefSections, briefShareText, insightDayName, storedInsightItems, teaserInsightItems } from "./insight-brief"
import { dueTrigger, insightHref, parseInsightItems, type InsightRecord } from "./insights"

describe("wib helpers", () => {
  it("names the WIB day and hour of an instant", () => {
    // 2026-09-20T23:30 UTC is 06:30 WIB on the 21st.
    const instant = new Date("2026-09-20T23:30:00Z")
    expect(wibDayOf(instant)).toBe("2026-09-21")
    expect(wibHourOf(instant)).toBe(6)
    expect(shiftDay("2026-09-21", -1)).toBe("2026-09-20")
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01")
    expect(dayGap("2026-09-18", "2026-09-20")).toBe(2)
    expect(dayGap("2026-09-20", "2026-09-18")).toBe(-2)
  })
  it("writes money the way the product does, and nothing for an empty value", () => {
    expect(rupiah(4_050_000_000)).toBe("Rp 4.050.000.000")
    expect(rupiah(null)).toBeNull()
  })
})

describe("assembleFacts", () => {
  const names = new Map([
    ["u1", "Sri"],
    ["u2", "Mya"],
  ])
  const labels = new Map([
    ["MET_DM", "Bertemu pengambil keputusan"],
    ["HOT", "Panas"],
  ])
  const actionLabels = new Map([["SEND_PROPOSAL", "Kirim penawaran"]])
  const kinds = new Map([["HOT", "hot"]])
  const day = "2026-09-20"
  const now = new Date("2026-09-20T05:00:00Z") // 12:00 WIB
  const missions = [
    { id: "m1", client: "PT Andalan", scheduledStart: "2026-09-20T02:00:00Z", status: "COMPLETED", primaryId: "u1", industry: "Perbankan" },
    { id: "m2", client: "PT Baru", scheduledStart: "2026-09-19T03:00:00Z", status: "CONFIRMED", primaryId: "u2", industry: "Perbankan" },
    { id: "m3", client: "PT Cepat", scheduledStart: "2026-09-21T03:00:00Z", status: "CONFIRMED", primaryId: "u1", industry: null },
    { id: "m4", client: "PT Dulu", scheduledStart: "2026-09-10T03:00:00Z", status: "COMPLETED", primaryId: "u2", industry: "Retail" },
    { id: "m5", client: "PT Esok", scheduledStart: "2026-09-24T07:30:00Z", status: "CONFIRMED", primaryId: "u2", industry: "Retail" },
  ]
  const reports: ReportRow[] = [
    {
      id: "r1",
      missionId: "m1",
      status: "SUBMITTED",
      submittedAt: "2026-09-20T04:00:00Z",
      visitOutcome: "MET_DM",
      interestLevel: "HOT",
      opportunityExists: true,
      estimatedValue: 5_000_000,
      nextActionType: "SEND_PROPOSAL",
      nextActionOwnerId: "u1",
      followUpDate: "2026-09-25",
      meetingSummary: `  Bahas   paket   MICE  ${"panjang ".repeat(400)}`,
      clientNeeds: ["  Ruang rapat 200 orang  ", ""],
      productInterest: ["Paket MICE"],
      competitorMentioned: "  Hotel seberang  ",
      crmSyncedAt: null,
    },
    {
      id: "r4",
      missionId: "m4",
      status: "SUBMITTED",
      submittedAt: "2026-09-10T05:00:00Z",
      visitOutcome: null,
      interestLevel: null,
      opportunityExists: false,
      estimatedValue: null,
      nextActionType: "NONE",
      nextActionOwnerId: null,
      followUpDate: null,
      meetingSummary: null,
      clientNeeds: [],
      productInterest: [],
      competitorMentioned: null,
      crmSyncedAt: null,
    },
  ]
  const contacts: ContactRow[] = [
    { reportId: "r1", name: "Pak Nuryono", jobTitle: "GM", decisionMaker: true, discPrimary: "D", discSecondary: "I", discNote: "Suka angka" },
    { reportId: "r1", name: "Bu Rina", jobTitle: null, decisionMaker: false, discPrimary: null, discSecondary: null, discNote: null },
  ]
  const followUps: FollowUpRow[] = [
    { missionId: "m1", client: "PT Andalan", actionType: "SEND_PROPOSAL", ownerId: "u1", dueDate: "2026-09-25", status: "OPEN" },
    { missionId: "m4", client: "PT Dulu", actionType: "SEND_PROPOSAL", ownerId: "u2", dueDate: "2026-09-16", status: "OPEN" },
    { missionId: "m2", client: "PT Baru", actionType: "CALL", ownerId: "u2", dueDate: null, status: "OPEN" },
  ]
  const prospects = [
    { client: "PT Lewat", ownerId: "u2", nextContactAt: "2026-09-18", statusKind: "open" },
    { client: "PT Nanti", ownerId: "u1", nextContactAt: "2026-09-25", statusKind: "open" },
    { client: "PT Menang", ownerId: "u2", nextContactAt: "2026-09-01", statusKind: "won" },
  ]
  const history: HistoryRow[] = [
    { client: "PT Andalan", day: "2026-08-10", outcome: "MET_DM", interest: "HOT", opportunity: false },
    { client: "pt  andalan", day: "2026-09-01", outcome: null, interest: null, opportunity: false },
    { client: "PT Andalan", day: "2026-09-20", outcome: "MET_DM", interest: "HOT", opportunity: true },
  ]
  const input = { day, now, names, labels, actionLabels, kinds, discEnabled: true, salesIds: null, missions, reports, contacts, followUps, prospects, history }

  it("counts today, pending, overdue and the two weeks for the unit", () => {
    const facts = assembleFacts(input)
    expect(facts.today.scheduled).toBe(1)
    expect(facts.today.reportsSubmitted).toBe(1)
    expect(facts.tomorrow.scheduled).toBe(1)
    // m2 is yesterday with no report: pending. m4 has a report.
    expect(facts.pending.count).toBe(1)
    expect(facts.pending.byPerson).toEqual([{ name: "Mya", count: 1 }])
    expect(facts.pending.oldestDays).toBe(1)
    expect(facts.prospects.overdue).toBe(1)
    expect(facts.week.reports).toBe(1)
    expect(facts.week.reportsPreviousWeek).toBe(1)
    expect(facts.week.reportsBaseline).toBe(false)
    expect(facts.week.appointments).toBe(2)
    expect(facts.week.estimatedValue).toBe(5_000_000)
    expect(facts.week.estimatedValueText).toBe("Rp 5.000.000")
    expect(facts.week.opportunitiesNotSentToCrm).toBe(1)
    expect(facts.people).toBeNull()
    // Hours are WIB: 02:00Z is 09.00; industries are counted with "Belum diisi" for a blank.
    expect(facts.today.byHour).toEqual([{ name: "09.00", count: 1 }])
    expect(facts.today.byIndustry).toEqual([{ name: "Perbankan", count: 1 }])
    expect(facts.tomorrow.byIndustry).toEqual([{ name: "Belum diisi", count: 1 }])
    expect(facts.nextWeek.scheduled).toBe(2)
    expect(facts.nextWeek.byDay).toEqual([{ name: "Kamis 24 Sep", count: 1 }, { name: "Senin 21 Sep", count: 1 }])
    expect(facts.week.appointmentsByIndustry).toEqual([{ name: "Perbankan", count: 2 }])
    expect(facts.week.byOutcome).toEqual([{ name: "Bertemu pengambil keputusan", count: 1 }])
    expect(facts.week.topClients).toEqual([{ name: "PT Andalan", count: 1 }])
  })

  it("marks a week comparison without a previous week as a baseline", () => {
    const facts = assembleFacts({ ...input, day: "2026-09-13" })
    expect(facts.week.reportsPreviousWeek).toBe(0)
    expect(facts.week.reportsBaseline).toBe(true)
    expect(facts.week.appointmentsBaseline).toBe(true)
  })

  it("hands over today's report as the rep wrote it, with money as text", () => {
    const report = assembleFacts(input).today.reports[0]
    expect(report).toMatchObject({
      missionId: "m1",
      client: "PT Andalan",
      sales: "Sri",
      outcome: "Bertemu pengambil keputusan",
      interest: "Panas",
      interestKind: "hot",
      opportunity: true,
      estimatedValueText: "Rp 5.000.000",
      sentToCrm: false,
      clientNeeds: ["Ruang rapat 200 orang"],
      productInterest: ["Paket MICE"],
      competitor: "Hotel seberang",
      nextAction: "Kirim penawaran",
      nextActionOwner: "Sri",
      followUpDate: "2026-09-25",
    })
    // Whitespace collapsed, and 1500 characters of it: the whole story, not a headline.
    expect(report.summary!.startsWith("Bahas paket MICE panjang")).toBe(true)
    expect(report.summary!).toHaveLength(1500)
  })

  it("names who was met, with DISC only while the unit assesses it", () => {
    const withDisc = assembleFacts(input).today.reports[0]
    expect(withDisc.contacts).toEqual([
      { name: "Pak Nuryono", jobTitle: "GM", decisionMaker: true, disc: "DI", discNote: "Suka angka" },
      { name: "Bu Rina", jobTitle: null, decisionMaker: false, disc: null, discNote: null },
    ])
    const without = assembleFacts({ ...input, discEnabled: false }).today.reports[0]
    expect(without.contacts[0]).toMatchObject({ name: "Pak Nuryono", disc: null, discNote: null })
  })

  it("remembers the last visit to the same client, ignoring today's and matching the name loosely", () => {
    const report = assembleFacts(input).today.reports[0]
    expect(report.previousVisit).toEqual({ day: "2026-09-01", outcome: null, interest: null, opportunity: false })
  })

  it("counts open follow-ups and lists the late ones, soonest due first", () => {
    const facts = assembleFacts(input)
    expect(facts.followUps.open).toBe(3)
    expect(facts.followUps.late).toBe(1)
    expect(facts.followUps.lateByPerson).toEqual([{ name: "Mya", count: 1 }])
    expect(facts.followUps.lateList).toEqual([{ client: "PT Dulu", action: "Kirim penawaran", owner: "Mya", dueDate: "2026-09-16", daysLate: 4 }])
  })

  it("names the overdue prospects and how late they are", () => {
    expect(assembleFacts(input).prospects.list).toEqual([{ client: "PT Lewat", owner: "Mya", daysOverdue: 2 }])
  })

  it("passes the week's reports most recent first, cut shorter than today's", () => {
    const week = assembleFacts({ ...input, day: "2026-09-16" }).week.recentReports
    expect(week.map((report) => report.client)).toEqual(["PT Dulu"])
    const longer = assembleFacts(input).week.recentReports
    expect(longer[0].summary).toHaveLength(400)
    expect(longer[0]).toMatchObject({ day: "2026-09-20", client: "PT Andalan", estimatedValueText: "Rp 5.000.000" })
  })

  it("limits a person-scoped insight to those people", () => {
    const facts = assembleFacts({ ...input, salesIds: new Set(["u2"]) })
    expect(facts.people).toEqual(["Mya"])
    expect(facts.today.reportsSubmitted).toBe(0)
    expect(facts.pending.count).toBe(1)
    expect(facts.prospects.overdue).toBe(1)
    expect(facts.followUps.open).toBe(2)
    expect(facts.week.reports).toBe(0)
  })
})

describe("parseInsightItems", () => {
  it("reads the asked-for JSON, also when fenced or wrapped in prose", () => {
    const answer =
      'Berikut:\n```json\n{"items":[{"text":"Dua laporan  masuk hari ini.","kind":"naik","section":"tindak","link":"laporan_hari_ini","missionIds":["m1","nope"]},{"text":"Kompetitor disebut di dua klien.","kind":"info","section":"lapangan","link":null}]}\n```'
    expect(parseInsightItems(answer, new Set(["m1"]))).toEqual([
      { text: "Dua laporan masuk hari ini.", kind: "naik", section: "tindak", link: "laporan_hari_ini", missionIds: ["m1"] },
      { text: "Kompetitor disebut di dua klien.", kind: "info", section: "lapangan", link: null },
    ])
  })
  it("tolerates a bare array, unknown kinds, sections and links, and caps at nine", () => {
    const items = parseInsightItems(JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ text: `Poin ${i}`, kind: "aneh", section: "aneh", link: "nowhere" }))))
    expect(items).toHaveLength(9)
    // An item with no section is a field observation, which is where an unlabelled sentence belongs.
    expect(items![0]).toEqual({ text: "Poin 0", kind: "info", section: "lapangan", link: null })
  })
  it("drops mission ids that were not in the facts", () => {
    const items = parseInsightItems('{"items":[{"text":"Bukti.","kind":"info","section":"tindak","missionIds":["ghost"]}]}', new Set(["m1"]))
    expect(items![0].missionIds).toBeUndefined()
  })
  it("is null for prose or empty lists", () => {
    expect(parseInsightItems("Maaf, tidak ada data.")).toBeNull()
    expect(parseInsightItems('{"items":[]}')).toBeNull()
  })
})

describe("storedInsightItems", () => {
  it("reads a row written before the brief had sections", () => {
    expect(storedInsightItems([{ text: "Laporan tertunda dua.", kind: "perlu_tindakan", link: "laporan_tertunda" }])).toEqual([
      { text: "Laporan tertunda dua.", kind: "perlu_tindakan", section: "lapangan", link: "laporan_tertunda" },
    ])
    expect(storedInsightItems(null)).toEqual([])
  })
})

describe("the brief's shape", () => {
  const items = [
    { text: "Tema harga.", kind: "info" as const, section: "lapangan" as const, link: null },
    { text: "Prospek lewat tanggal.", kind: "perlu_tindakan" as const, section: "tindak" as const, link: null },
    { text: "Prioritaskan PT Andalan.", kind: "info" as const, section: "rekomendasi" as const, link: null },
    { text: "Kompetitor di dua klien.", kind: "info" as const, section: "lapangan" as const, link: null },
  ]

  it("orders the sections the way the brief is read, dropping empty ones", () => {
    expect(briefSections(items).map((group) => group.section)).toEqual(["tindak", "lapangan", "rekomendasi"])
    expect(briefSections(items.filter((item) => item.section === "lapangan")).map((group) => group.label)).toEqual(["Yang terdengar di lapangan"])
  })

  it("teases what has to be acted on first, then the recommendation, then the field", () => {
    expect(teaserInsightItems(items).map((item) => item.section)).toEqual(["tindak", "rekomendasi", "lapangan"])
    expect(teaserInsightItems(items, 2).map((item) => item.text)).toEqual(["Prospek lewat tanggal.", "Prioritaskan PT Andalan."])
  })

  it("writes the WhatsApp text as a title and three short lists", () => {
    const text = briefShareText({ day: "2026-09-22", items, scopeNote: "tentang orang dalam cakupan Anda" })
    expect(text.split("\n")[0]).toBe("*Brief AI · Selasa, 22 Sep 2026*")
    expect(text).toContain("*Perlu ditindak*\n• Prospek lewat tanggal.")
    expect(text).toContain("• Kompetitor di dua klien.")
    expect(text).toContain("tentang orang dalam cakupan Anda")
    expect(text.trimEnd().endsWith("AI bisa keliru; angkanya berasal dari data aplikasi.")).toBe(true)
  })

  it("names today and yesterday instead of their dates", () => {
    expect(insightDayName("2026-09-22", "2026-09-22")).toBe("Hari ini")
    expect(insightDayName("2026-09-21", "2026-09-22")).toBe("Kemarin")
    expect(insightDayName("2026-09-18", "2026-09-22")).toBe("Jumat, 18 Sep")
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
