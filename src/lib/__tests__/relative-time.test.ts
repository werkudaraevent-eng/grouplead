import { describe, it, expect } from "vitest"
import { formatRelativeTime, latestTimestamp } from "../relative-time"

describe("formatRelativeTime", () => {
    const now = new Date("2026-06-12T12:00:00Z")

    it("returns null for missing/invalid input", () => {
        expect(formatRelativeTime(null, now)).toBeNull()
        expect(formatRelativeTime(undefined, now)).toBeNull()
        expect(formatRelativeTime("not-a-date", now)).toBeNull()
    })

    it("treats very recent / future-skew as fresh", () => {
        expect(formatRelativeTime("2026-06-12T11:59:30Z", now)).toBe("just now")
        expect(formatRelativeTime("2026-06-12T12:00:10Z", now)).toBe("just now")
    })

    it("formats minutes", () => {
        expect(formatRelativeTime("2026-06-12T11:58:50Z", now)).toBe("a minute ago")
        expect(formatRelativeTime("2026-06-12T11:58:00Z", now)).toBe("2 minutes ago")
        expect(formatRelativeTime("2026-06-12T11:45:00Z", now)).toBe("15 minutes ago")
    })

    it("formats hours", () => {
        expect(formatRelativeTime("2026-06-12T11:00:00Z", now)).toBe("an hour ago")
        expect(formatRelativeTime("2026-06-12T07:00:00Z", now)).toBe("5 hours ago")
    })

    it("formats days", () => {
        expect(formatRelativeTime("2026-06-11T11:00:00Z", now)).toBe("yesterday")
        expect(formatRelativeTime("2026-06-08T12:00:00Z", now)).toBe("4 days ago")
    })

    it("falls back to an absolute date past ~30 days", () => {
        // 12 May 2026 is > 30 days before 12 Jun 2026.
        expect(formatRelativeTime("2026-05-12T12:00:00Z", now)).toBe("12 May 2026")
    })
})

describe("latestTimestamp", () => {
    it("returns null for an empty list", () => {
        expect(latestTimestamp([])).toBeNull()
    })

    it("picks the most recent updated_at", () => {
        const records = [
            { updated_at: "2026-06-01T00:00:00Z" },
            { updated_at: "2026-06-10T00:00:00Z" },
            { updated_at: "2026-06-05T00:00:00Z" },
        ]
        expect(latestTimestamp(records)).toBe("2026-06-10T00:00:00Z")
    })

    it("falls back to created_at when updated_at is missing", () => {
        const records = [
            { updated_at: null, created_at: "2026-06-09T00:00:00Z" },
            { updated_at: undefined, created_at: "2026-06-02T00:00:00Z" },
        ]
        expect(latestTimestamp(records)).toBe("2026-06-09T00:00:00Z")
    })

    it("ignores unparseable timestamps", () => {
        const records = [
            { updated_at: "garbage" },
            { updated_at: "2026-06-07T00:00:00Z" },
        ]
        expect(latestTimestamp(records)).toBe("2026-06-07T00:00:00Z")
    })
})
