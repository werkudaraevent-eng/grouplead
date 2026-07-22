import { describe, it, expect } from "vitest"
import {
    resolveFieldByAlias,
    fuzzyMatchFieldKey,
    normalizeHeaderKey,
} from "../import-aliases"

describe("normalizeHeaderKey", () => {
    it("lowercases and collapses non-alphanumerics", () => {
        expect(normalizeHeaderKey("BU REVENUE")).toBe("bu revenue")
        expect(normalizeHeaderKey("VENUE/ HOTEL")).toBe("venue hotel")
        expect(normalizeHeaderKey(" DATE OF EVENT ")).toBe("date of event")
        expect(normalizeHeaderKey("Date_Created")).toBe("date created")
    })
})

describe("resolveFieldByAlias — sample-derived headers", () => {
    const cases: Array<[string, string]> = [
        ["NAME OF PROJECT", "project_name"],
        ["BU REVENUE", "subsidiary_name"],
        ["COMPANY", "client_company_name"],
        ["CONTACT FULL NAME", "contact_name"],
        ["PIC SALES", "pic_sales_name"],
        ["NO. OF PAX", "pax_count"],
        ["EST REVENUE", "estimated_value"],
        ["EST. CLOSING DATE", "target_close_date"],
        ["DATE OF EVENT", "event_dates"],
        ["LOKASI (NAMA KOTA)", "destination_city"],
        ["VENUE/ HOTEL", "destination_venue"],
        ["TIPE STREAM", "stream_type"],
        ["MAIN STREAM", "main_stream"],
        ["SOURCE LEAD", "lead_source"],
        ["REFERRAL", "referral_source"],
        ["GRADE LEAD", "grade_lead"],
        ["MATERIALIZED", "actual_value"],
        ["CANCEL/ LOST/ POST REASON", "lost_reason"],
        ["CATEGORY", "category"],
        ["AREA", "area"],
        // Received-flavored headers now resolve to the dedicated received_date
        // field (mappable in both standard + historical import). The
        // historical importer reads `received_date ?? created_at`, so backfill
        // behavior is preserved.
        ["MONTH RECEIVE LEAD", "received_date"],
        ["RECEIVED DATE", "received_date"],
        // created_at keeps the genuinely creation-specific phrasings.
        ["CREATED DATE", "created_at"],
    ]

    for (const [header, expected] of cases) {
        it(`maps "${header}" → ${expected}`, () => {
            expect(resolveFieldByAlias(header)).toBe(expected)
        })
    }

    it("returns null for unknown headers", () => {
        expect(resolveFieldByAlias("xyzzy")).toBe(null)
        expect(resolveFieldByAlias("foo bar baz")).toBe(null)
    })
})

describe("fuzzyMatchFieldKey", () => {
    it("matches mistyped header above threshold", () => {
        const r = fuzzyMatchFieldKey("project nam")
        expect(r?.fieldKey).toBe("project_name")
    })

    it("returns null below threshold", () => {
        const r = fuzzyMatchFieldKey("zzz xyz", 0.8)
        expect(r).toBe(null)
    })
})
