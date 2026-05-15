import { describe, it, expect } from "vitest"
import { computeAccountStatus } from "../compute-account-status"
import type { SupabaseClient } from "@supabase/supabase-js"

// Minimal stub that satisfies the calls made by computeAccountStatus.
// We model the two `from(...)` chains it uses: one targeting client_companies
// (.select.eq.maybeSingle) and one targeting leads (.select.eq → array).
function makeSupabaseStub(options: {
    companyAccountStatus?: string | null
    priorLeads?: Array<{ closed_status: string | null }>
}): SupabaseClient {
    const company = options.companyAccountStatus !== undefined
        ? { account_status: options.companyAccountStatus }
        : null
    const leads = (options.priorLeads ?? []).map((l, idx) => ({
        id: idx + 1,
        pipeline_stage: { closed_status: l.closed_status },
    }))

    return {
        from(table: string) {
            if (table === "client_companies") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({ data: company, error: null }),
                        }),
                    }),
                }
            }
            if (table === "leads") {
                return {
                    select: () => ({
                        eq: () => Promise.resolve({ data: leads, error: null }),
                    }),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        },
    } as unknown as SupabaseClient
}

describe("computeAccountStatus", () => {
    it("returns 'new' with a generic reason when no client company is provided", async () => {
        const stub = makeSupabaseStub({})
        const result = await computeAccountStatus(stub, null)
        expect(result.value).toBe("new")
        expect(result.priorLeadCount).toBe(0)
        expect(result.closedWonCount).toBe(0)
        expect(result.companyIsContracted).toBe(false)
    })

    it("returns 'contracted' when the company itself is flagged contracted", async () => {
        const stub = makeSupabaseStub({
            companyAccountStatus: "contracted",
            priorLeads: [{ closed_status: null }],
        })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("contracted")
        expect(result.companyIsContracted).toBe(true)
    })

    it("normalizes uppercase company status to lower-case before checking", async () => {
        const stub = makeSupabaseStub({ companyAccountStatus: "Contracted" })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("contracted")
    })

    it("returns 'repeater' when the company has at least one closed-won lead", async () => {
        const stub = makeSupabaseStub({
            companyAccountStatus: "new",
            priorLeads: [
                { closed_status: "won" },
                { closed_status: null },
            ],
        })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("repeater")
        expect(result.closedWonCount).toBe(1)
        expect(result.priorLeadCount).toBe(2)
    })

    it("returns 'new' when the company has prior leads but none closed won", async () => {
        const stub = makeSupabaseStub({
            companyAccountStatus: "new",
            priorLeads: [
                { closed_status: "lost" },
                { closed_status: null },
            ],
        })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("new")
        expect(result.priorLeadCount).toBe(2)
        expect(result.closedWonCount).toBe(0)
    })

    it("returns 'new' with the no-history reason when the company has no prior leads", async () => {
        const stub = makeSupabaseStub({ companyAccountStatus: null, priorLeads: [] })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("new")
        expect(result.priorLeadCount).toBe(0)
        expect(result.reason).toContain("No prior history")
    })

    it("prefers contracted over repeater when both signals exist", async () => {
        const stub = makeSupabaseStub({
            companyAccountStatus: "contracted",
            priorLeads: [{ closed_status: "won" }, { closed_status: "won" }],
        })
        const result = await computeAccountStatus(stub, "company-1")
        expect(result.value).toBe("contracted")
    })
})
