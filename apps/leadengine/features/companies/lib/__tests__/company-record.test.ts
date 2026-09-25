import { describe, expect, it } from "vitest"
import {
    COMPANY_TAB_IDS,
    companyAddress,
    companyCardLine,
    companyGroupTitle,
    companySupportingLine,
    readCompanyTab,
    withCompanyTab,
} from "../company-record"

describe("tabs", () => {
    it("are Activity, Contacts, Leads and Files", () => {
        expect(COMPANY_TAB_IDS).toEqual(["activity", "contacts", "leads", "files"])
    })

    it("open the tab the address names, the old ones as Activity", () => {
        expect(readCompanyTab("contacts")).toBe("contacts")
        expect(readCompanyTab("overview")).toBe("activity")
        expect(readCompanyTab("activity")).toBe("activity")
        expect(readCompanyTab("timeline")).toBe("activity")
        expect(readCompanyTab("notes")).toBe("activity")
        expect(readCompanyTab("x")).toBe("activity")
        expect(withCompanyTab("", "files")).toBe("tab=files")
        expect(withCompanyTab("tab=files", "activity")).toBe("")
    })
})

describe("lines", () => {
    it("say sector, line industry and city under the name", () => {
        expect(companySupportingLine({ industry: "Banking", line_industry: "State-owned bank", city: "Jakarta Selatan" })).toBe("Banking · State-owned bank · Jakarta Selatan")
        expect(companySupportingLine({ industry: null, line_industry: null, city: null, area: "Jakarta" })).toBe("Jakarta")
        expect(companySupportingLine({})).toBe("")
    })

    it("say one industry and the city on another record's card", () => {
        expect(companyCardLine({ industry: "Technology", line_industry: "IT Services", city: "Jakarta Selatan" })).toBe("IT Services · Jakarta Selatan")
        expect(companyCardLine({ industry: "Technology" })).toBe("Technology")
    })

    it("read the address as one line, or the old one", () => {
        expect(companyAddress({ street_address: "Jl. Gatot Subroto 36", city: "Jakarta", postal_code: "12190", country: " " })).toBe("Jl. Gatot Subroto 36, Jakarta, 12190")
        expect(companyAddress({ address: "Menara Mandiri" })).toBe("Menara Mandiri")
        expect(companyAddress({})).toBeNull()
    })

    it("title the group card by what it holds", () => {
        expect(companyGroupTitle(true, 2)).toBe("Parent and subsidiaries")
        expect(companyGroupTitle(true, 0)).toBe("Parent company")
        expect(companyGroupTitle(false, 3)).toBe("Subsidiaries")
        expect(companyGroupTitle(false, 0)).toBeNull()
    })
})
