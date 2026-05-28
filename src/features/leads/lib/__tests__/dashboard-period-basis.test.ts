import { describe, it, expect } from "vitest"
import {
    splitLeadsByBasis,
    getReceivedDate,
    getCloseDate,
    getTargetCloseDate,
    getDateForBasis,
    type DateBasis,
} from "../dashboard-period"

const NOW = new Date(2026, 4, 20) // May 20 2026 (local time)

type MinimalLead = {
    id: number
    created_at?: string | null
    received_date?: string | null
    closed_won_date?: string | null
    closed_lost_date?: string | null
    target_close_date?: string | null
    month_event?: string | null
    event_date_end?: string | null
    event_date_start?: string | null
}

describe("getReceivedDate", () => {
    it("prefers received_date over created_at", () => {
        const d = getReceivedDate({ received_date: "2026-04-15", created_at: "2026-01-01" })
        expect(d?.getMonth()).toBe(3) // April
    })

    it("falls back to created_at when received_date missing", () => {
        const d = getReceivedDate({ created_at: "2026-02-01" })
        expect(d?.getMonth()).toBe(1) // February
    })

    it("returns null when neither present", () => {
        expect(getReceivedDate({})).toBeNull()
    })
})

describe("getCloseDate", () => {
    it("prefers closed_won_date over closed_lost_date", () => {
        const d = getCloseDate({ closed_won_date: "2026-04-10", closed_lost_date: "2026-03-10" })
        expect(d?.getMonth()).toBe(3)
    })

    it("falls back to closed_lost_date when no won date", () => {
        const d = getCloseDate({ closed_lost_date: "2026-04-10" })
        expect(d?.getMonth()).toBe(3)
    })

    it("returns null when neither present", () => {
        expect(getCloseDate({})).toBeNull()
    })
})

describe("getTargetCloseDate", () => {
    it("returns parsed target_close_date with no fallback", () => {
        expect(getTargetCloseDate({ target_close_date: "2026-06-01" })?.getMonth()).toBe(5)
    })

    it("returns null when target_close_date missing — no fallback by design", () => {
        expect(getTargetCloseDate({ created_at: "2026-04-01" })).toBeNull()
    })
})

describe("getDateForBasis switch", () => {
    const lead: MinimalLead = {
        id: 1,
        received_date: "2026-04-15",
        closed_won_date: "2026-05-01",
        target_close_date: "2026-06-01",
        month_event: "July 2026",
    }

    it.each<[DateBasis, number]>([
        ["received", 3],     // April
        ["close", 4],        // May
        ["target_close", 5], // June
        ["revenue", 6],      // July (from month_event)
    ])("basis %s → month index %i", (basis, expectedMonth) => {
        expect(getDateForBasis(lead, basis)?.getMonth()).toBe(expectedMonth)
    })
})

describe("splitLeadsByBasis", () => {
    const leads: MinimalLead[] = [
        { id: 1, received_date: "2026-04-10", closed_won_date: "2026-05-15" },          // received → Apr, close → May
        { id: 2, received_date: "2026-05-15", closed_lost_date: "2026-05-20" },         // received → May, close → May
        { id: 3, received_date: "2026-06-01" },                                          // received → Jun, no close
        { id: 4, received_date: "2026-04-01", target_close_date: "2026-05-30" },         // target → May, no close
        { id: 5, received_date: "2026-03-01" },                                          // received → Mar (Q1)
    ]

    it("buckets by received basis includes April + May leads in this_quarter (Apr-Jun)", () => {
        const r = splitLeadsByBasis(leads, "received", "this_quarter", NOW)
        expect(r.current.map(l => l.id).sort()).toEqual([1, 2, 3, 4])
        expect(r.excluded).toEqual([])
    })

    it("buckets by close basis only includes leads that have a close date in May", () => {
        const r = splitLeadsByBasis(leads, "close", "this_month", NOW) // May
        expect(r.current.map(l => l.id).sort()).toEqual([1, 2])
        // Leads 3, 4, 5 have no close date → all excluded
        expect(r.excluded.map(l => l.id).sort()).toEqual([3, 4, 5])
    })

    it("buckets by target_close basis only includes lead with target date in May", () => {
        const r = splitLeadsByBasis(leads, "target_close", "this_month", NOW) // May
        expect(r.current.map(l => l.id)).toEqual([4])
        // Everyone else has no target_close_date → excluded
        expect(r.excluded.length).toBe(4)
    })

    it("previous bucket for this_quarter (Apr–Jun) is Apr–Jun of previous year", () => {
        const lastYear: MinimalLead[] = [
            { id: 100, received_date: "2025-05-10" },
        ]
        const r = splitLeadsByBasis(lastYear, "received", "this_quarter", NOW)
        expect(r.current).toEqual([])
        expect(r.previous.map(l => l.id)).toEqual([100])
    })
})
