import { describe, expect, it } from "vitest"
import { sortTitle } from "./sort-title"

describe("sortTitle", () => {
  it("names the default order first on the column that holds it, then what the click does", () => {
    expect(sortTitle({ label: "Jadwal", target: { direction: "asc" }, isDefault: true, hint: "terdekat dulu" })).toBe(
      "Urutan bawaan: terdekat dulu. Klik untuk urut jadwal: A ke Z, terlama dulu.",
    )
  })

  it("says only what the click does on any other column", () => {
    expect(sortTitle({ label: "Lokasi", target: { direction: "asc" }, isDefault: false, hint: "terdekat dulu" })).toBe("Urut lokasi: A ke Z, terlama dulu")
    expect(sortTitle({ label: "Lokasi", target: { direction: "desc" }, isDefault: false })).toBe("Urut lokasi: Z ke A, terbaru dulu")
  })

  it("names the default order when the click returns to it", () => {
    expect(sortTitle({ label: "Jadwal", target: { direction: "upcoming" }, isDefault: false, hint: "terdekat dulu" })).toBe("Urut jadwal: terdekat dulu")
    expect(sortTitle({ label: "Hubungi lagi", target: { direction: "due" }, isDefault: false })).toBe("Urut hubungi lagi: urutan bawaan")
  })

  it("reads a default held as a direction (Laporan's newest first) the same way", () => {
    expect(sortTitle({ label: "Status", target: { direction: "asc" }, isDefault: true, hint: "terbaru dulu" })).toBe(
      "Urutan bawaan: terbaru dulu. Klik untuk urut status: A ke Z, terlama dulu.",
    )
  })
})
