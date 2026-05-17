import { describe, it, expect } from "vitest"
import { excelSerialToISO, looksLikeExcelSerial } from "../excel-date"

describe("excelSerialToISO", () => {
    it("converts standard serial to ISO date", () => {
        // 46012 = 2025-12-21 per xlsx SSF.parse_date_code
        expect(excelSerialToISO(46012)).toBe("2025-12-21")
        expect(excelSerialToISO(46023)).toBe("2026-01-01")
        expect(excelSerialToISO(45992)).toBe("2025-12-01")
    })

    it("ignores fractional time portion", () => {
        expect(excelSerialToISO(46012.375)).toBe("2025-12-21")
        expect(excelSerialToISO(46003.416666666664)).toBe("2025-12-12")
    })

    it("accepts numeric strings", () => {
        expect(excelSerialToISO("46012")).toBe("2025-12-21")
        expect(excelSerialToISO("46012.5")).toBe("2025-12-21")
    })

    it("rejects 4-digit year strings", () => {
        // 2025/2026 must never be misread as a serial.
        expect(excelSerialToISO("2025")).toBe(null)
        expect(excelSerialToISO("2026")).toBe(null)
        expect(excelSerialToISO("1999")).toBe(null)
    })

    it("rejects very small numeric values", () => {
        // Numeric 2026 is below the MIN_SERIAL floor; if it were
        // somehow accepted it would be a 1905 date which is implausible
        // for a modern CRM and also collides with year-only inputs.
        expect(excelSerialToISO(2026)).toBe(null)
        expect(excelSerialToISO(0)).toBe(null)
        expect(excelSerialToISO(-100)).toBe(null)
    })

    it("rejects non-numeric input", () => {
        expect(excelSerialToISO("abc")).toBe(null)
        expect(excelSerialToISO("3-5 Jan 2026")).toBe(null)
        expect(excelSerialToISO(null)).toBe(null)
        expect(excelSerialToISO(undefined)).toBe(null)
        expect(excelSerialToISO({})).toBe(null)
    })

    it("rejects out-of-range serials", () => {
        expect(excelSerialToISO(100_000)).toBe(null)
    })

    it("looksLikeExcelSerial mirrors converter", () => {
        expect(looksLikeExcelSerial(46012)).toBe(true)
        expect(looksLikeExcelSerial("2026")).toBe(false)
        expect(looksLikeExcelSerial("3 Jan 2026")).toBe(false)
    })
})
