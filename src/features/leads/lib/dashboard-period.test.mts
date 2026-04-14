import test from "node:test"
import assert from "node:assert/strict"

import { splitDashboardLeadsByPeriod } from "./dashboard-period.ts"

test("splitDashboardLeadsByPeriod returns current quarter and same quarter last year", () => {
    const now = new Date("2026-04-13T10:00:00.000Z")
    const leads = [
        { id: 1, created_at: "2026-04-01T00:00:00.000Z" },
        { id: 2, created_at: "2026-05-01T00:00:00.000Z" },
        { id: 3, created_at: "2026-01-10T00:00:00.000Z" },
        { id: 4, created_at: "2025-04-02T00:00:00.000Z" },
        { id: 5, created_at: "2025-06-20T00:00:00.000Z" },
        { id: 6, created_at: "2025-01-15T00:00:00.000Z" },
    ]

    const { current, previous } = splitDashboardLeadsByPeriod(leads, "this_quarter", now)

    assert.deepEqual(current.map(lead => lead.id), [1, 2])
    assert.deepEqual(previous.map(lead => lead.id), [4, 5])
})

test("splitDashboardLeadsByPeriod returns current month and same month last year", () => {
    const now = new Date("2026-04-13T10:00:00.000Z")
    const leads = [
        { id: 1, created_at: "2026-04-03T00:00:00.000Z" },
        { id: 2, created_at: "2026-04-20T00:00:00.000Z" },
        { id: 3, created_at: "2026-05-01T00:00:00.000Z" },
        { id: 4, created_at: "2025-04-12T00:00:00.000Z" },
    ]

    const { current, previous } = splitDashboardLeadsByPeriod(leads, "this_month", now)

    assert.deepEqual(current.map(lead => lead.id), [1, 2])
    assert.deepEqual(previous.map(lead => lead.id), [4])
})
