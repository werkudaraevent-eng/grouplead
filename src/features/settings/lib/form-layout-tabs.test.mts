import test from "node:test"
import assert from "node:assert/strict"

import {
    buildLayoutStateSnapshot,
    createTabId,
    getFirstVisibleTabId,
    getVisibleTabEntries,
} from "./form-layout-tabs.ts"

test("buildLayoutStateSnapshot keeps tab settings in persisted state", () => {
    const items = {
        project: ["native:project_name"],
        notes: [],
        hidden: [],
    }
    const requiredOverrides = ["native:project_name"]
    const visibilityRules = {
        "native:project_name": {
            logic: "and" as const,
            conditions: [],
        },
    }
    const tabSettings = {
        project: { label: "Project", isHidden: false, sortOrder: 0 },
        notes: { label: "Notes", isHidden: false, sortOrder: 1 },
    }

    const snapshot = buildLayoutStateSnapshot(items, requiredOverrides, visibilityRules, tabSettings)

    assert.equal(
        snapshot,
        JSON.stringify({
            tabs: items,
            req: requiredOverrides,
            vis: visibilityRules,
            tabSettings,
        })
    )
})

test("createTabId normalizes tab labels into stable keys", () => {
    assert.equal(createTabId("  Follow Up Notes  "), "follow_up_notes")
    assert.equal(createTabId("###"), "")
})

test("getVisibleTabEntries keeps empty tabs that are still visible", () => {
    const items = {
        project: ["native:project_name"],
        notes: [],
        hidden: ["native:lost_reason"],
    }
    const tabSettings = {
        project: { label: "Project", isHidden: false, sortOrder: 1 },
        notes: { label: "Notes", isHidden: false, sortOrder: 0 },
    }

    const visibleTabs = getVisibleTabEntries(items, tabSettings)

    assert.deepEqual(visibleTabs, [
        ["notes", []],
        ["project", ["native:project_name"]],
    ])
    assert.equal(getFirstVisibleTabId(items, tabSettings), "notes")
})
