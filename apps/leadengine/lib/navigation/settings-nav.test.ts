import { describe, expect, it } from "vitest"
import type { Can } from "./app-nav"
import {
    SETTINGS_GROUPS,
    activeSettingsItem,
    isAccountPath,
    isOpenSettingsPath,
    visibleSettingsGroups,
} from "./settings-nav"

const everything: Can = () => true
const nothing: Can = () => false
/** Settings read and nothing else: the Settings page opens, no row's own grant does. */
const settingsReadOnly: Can = (module, action) => module === "settings" && action === "read"

describe("visibleSettingsGroups", () => {
    it("shows someone without the Settings grant only Account, Profile then Active devices", () => {
        const groups = visibleSettingsGroups(nothing)
        expect(groups.map((group) => group.label)).toEqual(["Account"])
        expect(groups[0].items.map((item) => item.title)).toEqual(["Profile", "Active devices"])
    })

    it("shows an admin Account first, then the Settings page's groups", () => {
        expect(visibleSettingsGroups(everything).map((group) => group.label)).toEqual([
            "Account",
            "Configuration",
            "Workspace",
            "Communication",
            "Monitoring",
            "Administration",
        ])
    })

    it("filters each row by its own grant and drops a group left empty", () => {
        const groups = visibleSettingsGroups(settingsReadOnly)
        expect(groups.map((group) => group.label)).toEqual(["Account", "Monitoring"])
        expect(groups[1].items.map((item) => item.title)).toEqual(["Change history", "Usage"])
    })

    it("never lets a row's own grant open a group without the Settings grant", () => {
        const companiesOnly: Can = (module) => module === "companies"
        expect(visibleSettingsGroups(companiesOnly).map((group) => group.label)).toEqual(["Account"])
    })

    it("lists every page once", () => {
        const hrefs = SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => item.href))
        expect(new Set(hrefs).size).toBe(hrefs.length)
    })
})

describe("activeSettingsItem", () => {
    it("is the row itself, or the row a page sits below", () => {
        expect(activeSettingsItem("/settings/devices")?.title).toBe("Active devices")
        expect(activeSettingsItem("/settings/ai/usage")?.title).toBe("AI")
        expect(activeSettingsItem("/settings/pipeline/3f1c")?.title).toBe("Pipeline & stages")
        expect(activeSettingsItem("/settings/companies/new")?.title).toBe("Companies")
        expect(activeSettingsItem("/settings/goals/q3-revenue")?.title).toBe("Goals")
    })

    it("counts the pages a row lists as its own", () => {
        expect(activeSettingsItem("/settings/segments")?.title).toBe("Lead attributes & segments")
        expect(activeSettingsItem("/settings/registry")?.title).toBe("Lead attributes & segments")
    })

    it("is nothing on the Settings page, outside Settings, and on a look-alike address", () => {
        expect(activeSettingsItem("/settings")).toBeNull()
        expect(activeSettingsItem("/contacts")).toBeNull()
        expect(activeSettingsItem("/settings/users-archive")).toBeNull()
    })
})

describe("isOpenSettingsPath", () => {
    it("lets the Settings page and Account's pages through without the grant", () => {
        expect(isOpenSettingsPath("/settings")).toBe(true)
        expect(isOpenSettingsPath("/settings/profile")).toBe(true)
        expect(isOpenSettingsPath("/settings/devices")).toBe(true)
    })

    it("keeps every other settings page behind it", () => {
        expect(isOpenSettingsPath("/settings/users")).toBe(false)
        expect(isOpenSettingsPath("/settings/profile-export")).toBe(false)
        expect(isOpenSettingsPath("/settings/ai/usage")).toBe(false)
    })
})

describe("isAccountPath", () => {
    it("is Account's pages only", () => {
        expect(isAccountPath("/settings/profile")).toBe(true)
        expect(isAccountPath("/settings/devices")).toBe(true)
        expect(isAccountPath("/settings")).toBe(false)
        expect(isAccountPath("/settings/users")).toBe(false)
    })
})
