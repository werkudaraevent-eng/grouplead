import { describe, expect, it } from "vitest"
import { sharedScopeTerm } from "@/utils/supabase/scoped-query"
import { COMPANY_LIST } from "./company-list"
import { CONTACT_LIST } from "./contact-list"
import { LOOKUP_LIMIT, distinctValues, planList, rangeOf, resolvedFilter, urlSpecOf } from "./list-plan"
import { EMPTY_LIST_STATE, parseListState, type ListState } from "./list-state"

const UNIT = "11111111-2222-3333-4444-555555555555"
const contacts = (qs: string): ListState => parseListState(new URLSearchParams(qs), urlSpecOf(CONTACT_LIST))
const companies = (qs: string): ListState => parseListState(new URLSearchParams(qs), urlSpecOf(COMPANY_LIST))

describe("sharedScopeTerm", () => {
    it("keeps the unit's rows and the unassigned ones; the holding view is not narrowed", () => {
        expect(sharedScopeTerm(UNIT)).toBe(`or(company_id.eq.${UNIT},company_id.is.null)`)
        expect(sharedScopeTerm(null)).toBeNull()
    })
})

describe("planList on the view", () => {
    it("the plain list is name A to Z with the id as tiebreak", () => {
        const plan = planList(CONTACT_LIST, EMPTY_LIST_STATE, "view", null)
        expect(plan.source).toBe("contact_list_rows")
        expect(plan.select).toContain("company_name, owner_name, owner_avatar_url")
        expect(plan.terms).toEqual([])
        expect(plan.order).toEqual([
            { column: "full_name", ascending: true, nullsFirst: false },
            { column: "id", ascending: true, nullsFirst: false },
        ])
        expect(plan.fallbackOrder).toBeNull()
    })

    it("searches the related names as plain columns", () => {
        const plan = planList(CONTACT_LIST, contacts("q=maju"), "view", sharedScopeTerm(UNIT))
        expect(plan.terms[0]).toBe(sharedScopeTerm(UNIT))
        expect(plan.terms[1]).toContain('company_name.ilike."*maju*"')
        expect(plan.terms[1]).toContain('full_name.ilike."*maju*"')
        expect(plan.deferred).toEqual([])
    })

    it("filters a related name on its flattened column", () => {
        const plan = planList(CONTACT_LIST, contacts("company=eq:PT Maju&owner=is_empty&email=is_true&needs_details=is_true"), "view", null)
        expect(plan.terms).toEqual([
            'company_name.ilike."PT Maju"',
            'or(owner_name.is.null,owner_name.eq."")',
            'email.match."[^[:space:]]"',
            "needs_enrichment.is.true",
        ])
    })

    it("sorts a related column by its flattened name, then name, then id", () => {
        const plan = planList(COMPANY_LIST, companies("sort=parent:desc"), "view", null)
        expect(plan.order.map((o) => [o.column, o.ascending])).toEqual([["parent_name", false], ["name", true], ["id", true]])
        expect(plan.order[0].nullsFirst).toBe(false)
    })

    it("sorting by the name itself needs no second name", () => {
        const plan = planList(COMPANY_LIST, companies("sort=name:desc"), "view", null)
        expect(plan.order.map((o) => o.column)).toEqual(["name", "id"])
    })
})

describe("planList on the base table (before the migration)", () => {
    it("asks for a related order and keeps the default order to fall back to", () => {
        const plan = planList(CONTACT_LIST, contacts("sort=client_company:asc"), "table", null)
        expect(plan.source).toBe("contacts")
        expect(plan.order[0]).toEqual({ column: "client_company(name)", ascending: true, nullsFirst: false })
        expect(plan.fallbackOrder?.map((o) => o.column)).toEqual(["full_name", "id"])
    })

    it("resolves a related-name filter through a lookup of ids", () => {
        const plan = planList(CONTACT_LIST, contacts("company=neq:Acme&source=eq:Event"), "table", null)
        expect(plan.terms).toEqual(['contact_source.ilike."Event"'])
        expect(plan.deferred).toHaveLength(1)
        const [deferred] = plan.deferred
        expect(deferred.lookups).toEqual([{ table: "client_companies", column: "name", term: 'name.ilike."Acme"', softDelete: true, limit: LOOKUP_LIMIT }])
        expect(deferred.build([["c1", "c2"]])).toBe("or(client_company_id.is.null,client_company_id.not.in.(c1,c2))")
        expect(resolvedFilter(plan, [deferred.build([["c1"]])])).toBe(
            'and(contact_source.ilike."Event",or(client_company_id.is.null,client_company_id.not.in.(c1)))',
        )
    })

    it("a search reaches owner and parent names through their ids", () => {
        const plan = planList(COMPANY_LIST, companies("q=abc"), "table", null)
        expect(plan.terms).toEqual([])
        const [deferred] = plan.deferred
        expect(deferred.lookups.map((l) => l.table)).toEqual(["profiles", "client_companies"])
        const term = deferred.build([["p1"], []])
        expect(term).toContain('name.ilike."*abc*"')
        expect(term).toContain("owner_id.in.(p1)")
        expect(term).not.toContain("parent_id")
    })

    it("an empty-relation filter needs no lookup", () => {
        const plan = planList(COMPANY_LIST, companies("owner=is_not_empty"), "table", null)
        expect(plan.terms).toEqual(["owner_id.not.is.null"])
        expect(plan.deferred).toEqual([])
    })
})

describe("helpers", () => {
    it("pages as PostgREST's inclusive range", () => {
        expect(rangeOf(0, 25)).toEqual({ from: 0, to: 24 })
        expect(rangeOf(2, 50)).toEqual({ from: 100, to: 149 })
    })

    it("makes filter choices distinct without case, A to Z", () => {
        expect(distinctValues(["Hotel", "hotel ", null, "", "Bank", undefined, "bank"])).toEqual(["Bank", "Hotel"])
    })

    it("every sortable header of both lists has a sort target", () => {
        expect(urlSpecOf(CONTACT_LIST).sortKeys).toContain("client_company")
        expect(urlSpecOf(CONTACT_LIST).sortKeys).not.toContain("socials")
        expect(urlSpecOf(COMPANY_LIST).sortKeys).toEqual(
            expect.arrayContaining(["name", "industry", "line_industry", "phone", "website", "owner", "parent", "address", "city", "postal_code", "country", "created_at"]),
        )
    })

    it("maps a view row to the table's row shape", () => {
        const row = CONTACT_LIST.fromView({ id: "1", full_name: "A", company_name: "Acme", owner_name: null, owner_avatar_url: null })
        expect(row.client_company).toEqual({ name: "Acme" })
        expect(row.owner).toBeNull()
        expect(row).not.toHaveProperty("company_name")
        const company = COMPANY_LIST.fromView({ id: "2", name: "B", parent_id: "3", parent_name: "C", owner_name: "Dina", owner_avatar_url: "x" })
        expect(company.parent).toEqual({ id: "3", name: "C" })
        expect(company.owner).toEqual({ full_name: "Dina", avatar_url: "x" })
        expect(company.lead_count).toBe(0)
    })
})
