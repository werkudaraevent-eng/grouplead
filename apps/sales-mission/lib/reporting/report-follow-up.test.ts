import { describe, expect, it } from "vitest"
import { followUpChip, followUpLine } from "./report-follow-up"

const today = "2026-09-25"
const base = { followUp: null, followUpDate: null, nextActionOwnerName: null, status: "SUBMITTED" as const }
const tracked = (over: Partial<NonNullable<Parameters<typeof followUpLine>[0]["followUp"]>>) => ({
  ...base,
  followUp: { status: "OPEN" as const, dueDate: "2026-09-29", ownerName: "Budi", actionLabel: "Kirim proposal", outcomeLabel: null, closedAt: null, count: 1, ...over },
})

describe("the Laporan card's follow-up chip", () => {
  it("is absent when the report has no next action day", () => {
    expect(followUpChip(base, today)).toBeNull()
    expect(followUpLine(base, today)).toBeNull()
  })

  it("reads 'Follow-up <day>' while open, without the owner the card's foot already names", () => {
    const chip = followUpChip(tracked({}), today)
    expect(chip).toEqual({ text: "Follow-up Sel, 29 Sep", tone: "open", title: "Terbuka · Sel, 29 Sep · Budi" })
    expect(followUpChip(tracked({ dueDate: null }), today)?.text).toBe("Follow-up terbuka")
  })

  it("says 'Lewat' once the day has passed, in the warning tone", () => {
    const chip = followUpChip(tracked({ dueDate: "2026-09-22" }), today)
    expect(chip?.text).toBe("Lewat Sel, 22 Sep")
    expect(chip?.tone).toBe("late")
  })

  it("is muted once closed", () => {
    expect(followUpChip(tracked({ status: "DONE", outcomeLabel: "Maju", closedAt: "2026-09-24T03:00:00Z", count: 2 }), today)).toEqual({
      text: "Selesai 24 Sep",
      tone: "closed",
      title: "Selesai · maju · 24 Sep · 2 langkah",
    })
    expect(followUpChip(tracked({ status: "CANCELLED" }), today)).toMatchObject({ text: "Dibatalkan", tone: "closed" })
  })

  it("uses the report's own day when the unit does not track follow-ups", () => {
    expect(followUpChip({ ...base, followUpDate: "2026-09-29", nextActionOwnerName: "Ani" }, today)).toEqual({
      text: "Follow-up Sel, 29 Sep",
      tone: "open",
      title: "Follow-up Sel, 29 Sep · Ani",
    })
    expect(followUpChip({ ...base, followUpDate: "2026-09-20" }, today)).toMatchObject({ text: "Lewat Min, 20 Sep", tone: "late" })
    // A draft's day has not been promised to anyone yet, so it is never late.
    expect(followUpChip({ ...base, status: "DRAFT", followUpDate: "2026-09-20" }, today)?.tone).toBe("open")
  })
})
