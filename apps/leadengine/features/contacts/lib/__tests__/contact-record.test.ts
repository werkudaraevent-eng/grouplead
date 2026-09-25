import { describe, expect, it } from "vitest"
import {
    CONTACT_TAB_IDS,
    discSummary,
    formatCustomValue,
    nameWithSalutation,
    readContactTab,
    readDisc,
    secondaryValues,
    showBusinessUnit,
    socialLinks,
    withContactTab,
} from "../contact-record"

describe("tabs", () => {
    it("are Activity, Leads and Files", () => {
        expect(CONTACT_TAB_IDS).toEqual(["activity", "leads", "files"])
    })

    it("open the tab the address names, and the old Overview and Timeline as Activity", () => {
        expect(readContactTab("leads")).toBe("leads")
        expect(readContactTab(["files", "activity"])).toBe("files")
        expect(readContactTab("overview")).toBe("activity")
        expect(readContactTab("activity")).toBe("activity")
        expect(readContactTab("timeline")).toBe("activity")
        expect(readContactTab("contacts")).toBe("activity")
        expect(readContactTab(undefined)).toBe("activity")
    })

    it("keep the rest of the query and leave the default out", () => {
        expect(withContactTab("?from=list", "leads")).toBe("from=list&tab=leads")
        expect(withContactTab("tab=leads&from=list", "activity")).toBe("from=list")
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
