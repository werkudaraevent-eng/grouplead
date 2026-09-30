import { describe, expect, it } from "vitest"
import { SIDEBAR_SHORTCUT, isSidebarShortcut, sidebarToggleLabel, type ShortcutKeyEvent, type ShortcutTarget } from "./sidebar-shortcut"

const key = (extra: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  key: "[", ctrlKey: false, metaKey: false, altKey: false, ...extra,
})
const page: ShortcutTarget = { editable: false, inOverlay: false }

describe("isSidebarShortcut", () => {
  it("is the plain [ key", () => {
    expect(SIDEBAR_SHORTCUT).toBe("[")
    expect(isSidebarShortcut(key(), page)).toBe(true)
  })

  it("ignores every other key, { included (Shift+[)", () => {
    expect(isSidebarShortcut(key({ key: "]" }), page)).toBe(false)
    expect(isSidebarShortcut(key({ key: "{" }), page)).toBe(false)
    expect(isSidebarShortcut(key({ key: "\\" }), page)).toBe(false)
  })

  it("leaves Cmd+[ (the browser's Back on a Mac) and other chords alone", () => {
    expect(isSidebarShortcut(key({ metaKey: true }), page)).toBe(false)
    expect(isSidebarShortcut(key({ ctrlKey: true }), page)).toBe(false)
    expect(isSidebarShortcut(key({ altKey: true }), page)).toBe(false)
  })

  it("accepts [ typed with AltGr, which the browser reports as Ctrl+Alt", () => {
    expect(isSidebarShortcut(key({ ctrlKey: true, altKey: true, altGraph: true }), page)).toBe(true)
    expect(isSidebarShortcut(key({ metaKey: true, altGraph: true }), page)).toBe(false)
  })

  it("never fires while typing, composing, or holding the key down", () => {
    expect(isSidebarShortcut(key(), { editable: true, inOverlay: false })).toBe(false)
    expect(isSidebarShortcut(key({ isComposing: true }), page)).toBe(false)
    expect(isSidebarShortcut(key({ repeat: true }), page)).toBe(false)
  })

  it("leaves the key to an open menu or dialog, and to a handler that took it first", () => {
    expect(isSidebarShortcut(key(), { editable: false, inOverlay: true })).toBe(false)
    expect(isSidebarShortcut(key({ defaultPrevented: true }), page)).toBe(false)
  })
})

describe("sidebarToggleLabel", () => {
  it("names what the control will do", () => {
    expect(sidebarToggleLabel(false)).toBe("Ciutkan menu")
    expect(sidebarToggleLabel(true)).toBe("Lebarkan menu")
  })
})
