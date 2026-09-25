import { joinFacts, readRecordTab, withRecordTab } from "@/lib/record-page"

/**
 * The company-only half of a company's record page
 * (`company-detail-page.tsx`): its tabs, the line under its name, its
 * address as one line, and what its group card is called. What every
 * record page shares is in `lib/record-page.ts`.
 */

export type CompanyTab = "activity" | "contacts" | "leads" | "files"

export const COMPANY_TAB_IDS: readonly CompanyTab[] = ["activity", "contacts", "leads", "files"]

/**
 * `?tab=` opens that tab; the old `?tab=overview`, `?tab=timeline` and
 * `?tab=notes` open Activity, which holds what Overview held; anything
 * else, Activity.
 */
export function readCompanyTab(value: string | string[] | null | undefined): CompanyTab {
    return readRecordTab(value, COMPANY_TAB_IDS, { overview: "activity", timeline: "activity", notes: "activity" })
}

/** The query string with the tab in it; Activity, the default, is left out. */
export function withCompanyTab(search: string, tab: CompanyTab): string {
    return withRecordTab(search, tab, "activity")
}

interface CompanyFacts {
    industry?: string | null
    line_industry?: string | null
    city?: string | null
    area?: string | null
}

/** Under the name: "Sector · Line industry · City", whichever are known (the area when there is no city). */
export function companySupportingLine(company: CompanyFacts): string {
    return joinFacts([company.industry, company.line_industry, company.city || company.area])
}

/** For another record's Company card: "Sector · City". */
export function companyCardLine(company: CompanyFacts): string {
    return joinFacts([company.line_industry || company.industry, company.city || company.area])
}

interface CompanyAddress {
    street_address?: string | null
    city?: string | null
    postal_code?: string | null
    country?: string | null
    address?: string | null
}

/** The structured address as one line, or the old free-text address when that is all there is. */
export function companyAddress(company: CompanyAddress): string | null {
    const structured = [company.street_address, company.city, company.postal_code, company.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ")
    return structured || company.address?.trim() || null
}

/** The group card's title: its parent, its subsidiaries, or both. */
export function companyGroupTitle(hasParent: boolean, subsidiaryCount: number): string | null {
    if (hasParent && subsidiaryCount > 0) return "Parent and subsidiaries"
    if (hasParent) return "Parent company"
    if (subsidiaryCount > 0) return "Subsidiaries"
    return null
}
