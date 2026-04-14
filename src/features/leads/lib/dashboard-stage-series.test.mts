import test from "node:test"
import assert from "node:assert/strict"

import { buildDashboardStageSeries } from "./dashboard-stage-series.ts"

test("buildDashboardStageSeries follows pipeline stage order, keeps empty stages, and computes shares", () => {
    const stages = [
        { id: "s1", name: "Incoming Lead", color: "#111111", sort_order: 0 },
        { id: "s2", name: "Proposal / Quotation Sent", color: "#222222", sort_order: 1 },
        { id: "s3", name: "Closed Won", color: "#333333", sort_order: 2 },
    ]

    const leads = [
        { pipeline_stage_id: "s2", pipeline_stage: { name: "Proposal / Quotation Sent", color: "#222222" } },
        { pipeline_stage_id: "s2", pipeline_stage: { name: "Proposal / Quotation Sent", color: "#222222" } },
        { pipeline_stage_id: "s3", pipeline_stage: { name: "Closed Won", color: "#333333" } },
    ]

    const previousLeads = [
        { pipeline_stage_id: "s2", pipeline_stage: { name: "Proposal / Quotation Sent", color: "#222222" } },
        { pipeline_stage_id: "s1", pipeline_stage: { name: "Incoming Lead", color: "#111111" } },
    ]

    assert.deepEqual(buildDashboardStageSeries(stages, leads, previousLeads), [
        { id: "s1", name: "Incoming Lead", color: "#111111", count: 0, previousCount: 1, share: 0, previousShare: 50, shareDelta: -50, sortOrder: 0 },
        { id: "s2", name: "Proposal / Quotation Sent", color: "#222222", count: 2, previousCount: 1, share: 66.66666666666666, previousShare: 50, shareDelta: 16.666666666666657, sortOrder: 1 },
        { id: "s3", name: "Closed Won", color: "#333333", count: 1, previousCount: 0, share: 33.33333333333333, previousShare: 0, shareDelta: 33.33333333333333, sortOrder: 2 },
    ])
})

test("buildDashboardStageSeries falls back to observed stages when pipeline stages are unavailable", () => {
    const leads = [
        { pipeline_stage_id: "a", pipeline_stage: { name: "Closed Turndown", color: "#abcdef" } },
        { pipeline_stage_id: "a", pipeline_stage: { name: "Closed Turndown", color: "#abcdef" } },
        { pipeline_stage_id: "b", pipeline_stage: { name: "Closed Postponed", color: "#fedcba" } },
    ]

    assert.deepEqual(buildDashboardStageSeries([], leads), [
        { id: "a", name: "Closed Turndown", color: "#abcdef", count: 2, previousCount: 0, share: 66.66666666666666, previousShare: 0, shareDelta: 66.66666666666666, sortOrder: 0 },
        { id: "b", name: "Closed Postponed", color: "#fedcba", count: 1, previousCount: 0, share: 33.33333333333333, previousShare: 0, shareDelta: 33.33333333333333, sortOrder: 1 },
    ])
})
