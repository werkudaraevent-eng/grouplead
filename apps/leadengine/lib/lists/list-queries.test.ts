import { beforeEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { COMPANY_LIST } from "./company-list"
import { CONTACT_LIST } from "./contact-list"
import { urlSpecOf } from "./list-plan"
import { forgetMissingViews, runListExport, runListOptions, runListPage } from "./list-queries"
import { parseListState } from "./list-state"

/**
 * A stand-in for the Supabase client that records each request (table and
 * the chain of builder calls) and answers from a handler, so the runner's
 * choices (view or table, related order or not, windows) are tested
 * without a database.
 */
type Call = { table: string; steps: Array<[string, unknown[]]> }
type Answer = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }

function fakeClient(answer: (call: Call) => Answer) {
    const calls: Call[] = []
    const builder = (call: Call): unknown => {
        const target: Record<string, unknown> = {}
        const proxy: unknown = new Proxy(target, {
            get(_, prop: string) {
                if (prop === "then") {
                    const result = answer(call)
                    return (resolve: (value: unknown) => unknown) => resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count ?? null })
                }
                return (...args: unknown[]) => {
                    call.steps.push([prop, args])
                    return proxy
                }
            },
        })
        return proxy
    }
    const client = {
        from(table: string) {
            const call: Call = { table, steps: [] }
            calls.push(call)
            return builder(call)
        },
    }
    return { client: client as unknown as SupabaseClient, calls }
}

const step = (call: Call, name: string) => call.steps.filter(([n]) => n === name).map(([, args]) => args)
const contactsState = (qs: string) => parseListState(new URLSearchParams(qs), urlSpecOf(CONTACT_LIST))
const companiesState = (qs: string) => parseListState(new URLSearchParams(qs), urlSpecOf(COMPANY_LIST))

beforeEach(() => forgetMissingViews())

describe("runListPage", () => {
    it("reads one page from the view with an exact count", async () => {
        const { client, calls } = fakeClient(() => ({ data: [{ id: "1", full_name: "Ana", company_name: "Acme", owner_name: null }], count: 1196 }))
        const result = await runListPage(client, CONTACT_LIST, contactsState("page=2"), null)
        expect(result).toEqual({ rows: [expect.objectContaining({ id: "1" })], total: 1196, unfiltered: null, source: "view" })
        expect(result.rows[0].client_company).toEqual({ name: "Acme" })
        expect(calls).toHaveLength(1)
        expect(calls[0].table).toBe("contact_list_rows")
        expect(step(calls[0], "select")[0][1]).toEqual({ count: "exact" })
        expect(step(calls[0], "is")[0]).toEqual(["deleted_at", null])
        expect(step(calls[0], "range")[0]).toEqual([50, 74])
    })

    it("while a search or filter narrows the list, also counts the list before them", async () => {
        const unit = "11111111-2222-3333-4444-555555555555"
        const { client, calls } = fakeClient((call) => (step(call, "or").some(([term]) => String(term).includes("ilike")) ? { data: [{ id: "1", full_name: "Ana" }], count: 170 } : { data: [{ id: "9", full_name: "Zed" }], count: 1196 }))
        const result = await runListPage(client, CONTACT_LIST, contactsState("q=an&page=2&sort=owner:desc"), unit)
        expect(result).toMatchObject({ total: 170, unfiltered: 1196 })
        expect(result.rows.map((row) => row.id)).toEqual(["1"])
        expect(calls).toHaveLength(2)
        const page = calls.find((c) => String(step(c, "or")[0]?.[0]).includes('company_name.ilike."*an*"'))!
        expect(step(page, "range")[0]).toEqual([50, 74])
        expect(step(page, "order").map((args) => args[0])).toContain("owner_name")
        const all = calls.find((c) => c !== page)!
        // The same unit, no search, no filter, no related order, one row at most.
        expect(step(all, "or")[0][0]).toBe(`and(or(company_id.eq.${unit},company_id.is.null))`)
        expect(step(all, "select")[0][1]).toEqual({ count: "exact" })
        expect(step(all, "range")[0]).toEqual([0, 0])
        expect(step(all, "order").map((args) => args[0])).not.toContain("owner_name")
    })

    it("a failed count before the filters leaves the page as it is", async () => {
        const { client } = fakeClient((call) => (step(call, "or").length > 0 ? { data: [], count: 3 } : { error: { code: "57014", message: "canceling statement due to statement timeout" } }))
        const result = await runListPage(client, CONTACT_LIST, contactsState("q=an"), null)
        expect(result).toMatchObject({ total: 3, unfiltered: null })
    })

    it("narrows to the unit plus unassigned rows in the same filter", async () => {
        const unit = "11111111-2222-3333-4444-555555555555"
        const { client, calls } = fakeClient(() => ({ data: [], count: 0 }))
        await runListPage(client, COMPANY_LIST, companiesState(""), unit)
        expect(step(calls[0], "or")[0][0]).toBe(`and(or(company_id.eq.${unit},company_id.is.null))`)
    })

    it("falls back to the base table when the view is missing, and does not ask again", async () => {
        const { client, calls } = fakeClient((call) =>
            call.table === "contact_list_rows"
                ? { error: { code: "PGRST205", message: "Could not find the table 'public.contact_list_rows' in the schema cache" } }
                : { data: [{ id: "1", full_name: "Ana", client_company: { name: "Acme" }, owner: null }], count: 1 },
        )
        const first = await runListPage(client, CONTACT_LIST, contactsState(""), null)
        expect(first.source).toBe("table")
        expect(first.rows[0].client_company).toEqual({ name: "Acme" })
        expect(calls.map((c) => c.table)).toEqual(["contact_list_rows", "contacts"])
        await runListPage(client, CONTACT_LIST, contactsState(""), null)
        expect(calls.map((c) => c.table)).toEqual(["contact_list_rows", "contacts", "contacts"])
    })

    it("without the view, resolves a related filter through a lookup first", async () => {
        const { client, calls } = fakeClient((call) => {
            if (call.table === "client_company_list_rows") return { error: { code: "42P01", message: "relation does not exist" } }
            if (call.table === "profiles") return { data: [{ id: "p1" }] }
            return { data: [], count: 0 }
        })
        await runListPage(client, COMPANY_LIST, companiesState("owner=eq:Budi"), null)
        const lookup = calls.find((c) => c.table === "profiles")!
        expect(step(lookup, "or")[0][0]).toBe('and(full_name.ilike."Budi")')
        expect(step(lookup, "limit")[0][0]).toBe(100)
        const main = calls.filter((c) => c.table === "client_companies").find((c) => step(c, "or").length > 0)!
        expect(step(main, "or")[0][0]).toBe("and(owner_id.in.(p1))")
    })

    it("without the view, retries a refused related order with the default order", async () => {
        let tries = 0
        const { client, calls } = fakeClient((call) => {
            if (call.table === "contact_list_rows") return { error: { code: "PGRST205" } }
            tries++
            return tries === 1 ? { error: { code: "PGRST100", message: "failed to parse order" } } : { data: [], count: 0 }
        })
        await runListPage(client, CONTACT_LIST, contactsState("sort=owner:desc"), null)
        const [refused, retried] = calls.filter((c) => c.table === "contacts")
        expect(step(refused, "order")[0][0]).toBe("owner(full_name)")
        expect(step(retried, "order").map((args) => args[0])).toEqual(["full_name", "id"])
    })

    it("a page past the end answers with the count and no rows", async () => {
        const { client } = fakeClient((call) => (call.steps.some(([n, args]) => n === "select" && (args[1] as { head?: boolean })?.head) ? { count: 30 } : { error: { code: "PGRST103", message: "Requested range not satisfiable" } }))
        const result = await runListPage(client, CONTACT_LIST, contactsState("page=9"), null)
        expect(result).toEqual({ rows: [], total: 30, unfiltered: null, source: "view" })
    })

    it("surfaces any other error", async () => {
        const { client } = fakeClient(() => ({ error: { code: "42501", message: "permission denied" } }))
        await expect(runListPage(client, CONTACT_LIST, contactsState(""), null)).rejects.toThrow("permission denied")
    })
})

