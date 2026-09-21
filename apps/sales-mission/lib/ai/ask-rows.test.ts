import { describe, expect, it } from "vitest"
import { capByNearestDay, capList, hourBuckets, toActivityRow, toProspectRow, toReportRow, wibTime } from "./ask-rows"
import type { MissionListItem } from "@/lib/missions/mission-schema"
import type { ReportListItem } from "@/lib/reporting/report-list-queries"
import type { ProspectListItem } from "@/lib/prospects/prospect-schema"

const mission = (over: Partial<MissionListItem> = {}): MissionListItem =>
  ({
    id: "m1",
    clientCompanyName: "PT Contoh",
    clientCompanyId: null,
    missionType: "Sales mission",
    status: "SCHEDULED",
    location: "Jakarta Selatan",
    address: null,
    industry: "Banking",
    objective: null,
    scheduledStart: "2026-09-21T02:30:00Z",
    scheduledEnd: null,
    primarySalesName: "Ananda",
    supportingSalesNames: ["Okki"],
    primarySalesId: "u1",
    assigneeIds: ["u1", "u2"],
    allowJoin: true,
    createdBy: "u1",
    createdByName: null,
    createdAt: "2026-09-01T00:00:00Z",
    reportStatus: "NONE",
    visitOutcome: null,
    appointment: { salutation: null, contactId: null, name: null, jobTitle: null, division: null, phone: null, email: null },
    supportingCount: 1,
    ...over,
  }) as MissionListItem

describe("ask rows", () => {
  it("shapes an activity in WIB with its report state", () => {
    const row = toActivityRow(mission())
    expect(row).toMatchObject({ tanggal: "2026-09-21", jam: "09.30", klien: "PT Contoh", sales: "Ananda", pendamping: ["Okki"], lokasi: "Jakarta Selatan", industri: "Banking", status: "terjadwal", laporan: "belum" })
    expect(toActivityRow(mission({ reportStatus: "SUBMITTED", status: "COMPLETED", visitOutcomeLabel: "Bertemu PIC" })).laporan).toBe("sudah")
    expect(toActivityRow(mission({ reportStatus: "SUBMITTED", status: "COMPLETED", visitOutcomeLabel: "Bertemu PIC" })).hasil).toBe("Bertemu PIC")
    expect(toActivityRow(mission({ scheduledStart: null })).tanggal).toBe("belum dijadwalkan")
  })

  it("formats WIB times", () => {
    expect(wibTime("2026-09-21T02:05:00Z")).toBe("09.05")
    expect(wibTime("2026-09-20T17:00:00Z")).toBe("00.00")
    expect(wibTime(null)).toBeNull()
  })

  it("shapes a report with its outcome, opportunity and next action", () => {
    const row = toReportRow({
      reportId: "r1",
      missionId: "m1",
      clientCompanyName: "PT Contoh",
      missionType: "Sales mission",
      location: null,
      scheduledStart: "2026-09-21T02:30:00Z",
      actualStart: "2026-09-21T03:00:00Z",
      actualEnd: null,
      primarySalesId: "u1",
      primarySalesName: "Ananda",
      primarySalesAvatarUrl: null,
      status: "SUBMITTED",
      visitOutcome: "met_pic",
      visitOutcomeLabel: "Bertemu PIC",
      interestLevel: "hot",
      interestLevelLabel: "Panas",
      opportunityExists: true,
      estimatedValue: 150_000_000,
      nextActionType: "quotation",
      nextActionLabel: "Kirim penawaran",
      nextActionOwnerId: "u1",
      nextActionOwnerName: "Ananda",
      followUpDate: "2026-09-25",
      contactCount: 1,
      pushedLeadId: null,
    } as ReportListItem)
    expect(row).toMatchObject({ tanggal: "2026-09-21", hasil: "Bertemu PIC", minat: "Panas", peluang: true, nilai_estimasi: 150_000_000, next_action: "Kirim penawaran", tanggal_follow_up: "2026-09-25", status: "terkirim" })
  })

  it("shapes a prospect with how late its next contact is", () => {
    const prospect = { clientCompanyName: "PT Baru", ownerName: "Irvani", statusLabel: "Dihubungi", industry: null, nextContactAt: "2026-09-18" } as ProspectListItem
    expect(toProspectRow(prospect, "2026-09-21")).toMatchObject({ klien: "PT Baru", hubungi_lagi: "2026-09-18", terlambat_hari: 3 })
    expect(toProspectRow({ ...prospect, nextContactAt: "2026-09-22" }, "2026-09-21").terlambat_hari).toBeNull()
  })

  it("keeps the rows nearest to today and says when it cut", () => {
    const rows = ["2026-09-01", "2026-09-19", "2026-09-21", "2026-09-22", "2026-09-30"].map((tanggal) => ({ tanggal }))
    const capped = capByNearestDay(rows, "2026-09-21", 3)
    expect(capped.baris.map((row) => row.tanggal)).toEqual(["2026-09-19", "2026-09-21", "2026-09-22"])
    expect(capped).toMatchObject({ total: 5, terpotong: true })
    expect(capByNearestDay(rows, "2026-09-21", 10).terpotong).toBe(false)
    expect(capList([1, 2, 3], 2)).toEqual({ baris: [1, 2], total: 3, terpotong: true })
  })

  it("buckets activities by WIB hour", () => {
    const rows = [toActivityRow(mission()), toActivityRow(mission({ scheduledStart: "2026-09-21T02:50:00Z" })), toActivityRow(mission({ scheduledStart: "2026-09-21T06:00:00Z" })), toActivityRow(mission({ scheduledStart: null }))]
    expect(hourBuckets(rows)).toEqual({ "09.00": 2, "13.00": 1 })
  })
})
