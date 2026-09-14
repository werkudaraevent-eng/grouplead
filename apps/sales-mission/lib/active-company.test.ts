import { describe, expect, it } from "vitest"
import { pickActiveMembership, sharedCookieDomain, type CompanyMembership } from "./active-company"

const group: CompanyMembership = { companyId: "g", slug: "werkudara-group", name: "Werkudara Group", isHolding: true, userType: "admin", createdAt: "2026-02-01T00:00:00Z" }
const unit: CompanyMembership = { companyId: "u", slug: "werkudara-event", name: "Werkudara Event", isHolding: false, userType: "staff", createdAt: "2026-01-01T00:00:00Z" }

describe("pickActiveMembership", () => {
  it("follows the cookie when it names a unit the person belongs to", () => {
    expect(pickActiveMembership([group, unit], "werkudara-group")?.companyId).toBe("g")
  })

  it("maps the holding view onto the holding membership", () => {
    expect(pickActiveMembership([unit, group], "holding")?.companyId).toBe("g")
  })

  it("falls back to the oldest membership, whatever order the rows arrive in", () => {
    expect(pickActiveMembership([group, unit], null)?.companyId).toBe("u")
    expect(pickActiveMembership([group, unit], "some-other-unit")?.companyId).toBe("u")
    expect(pickActiveMembership([unit], "holding")?.companyId).toBe("u")
  })

  it("is null with no memberships", () => {
    expect(pickActiveMembership([], "werkudara-group")).toBeNull()
  })
})

describe("sharedCookieDomain", () => {
  it("prefers the configured domain", () => {
    expect(sharedCookieDomain("mission.werkudara.group", ".werkudara.group")).toBe(".werkudara.group")
  })

  it("derives the parent of a subdomain so sibling apps share the cookie", () => {
    expect(sharedCookieDomain("mission.werkudara.group")).toBe(".werkudara.group")
    expect(sharedCookieDomain("crm.werkudara.group:443")).toBe(".werkudara.group")
  })

  it("sets no domain for localhost, IPs, previews on a bare domain", () => {
    expect(sharedCookieDomain("localhost:3000")).toBeUndefined()
    expect(sharedCookieDomain("127.0.0.1")).toBeUndefined()
    expect(sharedCookieDomain("werkudara.group")).toBeUndefined()
  })
})
