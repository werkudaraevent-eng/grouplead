import { describe, expect, it } from "vitest"
import {
  CONVERSATION_RETENTION_DAYS,
  CONVERSATION_TITLE_MAX,
  CONVERSATION_TURNS_KEPT,
  appendTurn,
  conversationDateLabel,
  conversationTitle,
  conversationTurnCountLabel,
  historyTurns,
  isFromToday,
  parseTurns,
  retentionCutoff,
  type AskTurn,
} from "./ask-conversations"

const turn = (n: number, askedAt = "2026-09-22T03:00:00Z"): AskTurn => ({ question: `Pertanyaan ${n}`, answer: `Jawaban ${n}`, askedAt })

describe("conversationTitle", () => {
  it("is the first question on one line", () => {
    expect(conversationTitle("  Siapa   yang belum\nada laporan?  ")).toBe("Siapa yang belum ada laporan?")
  })
  it("is cut where a list row stops reading", () => {
    const title = conversationTitle("Sales mana yang paling banyak laporan pada minggu ini dan berapa nilai peluang yang mereka bawa dari kunjungan itu?")
    expect(title.length).toBeLessThanOrEqual(CONVERSATION_TITLE_MAX)
    expect(title.length).toBeGreaterThan(CONVERSATION_TITLE_MAX - 3)
    expect(title.endsWith("…")).toBe(true)
  })
  it("never ends up empty", () => {
    expect(conversationTitle("   ")).toBe("Percakapan")
  })
})

describe("parseTurns", () => {
  it("keeps the exchanges and drops anything that is not one", () => {
    const parsed = parseTurns([
      { question: "Berapa laporan hari ini?", answer: "12 laporan.", askedAt: "2026-09-22T03:00:00Z" },
      { question: "Tanpa jawaban" },
      "bukan objek",
      null,
      { question: "Kapan?", answer: "Besok.", askedAt: "bukan tanggal" },
    ])
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({ question: "Berapa laporan hari ini?", answer: "12 laporan.", askedAt: "2026-09-22T03:00:00Z" })
    // A turn with an unreadable instant still reads; only its date is lost.
    expect(parsed[1].question).toBe("Kapan?")
    expect(Number.isNaN(Date.parse(parsed[1].askedAt))).toBe(false)
  })
  it("treats anything that is not a list as no turns", () => {
    expect(parseTurns(null)).toEqual([])
    expect(parseTurns({ turns: [] })).toEqual([])
  })
})

describe("appendTurn", () => {
  it("adds the newest at the end", () => {
    const next = appendTurn([turn(1)], turn(2))
    expect(next.map((entry) => entry.question)).toEqual(["Pertanyaan 1", "Pertanyaan 2"])
  })
  it("keeps a long sitting one row by dropping the oldest turns", () => {
    let turns: AskTurn[] = []
    for (let n = 1; n <= CONVERSATION_TURNS_KEPT + 3; n += 1) turns = appendTurn(turns, turn(n))
    expect(turns).toHaveLength(CONVERSATION_TURNS_KEPT)
    expect(turns[0].question).toBe("Pertanyaan 4")
    expect(turns[turns.length - 1].question).toBe(`Pertanyaan ${CONVERSATION_TURNS_KEPT + 3}`)
  })
})

describe("historyTurns", () => {
  it("gives the model the last three exchanges, oldest first", () => {
    const turns = [turn(1), turn(2), turn(3), turn(4)]
    expect(historyTurns(turns)).toEqual([
      { question: "Pertanyaan 2", answer: "Jawaban 2" },
      { question: "Pertanyaan 3", answer: "Jawaban 3" },
      { question: "Pertanyaan 4", answer: "Jawaban 4" },
    ])
  })
})

describe("retention", () => {
  it("cuts at ninety days before now", () => {
    const now = new Date("2026-09-22T03:00:00Z")
    const cutoff = new Date(retentionCutoff(now))
    expect((now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000)).toBe(CONVERSATION_RETENTION_DAYS)
  })
})

describe("conversation dates", () => {
  // 2026-09-22T03:00 UTC is 10:00 WIB on the 22nd.
  const now = new Date("2026-09-22T03:00:00Z")
  it("knows which thread belongs to today in WIB", () => {
    expect(isFromToday("2026-09-21T23:30:00Z", now)).toBe(true) // 06:30 WIB, same day
    expect(isFromToday("2026-09-21T16:00:00Z", now)).toBe(false) // 23:00 WIB the day before
    expect(isFromToday("bukan tanggal", now)).toBe(false)
  })
  it("says today with the clock, yesterday by name, and the date before that", () => {
    expect(conversationDateLabel("2026-09-22T02:05:00Z", now)).toBe("Hari ini 09.05")
    expect(conversationDateLabel("2026-09-21T02:05:00Z", now)).toBe("Kemarin")
    expect(conversationDateLabel("2026-09-18T02:05:00Z", now)).toBe("18 Sep")
    expect(conversationDateLabel("2025-12-30T02:05:00Z", now)).toContain("2025")
    expect(conversationDateLabel("bukan tanggal", now)).toBe("")
  })
  it("counts what a row holds", () => {
    expect(conversationTurnCountLabel(3)).toBe("3 pertanyaan")
  })
})
