import { describe, expect, it } from "vitest"
import { isUsagePath, normalizeUsagePath, usagePageLabel, USAGE_PATH_MAX } from "./usage-path"

describe("normalizeUsagePath", () => {
  it("replaces a record's uuid with :id", () => {
    expect(normalizeUsagePath("/contacts/8f3c2a10-4b5e-4c6d-9e7f-0a1b2c3d4e5f")).toBe("/contacts/:id")
    expect(normalizeUsagePath("/settings/pipeline/8F3C2A10-4B5E-4C6D-9E7F-0A1B2C3D4E5F")).toBe("/settings/pipeline/:id")
  })

  it("replaces numeric and opaque token segments", () => {
    expect(normalizeUsagePath("/leads/4812")).toBe("/leads/:id")
    expect(normalizeUsagePath("/leads/4812/print")).toBe("/leads/:id/print")
    expect(normalizeUsagePath("/somewhere/aB3dE5fG7hJ9kL1mN")).toBe("/somewhere/:id")
  })

  it("replaces a record's slug where the route opens a record by slug", () => {
    expect(normalizeUsagePath("/settings/companies/werkudara-event")).toBe("/settings/companies/:id")
    expect(normalizeUsagePath("/settings/companies/werkudara-event/members")).toBe("/settings/companies/:id/members")
    expect(normalizeUsagePath("/settings/goals/q3-revenue-target")).toBe("/settings/goals/:id")
    expect(normalizeUsagePath("/companies/pt-arunika")).toBe("/companies/:id")
  })

  it("keeps route words that share a record's slot", () => {
    expect(normalizeUsagePath("/settings/companies/new")).toBe("/settings/companies/new")
    expect(normalizeUsagePath("/settings/companies")).toBe("/settings/companies")
  })

  it("keeps route words, even long ones", () => {
    expect(normalizeUsagePath("/settings/master-options")).toBe("/settings/master-options")
    expect(normalizeUsagePath("/settings/recycle-bin")).toBe("/settings/recycle-bin")
    expect(normalizeUsagePath("/settings/ai/usage")).toBe("/settings/ai/usage")
  })

  it("drops the query string and the fragment", () => {
    expect(normalizeUsagePath("/leads/4812?tab=notes")).toBe("/leads/:id")
    expect(normalizeUsagePath("/changelog#2026-09-23")).toBe("/changelog")
    expect(normalizeUsagePath("/leads?q=Arunika&stage=won")).toBe("/leads")
    expect(normalizeUsagePath("/settings/usage?period=90")).toBe("/settings/usage")
  })

  it("keeps the root, and drops trailing and doubled slashes", () => {
    expect(normalizeUsagePath("/")).toBe("/")
    expect(normalizeUsagePath("/?pipeline=abc")).toBe("/")
    expect(normalizeUsagePath("/contacts/")).toBe("/contacts")
    expect(normalizeUsagePath("//settings//users/")).toBe("/settings/users")
  })

  it("is idempotent, so the server can run it again", () => {
    for (const raw of ["/leads/4812/print?x=1", "/settings/companies/werkudara-event/members", "/settings/companies/new", `/${"halaman/".repeat(40)}`]) {
      const once = normalizeUsagePath(raw)
      expect(normalizeUsagePath(once)).toBe(once)
    }
  })

  it("never grows past the column's limit, and drops whole segments to fit", () => {
    const long = `/${"halaman/".repeat(40)}`
    const normalized = normalizeUsagePath(long)
    expect(normalized.length).toBeLessThanOrEqual(USAGE_PATH_MAX)
    expect(normalized.split("/").slice(1).every((segment) => segment === "halaman")).toBe(true)
  })
})

describe("isUsagePath", () => {
  it("accepts the app's pages", () => {
    expect(isUsagePath("/")).toBe(true)
    expect(isUsagePath("/leads/:id")).toBe(true)
    expect(isUsagePath("/settings/usage")).toBe(true)
  })
  it("refuses the API, the login screen, anything unrooted and anything too long", () => {
    expect(isUsagePath("/api/v1/contacts")).toBe(false)
    expect(isUsagePath("/login")).toBe(false)
    expect(isUsagePath("leads")).toBe(false)
    expect(isUsagePath("https://example.com/leads")).toBe(false)
    expect(isUsagePath(`/${"a".repeat(USAGE_PATH_MAX)}`)).toBe(false)
  })
})

describe("usagePageLabel", () => {
  it("names the main places as the navigation does", () => {
    expect(usagePageLabel("/")).toBe("Dashboard")
    expect(usagePageLabel("/leads")).toBe("Pipeline")
    expect(usagePageLabel("/companies")).toBe("Companies")
    expect(usagePageLabel("/contacts")).toBe("Contacts")
    expect(usagePageLabel("/history")).toBe("History")
    expect(usagePageLabel("/goals")).toBe("Goals")
    expect(usagePageLabel("/changelog")).toBe("Changelog")
  })

  it("names a record's pages by what they are", () => {
    expect(usagePageLabel("/leads/:id")).toBe("Lead details")
    expect(usagePageLabel("/leads/:id/print")).toBe("Lead details · Print")
    expect(usagePageLabel("/companies/:id")).toBe("Company details")
    expect(usagePageLabel("/contacts/:id")).toBe("Contact details")
  })

  it("names Settings' pages as their rows do", () => {
    expect(usagePageLabel("/settings")).toBe("Settings")
    expect(usagePageLabel("/settings/users")).toBe("Settings · Users")
    expect(usagePageLabel("/settings/master-options")).toBe("Settings · Lead attributes & segments")
    expect(usagePageLabel("/settings/ai/usage")).toBe("Settings · AI usage")
    expect(usagePageLabel("/settings/usage")).toBe("Settings · Usage")
    expect(usagePageLabel("/settings/companies/:id/members")).toBe("Settings · Company members")
    expect(usagePageLabel("/settings/profile")).toBe("Settings · My profile")
  })

  it("shows a page it does not know as its path", () => {
    expect(usagePageLabel("/new-page")).toBe("/new-page")
    expect(usagePageLabel("/settings/unknown")).toBe("/settings/unknown")
  })
})
