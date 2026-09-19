import { describe, expect, it } from "vitest"
import { audioAnswerViolation, audioExtension, formatBytes, formatDuration, isCompanyAudio, isWavFile, parseAudioAnswer } from "./audio-answer"

const company = "11111111-1111-4111-8111-111111111111"
const good = { path: `${company}/mission-abc/22222222-2222-4222-8222-222222222222.m4a`, name: "Rekaman baru 3.m4a", size: 12_000_000, durationMs: 1_845_000 }

describe("parseAudioAnswer", () => {
  it("keeps valid recordings, from an array or its JSON, and drops the rest", () => {
    expect(parseAudioAnswer([good, { path: `${company}/x/evil.exe`, name: "x", size: 1 }, "junk"])).toEqual([good])
    expect(parseAudioAnswer(JSON.stringify([good]))).toEqual([good])
    expect(parseAudioAnswer(null)).toEqual([])
    expect(parseAudioAnswer("not json")).toEqual([])
  })

  it("keeps a recording whose length is unknown", () => {
    const { durationMs: _d, ...noLength } = good
    expect(parseAudioAnswer([noLength])).toEqual([noLength])
  })
})

describe("audioAnswerViolation", () => {
  it("accepts nothing, and a short list of valid recordings", () => {
    expect(audioAnswerViolation(null, "Rekaman")).toBeNull()
    expect(audioAnswerViolation([good], "Rekaman")).toBeNull()
  })

  it("refuses too many, and anything malformed", () => {
    expect(audioAnswerViolation([good, good], "Rekaman", 1)).toContain("maksimal 1")
    expect(audioAnswerViolation([{ ...good, size: 999_999_999 }], "Rekaman")).toContain("tidak dikenal")
    expect(audioAnswerViolation("x", "Rekaman")).toContain("tidak valid")
  })
})

describe("paths and formats", () => {
  it("ties a path to its company folder", () => {
    expect(isCompanyAudio(good.path, company)).toBe(true)
    expect(isCompanyAudio(good.path, "33333333-3333-4333-8333-333333333333")).toBe(false)
  })

  it("names the extension from the type, then the file name, else refuses", () => {
    expect(audioExtension("audio/mp4", "")).toBe("m4a")
    expect(audioExtension("", "Rekaman baru 3.M4A")).toBe("m4a")
    expect(audioExtension("audio/mpeg", "song.mp3")).toBe("mp3")
    expect(audioExtension("application/pdf", "file.pdf")).toBeNull()
  })

  it("refuses WAV as uncompressed, by type or by name", () => {
    expect(audioExtension("audio/wav", "meeting.wav")).toBeNull()
    expect(isWavFile("audio/x-wav", "")).toBe(true)
    expect(isWavFile("", "Rekaman.WAV")).toBe(true)
    expect(isWavFile("audio/mp4", "tes3.m4a")).toBe(false)
  })

  it("formats a length and a size the way a phone does", () => {
    expect(formatDuration(1_845_000)).toBe("30:45")
    expect(formatDuration(3_909_000)).toBe("1:05:09")
    expect(formatDuration(5_000)).toBe("0:05")
    expect(formatBytes(12_000_000)).toBe("11,4 MB")
    expect(formatBytes(20_000)).toBe("20 KB")
  })
})
