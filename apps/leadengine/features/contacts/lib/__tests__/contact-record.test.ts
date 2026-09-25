import { describe, expect, it } from "vitest"
import {
    CONTACT_SECTIONS,
    contactSectionDomId,
    discSummary,
    emptyFieldsToggleLabel,
    externalHref,
    formatCalendarDay,
    formatCustomValue,
    formatDayTime,
    isBlank,
    leadStanding,
    leadSummaryLabel,
    mailtoHref,
    nameWithSalutation,
    readContactTab,
    readDisc,
    secondaryValues,
    sectionAccessibleLabel,
    sectionCounts,
    showBusinessUnit,
    socialLinks,
    splitEmptyFields,
    summarizeContactLeads,
    telHref,
    whatsAppHref,
    withContactTab,
} from "../contact-record"

describe("tabs", () => {
    it("open the Timeline only when the address asks for it", () => {
        expect(readContactTab("timeline")).toBe("timeline")
        expect(readContactTab(["timeline", "overview"])).toBe("timeline")
        expect(readContactTab("files")).toBe("overview")
        expect(readContactTab(undefined)).toBe("overview")
    })

    it("keep the rest of the query and leave the default out", () => {
        expect(withContactTab("?from=list", "timeline")).toBe("from=list&tab=timeline")
        expect(withContactTab("tab=timeline&from=list", "overview")).toBe("from=list")
    })
})

describe("sections", () => {
    it("are Info, Notes, Leads and Files, in page order", () => {
        expect(CONTACT_SECTIONS.map((section) => section.label)).toEqual(["Info", "Notes", "Leads", "Files"])
        expect(contactSectionDomId("notes")).toBe("contact-notes")
    })

    it("count everything but Info, and nothing while a count is unknown", () => {
        expect(sectionCounts({ notes: 3, leads: 0, files: null })).toEqual({ info: null, notes: 3, leads: 0, files: null })
    })

    it("read their count to a screen reader", () => {
        expect(sectionAccessibleLabel("Notes", 3)).toBe("Notes, 3")
        expect(sectionAccessibleLabel("Info", null)).toBe("Info")
    })
})

describe("leadStanding", () => {
    it("trusts the stage's closed status first", () => {
        expect(leadStanding({ name: "Deal", stage_type: "closed", closed_status: "won" })).toBe("won")
        expect(leadStanding({ name: "Closed Won", stage_type: "closed", closed_status: "lost" })).toBe("lost")
        expect(leadStanding({ name: "Archived", stage_type: "closed", closed_status: null })).toBe("closed")
    })

    it("falls back to the stage's name", () => {
        expect(leadStanding({ name: "Closed Won" })).toBe("won")
        expect(leadStanding({ name: "Turndown" })).toBe("lost")
        expect(leadStanding({ name: "Cancelled" })).toBe("lost")
        expect(leadStanding({ name: "Proposal Sent" })).toBe("open")
        expect(leadStanding(null)).toBe("open")
    })
})

describe("lead summary", () => {
    const money = (amount: number) => `Rp ${(amount / 1e9).toFixed(1)}B`
    const leads = [
        { estimated_value: 700_000_000, pipeline_stage: { name: "Proposal Sent", stage_type: "open" } },
        { estimated_value: 500_000_000, pipeline_stage: { name: "Negotiation" } },
        { estimated_value: 300_000_000, pipeline_stage: { name: "Closed Won", closed_status: "won" } },
        { estimated_value: null, pipeline_stage: { name: "Closed Lost", closed_status: "lost" } },
    ]

    it("counts the active leads, their value and the won ones", () => {
        expect(summarizeContactLeads(leads)).toEqual({ total: 4, active: 2, won: 1, activeValue: 1_200_000_000 })
    })

    it("reads as one line", () => {
        expect(leadSummaryLabel(summarizeContactLeads(leads), money)).toBe("2 active · Rp 1.2B · 1 won")
    })

    it("leaves out a zero value and no wins", () => {
        const open = [{ estimated_value: null, pipeline_stage: { name: "Lead Masuk" } }]
        expect(leadSummaryLabel(summarizeContactLeads(open), money)).toBe("1 active")
        const closed = [{ estimated_value: 5, pipeline_stage: { name: "Closed Lost" } }]
        expect(leadSummaryLabel(summarizeContactLeads(closed), money)).toBe("0 active")
    })

    it("says nothing without leads", () => {
        expect(leadSummaryLabel(summarizeContactLeads([]), money)).toBeNull()
    })
})

describe("empty fields", () => {
    it("knows what is blank", () => {
        expect(isBlank(null)).toBe(true)
        expect(isBlank("  ")).toBe(true)
        expect(isBlank([])).toBe(true)
        expect(isBlank(["", null])).toBe(true)
        expect(isBlank("Jakarta")).toBe(false)
        expect(isBlank(0)).toBe(false)
        expect(isBlank(["a@b.co"])).toBe(false)
    })

    it("shows the filled, folds the empty ones a person can fill, drops the rest, in order", () => {
        const fields = [
            { key: "name", empty: false, fillable: true },
            { key: "dob", empty: true, fillable: true },
            { key: "disc", empty: true, fillable: false },
            { key: "unit", empty: false, fillable: false },
            { key: "address", empty: true, fillable: true },
        ]
        const { filled, empty } = splitEmptyFields(fields)
        expect(filled.map((field) => field.key)).toEqual(["name", "unit"])
        expect(empty.map((field) => field.key)).toEqual(["dob", "address"])
    })

    it("words the toggle for one and for many", () => {
        expect(emptyFieldsToggleLabel(1, false)).toBe("Show 1 empty field")
        expect(emptyFieldsToggleLabel(4, false)).toBe("Show 4 empty fields")
        expect(emptyFieldsToggleLabel(4, true)).toBe("Hide empty fields")
        expect(emptyFieldsToggleLabel(1, true)).toBe("Hide the empty field")
    })
})

