import { describe, expect, it } from "vitest"
import { SETTINGS_GROUPS, activeSettingsItem, settingsBackHref, visibleSettingsGroups } from "./settings-nav"

describe("visibleSettingsGroups", () => {
  it("shows a rep only Akun, with Profil then Perangkat aktif", () => {
    const groups = visibleSettingsGroups(false)
    expect(groups.map((group) => group.label)).toEqual(["Akun"])
    expect(groups[0].items.map((item) => item.title)).toEqual(["Profil", "Perangkat aktif"])
  })

  it("shows an admin Akun first, then the groups the Pengaturan page has always had", () => {
    expect(visibleSettingsGroups(true).map((group) => group.label)).toEqual(["Akun", "Form", "Alur kerja", "Komunikasi", "Pemantauan", "Sistem"])
  })

  it("lists every page once", () => {
    const hrefs = SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => item.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const href of hrefs) expect(href.startsWith("/workspace/settings/")).toBe(true)
  })
})

describe("activeSettingsItem", () => {
  it("is the item itself on its page", () => {
    expect(activeSettingsItem("/workspace/settings/devices")?.title).toBe("Perangkat aktif")
    expect(activeSettingsItem("/workspace/settings/profile")?.title).toBe("Profil")
    expect(activeSettingsItem("/workspace/settings/usage")?.title).toBe("Pemakaian")
  })

  it("is the item a page sits below", () => {
    expect(activeSettingsItem("/workspace/settings/ai/pemakaian")?.title).toBe("AI")
  })

  it("does not confuse a prefix of a name with a parent", () => {
    // "form" is a prefix of "form-x" as text but not as a path.
    expect(activeSettingsItem("/workspace/settings/formulir")).toBeNull()
    expect(activeSettingsItem("/workspace/settings/prospect-form")?.title).toBe("Form prospek")
  })

  it("is nothing on the Pengaturan page and outside it", () => {
    expect(activeSettingsItem("/workspace/settings")).toBeNull()
    expect(activeSettingsItem("/workspace/activities")).toBeNull()
  })
})

describe("settingsBackHref", () => {
  it("goes from an item to the Pengaturan list", () => {
    expect(settingsBackHref("/workspace/settings/profile")).toBe("/workspace/settings")
    expect(settingsBackHref("/workspace/settings/recycle-bin")).toBe("/workspace/settings")
  })

  it("goes from a page below an item to that item", () => {
    expect(settingsBackHref("/workspace/settings/ai/pemakaian")).toBe("/workspace/settings/ai")
  })

  it("has none on the list itself or outside Pengaturan", () => {
    expect(settingsBackHref("/workspace/settings")).toBeNull()
    expect(settingsBackHref("/workspace/panduan")).toBeNull()
  })
})
