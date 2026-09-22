import { describe, expect, it } from "vitest"
import { enterAction, isEmptyItem, nextMarker, readMarker } from "./list-continuation"

describe("readMarker", () => {
  it("reads every marker the field understands", () => {
    expect(readMarker("- beli")).toEqual({ indent: "", marker: "- ", rest: "beli" })
    expect(readMarker("* beli")).toEqual({ indent: "", marker: "* ", rest: "beli" })
    expect(readMarker("• beli")).toEqual({ indent: "", marker: "• ", rest: "beli" })
    expect(readMarker("1. beli")).toEqual({ indent: "", marker: "1. ", rest: "beli" })
  })

  it("keeps the indent so the next item lines up", () => {
    expect(readMarker("  - beli")).toEqual({ indent: "  ", marker: "- ", rest: "beli" })
  })

  it("is not a marker without the space after it", () => {
    expect(readMarker("-beli")).toBeNull()
    expect(readMarker("1.beli")).toBeNull()
    expect(readMarker("Rp1.500")).toBeNull()
    expect(readMarker("biasa saja")).toBeNull()
  })
})

describe("nextMarker", () => {
  it("counts a number on", () => {
    expect(nextMarker("1. ")).toBe("2. ")
    expect(nextMarker("9. ")).toBe("10. ")
    expect(nextMarker("99. ")).toBe("100. ")
  })

  it("repeats a bullet", () => {
    expect(nextMarker("- ")).toBe("- ")
    expect(nextMarker("* ")).toBe("* ")
    expect(nextMarker("• ")).toBe("• ")
  })
})

describe("isEmptyItem", () => {
  it("is true for a marker with nothing written after it", () => {
    expect(isEmptyItem("- ")).toBe(true)
    expect(isEmptyItem("1. ")).toBe(true)
    expect(isEmptyItem("  • ")).toBe(true)
  })

  it("is false once the item says something", () => {
    expect(isEmptyItem("- beli")).toBe(false)
    expect(isEmptyItem("biasa saja")).toBe(false)
  })
})

describe("enterAction", () => {
  it("opens the next numbered item", () => {
    const value = "1. Ketemu Pak Budi"
    expect(enterAction(value, value.length)).toEqual({ kind: "continue", text: "\n2. " })
  })

  it("rolls a single digit over to two", () => {
    const value = "9. Minta penawaran"
    expect(enterAction(value, value.length)).toEqual({ kind: "continue", text: "\n10. " })
  })

  it("repeats a bullet and keeps its indent", () => {
    const value = "  - Kirim proposal"
    expect(enterAction(value, value.length)).toEqual({ kind: "continue", text: "\n  - " })
    const dot = "• Kirim proposal"
    expect(enterAction(dot, dot.length)).toEqual({ kind: "continue", text: "\n• " })
  })

  it("continues from the caret in the middle of an item", () => {
    const value = "1. Ketemu Pak Budi"
    expect(enterAction(value, 9)).toEqual({ kind: "continue", text: "\n2. " })
  })

  it("reads the line the caret is on, not the first line", () => {
    const value = "Ringkasan:\n1. Ketemu Pak Budi\n2. Minta angka"
    expect(enterAction(value, value.length)).toEqual({ kind: "continue", text: "\n3. " })
  })

  it("ends the list on an empty item", () => {
    const value = "1. Ketemu Pak Budi\n2. "
    expect(enterAction(value, value.length)).toEqual({ kind: "end", from: 19, to: 22 })
    expect(value.slice(0, 19) + value.slice(22)).toBe("1. Ketemu Pak Budi\n")
  })

  it("ends the list on an empty bullet, indent and all", () => {
    const value = "  - "
    expect(enterAction(value, value.length)).toEqual({ kind: "end", from: 0, to: 4 })
  })

  it("inserts a plain newline on a line without a marker", () => {
    const value = "Pertemuan berjalan lancar"
    expect(enterAction(value, value.length)).toEqual({ kind: "plain" })
    expect(enterAction("", 0)).toEqual({ kind: "plain" })
  })

  it("inserts a plain newline while the caret is still inside the marker", () => {
    const value = "1. Ketemu Pak Budi"
    expect(enterAction(value, 1)).toEqual({ kind: "plain" })
    expect(enterAction(value, 2)).toEqual({ kind: "plain" })
  })

  it("never continues on Shift+Enter", () => {
    const item = "1. Ketemu Pak Budi"
    expect(enterAction(item, item.length, true)).toEqual({ kind: "plain" })
    const empty = "- "
    expect(enterAction(empty, empty.length, true)).toEqual({ kind: "plain" })
  })
})
