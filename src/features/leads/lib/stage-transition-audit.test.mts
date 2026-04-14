import test from "node:test"
import assert from "node:assert/strict"

import { buildStageTransitionAuditEntries } from "./stage-transition-audit.ts"

test("buildStageTransitionAuditEntries creates both stage history and timeline activity", () => {
    const result = buildStageTransitionAuditEntries({
        leadId: 935,
        newStageId: "stage-closed-turndown",
        newStageName: "Closed Turndown",
        previousStageName: "Qualified",
        userId: "user-1",
        userName: "Hanung Sastria",
        amount: 1461384375,
    })

    assert.deepEqual(result.stageHistoryEntry, {
        lead_id: 935,
        stage_id: "stage-closed-turndown",
        stage_name: "Closed Turndown",
        user_id: "user-1",
        user_name: "Hanung Sastria",
        amount: 1461384375,
    })

    assert.deepEqual(result.activityEntry, {
        lead_id: 935,
        user_id: "user-1",
        action_type: "Stage Change",
        description: 'Hanung Sastria moved lead from "Qualified" to "Closed Turndown"',
    })
})

test("buildStageTransitionAuditEntries falls back gracefully when previous stage is unknown", () => {
    const result = buildStageTransitionAuditEntries({
        leadId: 935,
        newStageId: "stage-closed-lost",
        newStageName: "Closed Lost",
        previousStageName: null,
        userId: null,
        userName: "System",
        amount: null,
    })

    assert.equal(result.activityEntry.description, 'System moved lead to "Closed Lost"')
})
