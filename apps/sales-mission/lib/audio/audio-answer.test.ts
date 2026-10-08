import { describe, expect, it } from "vitest"
import { audioActivityId, audioAnswerViolation, audioDownloadName, audioExtension, findRecording, formatBytes, formatDuration, isCompanyAudio, isWavFile, parseAudioAnswer } from "./audio-answer"

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
  it("downloads a recording under its own name, with its real extension", () => {
    expect(audioDownloadName(good)).toBe("Rekaman baru 3.m4a")
    expect(audioDownloadName({ path: good.path, name: "Rapat Pak Nofri" })).toBe("Rapat Pak Nofri.m4a")
    expect(audioDownloadName({ path: good.path, name: "rapat 1/10: final?" })).toBe("rapat 1 10 final.m4a")
    expect(audioDownloadName({ path: good.path, name: "a\r\nb" })).toBe("a b.m4a")
    expect(audioDownloadName({ path: good.path, name: "" })).toBe("rekaman.m4a")
    expect(audioDownloadName({ path: good.path, name: "   " })).toBe("rekaman.m4a")
  })

  it("never lets a name cut the signed URL short, so the real extension always reaches storage", () => {
    // storage-js appends the name through encodeURI, which leaves # & = + ; raw.
    expect(audioDownloadName({ path: good.path, name: "Slip Gaji.exe#.m4a" })).toBe("Slip Gaji.exe .m4a")
    expect(audioDownloadName({ path: good.path, name: "x.exe&a=.m4a" })).toBe("x.exe a .m4a")
    expect(audioDownloadName({ path: good.path, name: "A & B.m4a" })).toBe("A B.m4a")
    expect(audioDownloadName({ path: good.path, name: "a+b;c" })).toBe("a b c.m4a")
    for (const name of ["Slip Gaji.exe#.m4a", "x.exe&a=.m4a", "Rapat & Co", "x.exe?.m4a", "x.exe;.m4a"]) {
      const download = audioDownloadName({ path: good.path, name })
      expect(download, name).toMatch(/\.m4a$/)
      expect(download, name).not.toMatch(/[#&=+;?]/)
      expect(new URL(`https://storage.example/sign?token=t&download=${download}`.replace(/ /g, "%20")).searchParams.get("download")).toBe(download)
    }
  })

  it("drops the characters that make a name display in another order", () => {
    expect(audioDownloadName({ path: good.path, name: "Gaji\u202Eexe.m4a" })).toBe("Gaji exe.m4a")
  })

  it("finds a recording among stored answers, array or JSON text", () => {
    const other = { ...good, path: `${company}/mission-abc/44444444-4444-4444-8444-444444444444.m4a`, name: "lain.m4a" }
    expect(findRecording([null, [other], JSON.stringify([good])], good.path)).toEqual(good)
    expect(findRecording([[other]], good.path)).toBeUndefined()
    expect(findRecording([], good.path)).toBeUndefined()
  })

  it("names the activity a report recording was uploaded under, and nothing for the other folders", () => {
    const activity = "55555555-5555-4555-8555-555555555555"
    expect(audioActivityId(`${company}/${activity}/22222222-2222-4222-8222-222222222222.m4a`)).toBe(activity)
    expect(audioActivityId(`${company}/missions/22222222-2222-4222-8222-222222222222.m4a`)).toBeNull()
    expect(audioActivityId(`${company}/prospects/22222222-2222-4222-8222-222222222222.m4a`)).toBeNull()
    expect(audioActivityId("")).toBeNull()
  })

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