describe("lists of values", () => {
    it("merges the old single column with the list, once each", () => {
        expect(secondaryValues("a@x.co", ["b@x.co", "a@x.co", null, " "])).toEqual(["a@x.co", "b@x.co"])
        expect(secondaryValues(null, null)).toEqual([])
    })

    it("puts LinkedIn first and never repeats a profile", () => {
        expect(socialLinks("linkedin.com/in/ana", [
            { platform: "LinkedIn", url: "linkedin.com/in/ana" },
            { platform: "Instagram", url: "instagram.com/ana" },
            { platform: "", url: "ana.id" },
            { platform: "TikTok", url: "" },
        ])).toEqual([
            { platform: "LinkedIn", url: "linkedin.com/in/ana" },
            { platform: "Instagram", url: "instagram.com/ana" },
            { platform: "Link", url: "ana.id" },
        ])
    })

    it("opens an address without a scheme as https", () => {
        expect(externalHref("ana.id")).toBe("https://ana.id")
        expect(externalHref("http://ana.id")).toBe("http://ana.id")
    })
})

describe("days", () => {
    it("reads a calendar day as that day, with a short month", () => {
        expect(formatCalendarDay("2026-09-03")).toBe("3 Sep 2026")
        expect(formatCalendarDay("1990-12-31")).toBe("31 Dec 1990")
    })

    it("reads a timestamp in the reader's own time", () => {
        const at = new Date(2026, 8, 25, 9, 5)
        expect(formatCalendarDay(at.toISOString())).toBe("25 Sep 2026")
        expect(formatDayTime(at.toISOString())).toBe("25 Sep 2026, 09:05")
    })

    it("gives nothing for nothing or a non-date", () => {
        expect(formatCalendarDay(null)).toBeNull()
        expect(formatCalendarDay("soon")).toBeNull()
        expect(formatDayTime(undefined)).toBeNull()
    })
})

describe("custom field values", () => {
    it("reads each type as text", () => {
        expect(formatCustomValue("Gold", "dropdown")).toBe("Gold")
        expect(formatCustomValue(1250000, "number")).toBe("1,250,000")
        expect(formatCustomValue("2026-09-03", "date")).toBe("3 Sep 2026")
        expect(formatCustomValue(["A", "", "B"], "text")).toBe("A, B")
        expect(formatCustomValue(true, "text")).toBe("Yes")
    })

    it("gives nothing for an empty value", () => {
        expect(formatCustomValue("", "text")).toBeNull()
        expect(formatCustomValue(null, "number")).toBeNull()
        expect(formatCustomValue([], "text")).toBeNull()
    })
})

describe("quick actions", () => {
    it("mails and calls only with a value", () => {
        expect(mailtoHref(" ana@x.co ")).toBe("mailto:ana@x.co")
        expect(mailtoHref("")).toBeNull()
        expect(telHref("+62 811-2836-676")).toBe("tel:+628112836676")
        expect(telHref("12")).toBeNull()
        expect(telHref(null)).toBeNull()
    })

    it("opens WhatsApp with the country code and no plus", () => {
        expect(whatsAppHref("+628112836676")).toBe("https://wa.me/628112836676")
        expect(whatsAppHref("0811-2836-676")).toBe("https://wa.me/628112836676")
        expect(whatsAppHref("+1 415 555 1234")).toBe("https://wa.me/14155551234")
        expect(whatsAppHref("123")).toBeNull()
        expect(whatsAppHref(undefined)).toBeNull()
    })
})

describe("the header", () => {
    it("puts the salutation before the name", () => {
        expect(nameWithSalutation("Dr", "Ana Putri")).toBe("Dr Ana Putri")
        expect(nameWithSalutation(" ", "Ana Putri")).toBe("Ana Putri")
    })

    it("names the business unit only to someone who sees more than one", () => {
        expect(showBusinessUnit({ unitName: "WG Events", isHoldingView: true, unitCount: 1 })).toBe(true)
        expect(showBusinessUnit({ unitName: "WG Events", isHoldingView: false, unitCount: 3 })).toBe(true)
        expect(showBusinessUnit({ unitName: "WG Events", isHoldingView: false, unitCount: 1 })).toBe(false)
        expect(showBusinessUnit({ unitName: null, isHoldingView: true, unitCount: 4 })).toBe(false)
    })
})

describe("DISC", () => {
    it("reads a reading and ignores a malformed one", () => {
        expect(readDisc({ disc: { primary: "D", secondary: "I", note: " tegas ", assessedByName: "Bagus", assessedAt: "2026-09-01" } })).toEqual({
            primary: "D", secondary: "I", note: "tegas", assessedByName: "Bagus", assessedAt: "2026-09-01",
        })
        expect(readDisc({ disc: { primary: "X" } })).toBeNull()
        expect(readDisc({ disc: { primary: "S", secondary: "S" } })?.secondary).toBeNull()
        expect(readDisc(null)).toBeNull()
    })

    it("names the style, with the right article", () => {
        expect(discSummary({ primary: "D", secondary: "I", note: null, assessedByName: null, assessedAt: null })).toEqual({ code: "DI", meaning: "Dominance with an Influence side" })
        expect(discSummary({ primary: "C", secondary: "S", note: null, assessedByName: null, assessedAt: null }).meaning).toBe("Conscientiousness with a Steadiness side")
        expect(discSummary({ primary: "S", secondary: null, note: null, assessedByName: null, assessedAt: null })).toEqual({ code: "S", meaning: "Steadiness" })
    })
})
