import { describe, expect, it } from "vitest"
import { announcementStates, pendingAnnouncements, unreadAnnouncements } from "./announcements"

describe("announcements", () => {
  it("a release with no row follows its own default", () => {
    const states = announcementStates([])
    const share = states.find((state) => state.key === "share-whatsapp")!
    const edit = states.find((state) => state.key === "edit-completed")!
    expect(share.enabled).toBe(true)
    expect(edit.enabled).toBe(false)
    expect(share.seenKey).toMatch(/^announce-share-whatsapp-\d+$/)
    expect(share.reannounced).toBe(false)
  })

  it("the admin's row wins, and re-announcing changes the seen key", () => {
    const before = announcementStates([]).find((state) => state.key === "share-whatsapp")!
    const states = announcementStates([
      { key: "share-whatsapp", enabled: true, announced_at: "2026-10-01T02:00:00.000Z" },
      { key: "edit-completed", enabled: true, announced_at: "2026-10-01T02:00:00.000Z" },
    ])
    const share = states.find((state) => state.key === "share-whatsapp")!
    const edit = states.find((state) => state.key === "edit-completed")!
    expect(share.seenKey).not.toBe(before.seenKey)
    expect(share.reannounced).toBe(true)
    expect(edit.enabled).toBe(true)
  })

  it("pending is what is on and not closed, at most three, newest first; unread clears on reading", () => {
    const states = announcementStates([])
    const on = states.filter((state) => state.enabled)
    expect(pendingAnnouncements(states, new Set()).map((state) => state.key)).toEqual(on.slice(0, 3).map((state) => state.key))
    const seen = new Set([on[0].seenKey])
    expect(pendingAnnouncements(states, seen).some((state) => state.key === on[0].key)).toBe(false)
    expect(unreadAnnouncements(states, seen).some((state) => state.key === on[0].key)).toBe(true)
    expect(unreadAnnouncements(states, new Set([on[0].readKey])).some((state) => state.key === on[0].key)).toBe(false)
  })

  it("a switch never changes the seen key; only Umumkan ulang does", () => {
    const before = announcementStates([]).find((state) => state.key === "share-whatsapp")!
    const off = announcementStates([{ key: "share-whatsapp", enabled: false, announced_at: null }]).find((state) => state.key === "share-whatsapp")!
    const backOn = announcementStates([{ key: "share-whatsapp", enabled: true, announced_at: null }]).find((state) => state.key === "share-whatsapp")!
    expect(off.enabled).toBe(false)
    expect(backOn.seenKey).toBe(before.seenKey)
    expect(backOn.readKey).toBe(before.readKey)
    expect(backOn.reannounced).toBe(false)
    // Someone who closed it before the switch moved does not see it again.
    expect(pendingAnnouncements([backOn], new Set([before.seenKey]))).toEqual([])
  })
})
