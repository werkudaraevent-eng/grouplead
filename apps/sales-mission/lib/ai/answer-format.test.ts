import { describe, expect, it } from "vitest"
import { parseAnswer, parseInline, plainText } from "./answer-format"

describe("parseInline", () => {
  it("turns **bold** into strong runs and leaves a stray marker alone", () => {
    expect(parseInline("Besok paling ramai pukul **10.00 WIB**: **7 kunjungan**.")).toEqual([
      { text: "Besok paling ramai pukul ", strong: false },
      { text: "10.00 WIB", strong: true },
      { text: ": ", strong: false },
      { text: "7 kunjungan", strong: true },
      { text: ".", strong: false },
    ])
    expect(parseInline("2 ** 3")).toEqual([{ text: "2 ** 3", strong: false }])
  })
})

describe("parseAnswer", () => {
  it("makes paragraphs of prose and one list of bullet lines", () => {
    const blocks = parseAnswer("Tiga orang belum lapor:\n- **Ananda** (2 aktivitas)\n- Bima\n\nCek tab Daftar.")
    expect(blocks).toEqual([
      { type: "paragraph", runs: [{ text: "Tiga orang belum lapor:", strong: false }] },
      { type: "list", ordered: false, items: [[{ text: "Ananda", strong: true }, { text: " (2 aktivitas)", strong: false }], [{ text: "Bima", strong: false }]] },
      { type: "paragraph", runs: [{ text: "Cek tab Daftar.", strong: false }] },
    ])
  })

  it("keeps numbered lines ordered and drops heading marks", () => {
    const blocks = parseAnswer("## Ringkas\n1. Satu\n2. Dua")
    expect(blocks[0]).toEqual({ type: "paragraph", runs: [{ text: "Ringkas", strong: false }] })
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true })
    expect(parseAnswer("")).toEqual([])
  })
})

describe("plainText", () => {
  it("drops the marks for a one-line place", () => {
    expect(plainText("- **Tujuh** laporan tertunda")).toBe("Tujuh laporan tertunda")
  })
})
