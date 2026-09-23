import { describe, expect, it } from "vitest"
import {
    ZERO_UUID,
    combineTerms,
    dateTerm,
    dayStart,
    effectiveFilters,
    escapeLike,
    flagTerm,
    nextDay,
    presenceTerm,
    quoteValue,
    relationFilterPlan,
    relationIdsTerm,
    searchTerm,
    textTerm,
} from "./postgrest-filters"

describe("quoting and escaping", () => {
    it("quotes a value so PostgREST's reserved characters read as text", () => {
        expect(quoteValue("PT Maju, Tbk (Jakarta)")).toBe('"PT Maju, Tbk (Jakarta)"')
        expect(quoteValue('say "hi"')).toBe('"say \\"hi\\""')
        expect(quoteValue("a\\b")).toBe('"a\\\\b"')
    })

    it("makes % and _ literal for LIKE", () => {
        expect(escapeLike("50%_off")).toBe("50\\%\\_off")
    })

    it("counts days in WIB", () => {
        expect(dayStart("2026-03-01")).toBe("2026-03-01T00:00:00+07:00")
        expect(nextDay("2026-02-28")).toBe("2026-03-01")
        expect(nextDay("2026-12-31")).toBe("2027-01-01")
    })
})

describe("textTerm", () => {
    it("compares without case, as the old browser filter did", () => {
        expect(textTerm("industry", "eq", "Hotel")).toBe('industry.ilike."Hotel"')
        expect(textTerm("job_title", "contains", "sales")).toBe('job_title.ilike."*sales*"')
        expect(textTerm("job_title", "starts_with", "Head")).toBe('job_title.ilike."Head*"')
    })

    it("keeps empty values under a negative operator", () => {
        expect(textTerm("industry", "neq", "Hotel")).toBe('or(industry.is.null,industry.not.ilike."Hotel")')
        expect(textTerm("notes", "not_contains", "x")).toBe('or(notes.is.null,notes.not.ilike."*x*")')
        expect(textTerm("tag", "not_in", ["a", "b"])).toBe('or(tag.is.null,and(tag.not.ilike."a",tag.not.ilike."b"))')
    })

    it("reads empty as null or blank", () => {
        expect(textTerm("country", "is_empty", null)).toBe('or(country.is.null,country.eq."")')
        expect(textTerm("country", "is_not_empty", null)).toBe('and(country.not.is.null,country.neq."")')
    })

    it("matches any of a list", () => {
        expect(textTerm("tag", "in", ["a", "b,c"])).toBe('or(tag.ilike."a",tag.ilike."b,c")')
    })

    it("writes nothing for a missing value or a non-text operator", () => {
        expect(textTerm("industry", "eq", "")).toBeNull()
        expect(textTerm("industry", "in", [])).toBeNull()
        expect(textTerm("industry", "is_true", null)).toBeNull()
    })
})

describe("presence, flags and dates", () => {
    it("Has email means anything but white space", () => {
        expect(presenceTerm("email", "is_true")).toBe('email.match."[^[:space:]]"')
        expect(presenceTerm("email", "is_false")).toBe('or(email.is.null,email.not.match."[^[:space:]]")')
        // Saved views from before the boolean operators.
        expect(presenceTerm("email", "is_not_empty")).toBe(presenceTerm("email", "is_true"))
        expect(presenceTerm("email", "is_empty")).toBe(presenceTerm("email", "is_false"))
    })

    it("a missing flag reads as false", () => {
        expect(flagTerm("needs_enrichment", "is_true")).toBe("needs_enrichment.is.true")
        expect(flagTerm("needs_enrichment", "is_false")).toBe("needs_enrichment.not.is.true")
    })

    it("a date range covers whole WIB days, the last one included", () => {
        expect(dateTerm("created_at", "between", ["2026-03-01", "2026-03-31"])).toBe(
            'and(created_at.gte."2026-03-01T00:00:00+07:00",created_at.lt."2026-04-01T00:00:00+07:00")',
        )
        expect(dateTerm("created_at", "between", [null, "2026-03-31"])).toBe('created_at.lt."2026-04-01T00:00:00+07:00"')
        expect(dateTerm("created_at", "before", [null, "2026-03-01"])).toBe('created_at.lt."2026-03-01T00:00:00+07:00"')
        expect(dateTerm("created_at", "after", ["2026-03-01", null])).toBe('created_at.gte."2026-03-02T00:00:00+07:00"')
        expect(dateTerm("created_at", "between", [null, null])).toBeNull()
    })
})

describe("relations without the view", () => {
    it("looks up the positive set and negates on the row side", () => {
        expect(relationFilterPlan("client_company_id", "name", { field: "c", operator: "eq", value: "Acme" })).toEqual({
            kind: "lookup",
            lookupTerm: 'name.ilike."Acme"',
            negate: false,
        })
        expect(relationFilterPlan("client_company_id", "name", { field: "c", operator: "neq", value: "Acme" })).toEqual({
            kind: "lookup",
            lookupTerm: 'name.ilike."Acme"',
            negate: true,
        })
        expect(relationFilterPlan("owner_id", "full_name", { field: "o", operator: "is_empty", value: null })).toEqual({ kind: "term", term: "owner_id.is.null" })
    })

    it("keeps no rows when nothing matched, and every row when a negation matched nothing", () => {
        expect(relationIdsTerm("owner_id", [], false)).toBe(`owner_id.in.(${ZERO_UUID})`)
        expect(relationIdsTerm("owner_id", ["a", "b"], false)).toBe("owner_id.in.(a,b)")
        expect(relationIdsTerm("owner_id", [], true)).toBeNull()
        expect(relationIdsTerm("owner_id", ["a"], true)).toBe("or(owner_id.is.null,owner_id.not.in.(a))")
    })
})

describe("search and combining", () => {
    it("ORs the search across the columns and any extra branch", () => {
        expect(searchTerm(["full_name", "email"], " maju ")).toBe('or(full_name.ilike."*maju*",email.ilike."*maju*")')
        expect(searchTerm(["name"], "x", ["parent_id.in.(a)"])).toBe('or(name.ilike."*x*",parent_id.in.(a))')
        expect(searchTerm(["name"], "  ")).toBeNull()
    })

    it("ANDs every term into one body", () => {
        expect(combineTerms([])).toBeNull()
        expect(combineTerms(["a.eq.1", null, "or(b.is.null,c.eq.2)"])).toBe("and(a.eq.1,or(b.is.null,c.eq.2))")
    })

    it("keeps one effective filter per field", () => {
        expect(
            effectiveFilters([
                { field: "a", operator: "eq", value: "" },
                { field: "a", operator: "eq", value: "x" },
                { field: "a", operator: "eq", value: "y" },
                { field: "b", operator: "is_true", value: null },
            ]),
        ).toEqual([{ field: "a", operator: "eq", value: "x" }, { field: "b", operator: "is_true", value: null }])
    })
})
