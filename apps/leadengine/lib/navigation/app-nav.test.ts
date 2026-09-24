import { describe, expect, it } from "vitest"
import {
    DESTINATIONS,
    canOpenSettings,
    fallbackTitle,
    isActiveHref,
    isMoreActive,
    permittedDestinations,
    roleLabel,
    type Can,
} from "./app-nav"

/** A `can` that grants read on exactly these modules. */
function readOn(...modules: string[]): Can {
    return (module, action) => action === "read" && modules.includes(module)
}

describe("permittedDestinations", () => {
    it("keeps the drawer's order and gates each destination by its module's read grant", () => {
        expect(permittedDestinations(readOn("dashboard", "leads", "companies", "contacts")).map((d) => d.label)).toEqual([
            "Dashboard",
            "Pipeline",
            "Companies",
            "Contacts",
        ])
        // Pipeline is the leads module; Companies is companies, not client_companies.
        expect(permittedDestinations(readOn("contacts", "leads")).map((d) => d.label)).toEqual(["Pipeline", "Contacts"])
    })

    it("shows nothing to a person with no grant", () => {
        expect(permittedDestinations(readOn())).toEqual([])
    })

    it("asks for read, never a write", () => {
        const asked: string[] = []
        permittedDestinations((module, action) => {
            asked.push(`${module}:${action}`)
            return true
        })
        expect(asked).toEqual(DESTINATIONS.map((d) => `${d.module}:read`))
    })
})

describe("canOpenSettings", () => {
    it("follows the Settings read grant", () => {
        expect(canOpenSettings(readOn("settings"))).toBe(true)
        expect(canOpenSettings(readOn("dashboard"))).toBe(false)
    })
})

describe("isActiveHref", () => {
    it("marks the dashboard only at the root", () => {
        expect(isActiveHref("/", "/")).toBe(true)
        expect(isActiveHref("/contacts", "/")).toBe(false)
    })

    it("marks a destination on its records and subpages, not on a longer name", () => {
        expect(isActiveHref("/leads", "/leads")).toBe(true)
        expect(isActiveHref("/leads/42", "/leads")).toBe(true)
        expect(isActiveHref("/leadsboard", "/leads")).toBe(false)
    })
})

describe("isMoreActive", () => {
    const all = permittedDestinations(readOn("dashboard", "leads", "companies", "contacts"))

    it("is current on pages the bar does not carry", () => {
        expect(isMoreActive("/settings/users", all)).toBe(true)
        expect(isMoreActive("/changelog", all)).toBe(true)
    })

    it("is not current on a destination or a record under one", () => {
        expect(isMoreActive("/", all)).toBe(false)
        expect(isMoreActive("/companies/7", all)).toBe(false)
    })

    it("is current on a destination the person cannot see in the bar", () => {
        expect(isMoreActive("/contacts", permittedDestinations(readOn("dashboard")))).toBe(true)
    })
})

describe("fallbackTitle", () => {
    it("names the destination the address is in", () => {
        expect(fallbackTitle("/")).toBe("Dashboard")
        expect(fallbackTitle("/leads/12")).toBe("Pipeline")
        expect(fallbackTitle("/contacts")).toBe("Contacts")
    })

    it("names the pages the More sheet opens", () => {
        expect(fallbackTitle("/settings")).toBe("Settings")
        expect(fallbackTitle("/settings/ai")).toBe("Settings")
        expect(fallbackTitle("/changelog")).toBe("Changelog")
    })

    it("falls back to the product's name", () => {
        expect(fallbackTitle("/somewhere")).toBe("LeadEngine")
    })
})

describe("roleLabel", () => {
    it("names the known roles and passes others through", () => {
        expect(roleLabel("bu_manager")).toBe("BU Manager")
        expect(roleLabel("custom_role")).toBe("custom_role")
        expect(roleLabel(null)).toBe("User")
    })
})
