import { describe, expect, it } from "vitest"
import { CHANGELOG, type ChangelogEntry } from "@/features/changelog/changelog-data"
import { HINT_KEY } from "@/lib/hints/hint-key"
import {
  MAX_ANNOUNCED,
  announcementKeys,
  announcementStates,
  pendingAnnouncements,
  releaseInstant,
} from "./announcements"

const entry = (date: string, key: string | null, defaultOn?: boolean): ChangelogEntry => ({
  date,
  title: `Release ${key ?? date}`,
  items: [{ type: "feature", text: "Something." }],
  ...(key ? { announcement: { key, title: key, body: "One sentence.", defaultOn } } : {}),
})

// Newest first, as the changelog is written.
const ENTRIES: ChangelogEntry[] = [
  entry("2026-09-22", "delta"),
  entry("2026-09-21", null),
  entry("2026-09-20", "gamma", false),
  entry("2026-09-19", "beta"),
  entry("2026-09-18", "alpha"),
  entry("2026-09-17", "zero"),
]

describe("announcementStates", () => {
  it("lists only announceable releases, newest first", () => {
    expect(announcementStates([], ENTRIES).map((state) => state.key)).toEqual(["delta", "gamma", "beta", "alpha", "zero"])
  })

  it("a release with no row follows its own default, stamped on its release date", () => {
    const states = announcementStates([], ENTRIES)
    const delta = states.find((state) => state.key === "delta")!
    const gamma = states.find((state) => state.key === "gamma")!
    expect(delta.enabled).toBe(true)
    expect(gamma.enabled).toBe(false)
    expect(delta.configured).toBe(false)
    expect(delta.reannounced).toBe(false)
    expect(delta.announcedAt).toBe(releaseInstant("2026-09-22"))
    expect(delta.seenKey).toBe(`announce-delta-${Date.parse("2026-09-22T00:00:00+07:00") / 1000}`)
  })

  it("the admin's switch wins, and switching alone keeps the seen key", () => {
    const before = announcementStates([], ENTRIES).find((state) => state.key === "delta")!
    const states = announcementStates(
      [
        { key: "delta", enabled: false, announced_at: null },
        { key: "gamma", enabled: true, announced_at: null },
      ],
      ENTRIES,
    )
    const delta = states.find((state) => state.key === "delta")!
    const gamma = states.find((state) => state.key === "gamma")!
    expect(delta.enabled).toBe(false)
    expect(delta.configured).toBe(true)
    // Off and back on again must not repeat it for people who closed it.
    expect(delta.seenKey).toBe(before.seenKey)
    expect(gamma.enabled).toBe(true)
  })

  it("announcing again changes the seen key", () => {
    const before = announcementStates([], ENTRIES).find((state) => state.key === "beta")!
    const beta = announcementStates([{ key: "beta", enabled: true, announced_at: "2026-10-01T02:00:00.000Z" }], ENTRIES).find(
      (state) => state.key === "beta",
    )!
    expect(beta.reannounced).toBe(true)
    expect(beta.announcedAt).toBe("2026-10-01T02:00:00.000Z")
    expect(beta.seenKey).toBe("announce-beta-1790820000")
    expect(beta.seenKey).not.toBe(before.seenKey)
  })

  it("an unreadable stamp falls back to the release date instead of NaN", () => {
    const alpha = announcementStates([{ key: "alpha", enabled: true, announced_at: "not a date" }], ENTRIES).find(
      (state) => state.key === "alpha",
    )!
    expect(alpha.reannounced).toBe(false)
    expect(alpha.seenKey).toMatch(/^announce-alpha-\d+$/)
  })

  it("ignores rows for releases the code no longer announces", () => {
    const states = announcementStates([{ key: "gone", enabled: true, announced_at: null }], ENTRIES)
    expect(states.some((state) => state.key === "gone")).toBe(false)
  })
})

describe("pendingAnnouncements", () => {
  it("is what is on and not yet closed, at most three, newest first", () => {
    const states = announcementStates([], ENTRIES)
    expect(MAX_ANNOUNCED).toBe(3)
    // gamma is off by default, so the three newest that are on.
    expect(pendingAnnouncements(states, new Set()).map((state) => state.key)).toEqual(["delta", "beta", "alpha"])
    const seen = new Set([states[0].seenKey])
    expect(pendingAnnouncements(states, seen).map((state) => state.key)).toEqual(["beta", "alpha", "zero"])
  })

  it("shows a closed announcement again once it is announced again", () => {
    const states = announcementStates([], ENTRIES)
    const seen = new Set(states.map((state) => state.seenKey))
    expect(pendingAnnouncements(states, seen)).toEqual([])
    const again = announcementStates([{ key: "alpha", enabled: true, announced_at: "2026-10-01T02:00:00.000Z" }], ENTRIES)
    expect(pendingAnnouncements(again, seen).map((state) => state.key)).toEqual(["alpha"])
  })

  it("shows nothing that is switched off", () => {
    const states = announcementStates(
      ENTRIES.flatMap((e) => (e.announcement ? [{ key: e.announcement.key, enabled: false, announced_at: null }] : [])),
      ENTRIES,
    )
    expect(pendingAnnouncements(states, new Set())).toEqual([])
  })
})

describe("the real changelog", () => {
  const states = announcementStates([])

  it("has unique announcement keys", () => {
    const keys = states.map((state) => state.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(announcementKeys()).toEqual(new Set(keys))
  })

  it("writes seen marks the database accepts", () => {
    for (const state of states) {
      expect(state.key).toMatch(HINT_KEY)
      expect(state.seenKey).toMatch(HINT_KEY)
    }
    // A re-announcement far in the future still fits the 60-character slug.
    for (const state of announcementStates(states.map((s) => ({ key: s.key, enabled: true, announced_at: "2286-11-20T17:46:39Z" })))) {
      expect(state.seenKey).toMatch(HINT_KEY)
    }
  })

  it("dates every announceable release", () => {
    for (const e of CHANGELOG) {
      if (!e.announcement) continue
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isFinite(Date.parse(releaseInstant(e.date)))).toBe(true)
    }
  })
})
