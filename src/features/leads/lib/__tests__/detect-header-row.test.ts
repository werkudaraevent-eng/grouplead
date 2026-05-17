import { describe, it, expect } from "vitest"
import { detectHeaderRow, buildHeaderAndRows } from "../detect-header-row"

describe("detectHeaderRow", () => {
    it("picks row 0 for a normal sheet", () => {
        const rows = [
            ["Project", "Subsidiary", "Category"],
            ["Alpha", "WNW", "Hot Lead"],
            ["Beta", "WNS", "Warm Lead"],
        ]
        const r = detectHeaderRow(rows)
        expect(r.headerRowIndex).toBe(0)
        expect(r.dataStartIndex).toBe(1)
    })

    it("skips banner row with single long sentence in first column", () => {
        const rows = [
            ["DATA SOURCE WEEKLY GROUP LEADS 2026 - Werkudara HQ", "", "", "", ""],
            ["", "", "", "", ""],
            ["JML", "#", "CATEGORY", "BU REVENUE", "COMPANY"],
            [1, 1, "HOT LEAD", "WNW", "PT Telkom"],
            [1, 2, "WARM LEAD", "WNW", "PT BCA"],
        ]
        const r = detectHeaderRow(rows)
        expect(r.headerRowIndex).toBe(2)
        expect(r.dataStartIndex).toBe(3)
    })

    it("skips empty merged-group header row", () => {
        const rows = [
            ["", "", "", "", "", "", "SOURCE KLIEN", "", ""],
            ["JML", "#", "CATEGORY", "BU REVENUE", "COMPANY", "PROJECT", "PIC", "STAGE", "VALUE"],
            [1, 1, "HOT", "WNW", "PT A", "Foo", "Adiel", "Open", 100],
        ]
        const r = detectHeaderRow(rows)
        expect(r.headerRowIndex).toBe(1)
        expect(r.dataStartIndex).toBe(2)
    })
})

describe("buildHeaderAndRows", () => {
    it("uses detected header row + skips empty rows", () => {
        const raw = [
            ["DATA SOURCE WEEKLY GROUP LEADS 2026", "", ""],
            ["JML", "CATEGORY", "BU REVENUE"],
            [1, "HOT LEAD", "WNW"],
            ["", "", ""],
            [2, "WARM LEAD", "WNS"],
        ]
        const detection = detectHeaderRow(raw)
        const { headers, rows } = buildHeaderAndRows(raw, detection)
        expect(headers).toEqual(["JML", "CATEGORY", "BU REVENUE"])
        expect(rows.length).toBe(2)
        expect(rows[0]).toEqual({ JML: "1", CATEGORY: "HOT LEAD", "BU REVENUE": "WNW" })
        expect(rows[1]).toEqual({ JML: "2", CATEGORY: "WARM LEAD", "BU REVENUE": "WNS" })
    })

    it("falls back to placeholder name when header cell is empty", () => {
        const raw = [
            ["A", "", "C"],
            [1, 2, 3],
        ]
        const detection = detectHeaderRow(raw)
        const { headers } = buildHeaderAndRows(raw, detection)
        expect(headers).toEqual(["A", "Column 2", "C"])
    })
})