describe("runListExport", () => {
    it("reads every match in windows of 1000, counting once", async () => {
        const { client, calls } = fakeClient((call) => {
            const [from, to] = step(call, "range")[0] as [number, number]
            const size = Math.max(0, Math.min(to, 2499) - from + 1)
            return { data: Array.from({ length: size }, (_, i) => ({ id: String(from + i), full_name: "x" })), count: 2500 }
        })
        const result = await runListExport(client, CONTACT_LIST, contactsState("page=4&size=25"), null)
        expect(result.total).toBe(2500)
        expect(result.rows).toHaveLength(2500)
        expect(calls.map((c) => step(c, "range")[0])).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
        expect(step(calls[0], "select")[0][1]).toEqual({ count: "exact" })
        expect(step(calls[1], "select")[0][1]).toBeUndefined()
    })

    it("stops at the cap", async () => {
        const { client } = fakeClient((call) => {
            const [from, to] = step(call, "range")[0] as [number, number]
            return { data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i), name: "x" })), count: 9000 }
        })
        const result = await runListExport(client, COMPANY_LIST, companiesState(""), null, 1500)
        expect(result.rows).toHaveLength(1500)
        expect(result.total).toBe(9000)
    })
})

describe("runListOptions", () => {
    it("makes each select filter's choices distinct", async () => {
        const { client, calls } = fakeClient(() => ({
            data: [
                { industry: "Hotel", line_industry: null, country: "Indonesia", owner_name: "Budi" },
                { industry: "hotel", line_industry: "MICE", country: "Indonesia", owner_name: null },
                { industry: "Bank", line_industry: null, country: null, owner_name: "Ana" },
            ],
        }))
        const options = await runListOptions(client, COMPANY_LIST, null)
        expect(options).toEqual({
            industry: ["Bank", "Hotel"],
            line_industry: ["MICE"],
            "owner.full_name": ["Ana", "Budi"],
            country: ["Indonesia"],
        })
        expect(calls[0].table).toBe("client_company_list_rows")
    })

    it("reads the base table when the view is missing", async () => {
        const { client, calls } = fakeClient((call) =>
            call.table === "contact_list_rows" ? { error: { code: "PGRST205" } } : { data: [{ contact_source: "Event", client_company: { name: "Acme" }, owner: { full_name: "Budi" } }] },
        )
        const options = await runListOptions(client, CONTACT_LIST, null)
        expect(options).toEqual({ "client_company.name": ["Acme"], "owner.full_name": ["Budi"], contact_source: ["Event"] })
        expect(calls.map((c) => c.table)).toEqual(["contact_list_rows", "contacts"])
    })
})
