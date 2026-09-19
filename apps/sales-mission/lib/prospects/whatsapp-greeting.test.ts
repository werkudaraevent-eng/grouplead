import { describe, expect, it } from "vitest"
import { addressContact, renderWhatsAppGreeting, timeOfDayGreeting, whatsAppLink } from "./whatsapp-greeting"

// Mission time is UTC+7: 02:00Z is 09:00 WIB.
const at = (utcHour: number) => new Date(Date.UTC(2026, 8, 18, utcHour, 0, 0))

describe("timeOfDayGreeting", () => {
  it("follows the hour in mission time, not UTC", () => {
    expect(timeOfDayGreeting(at(2))).toBe("Selamat pagi") // 09:00 WIB
    expect(timeOfDayGreeting(at(5))).toBe("Selamat siang") // 12:00 WIB
    expect(timeOfDayGreeting(at(9))).toBe("Selamat sore") // 16:00 WIB
    expect(timeOfDayGreeting(at(13))).toBe("Selamat malam") // 20:00 WIB
    expect(timeOfDayGreeting(at(17))).toBe("Selamat pagi") // 00:00 WIB the next day
  })
})

describe("addressContact", () => {
  it("uses the salutation when known and a neutral one when not", () => {
    expect(addressContact("Bapak", "Nuryono")).toBe("Bapak Nuryono")
    expect(addressContact("", "Nuryono")).toBe("Bapak/Ibu Nuryono")
    expect(addressContact(null, null)).toBe("Bapak/Ibu")
  })
})

describe("renderWhatsAppGreeting", () => {
  const vars = { contact: "Bapak Nuryono", sales: "Setyorini", company: "Werkudara Group", now: at(2) }

  it("fills the default when the unit has no template", () => {
    expect(renderWhatsAppGreeting(null, vars)).toBe("Selamat pagi Bapak Nuryono, saya Setyorini dari Werkudara Group.")
    expect(renderWhatsAppGreeting("   ", vars)).toBe("Selamat pagi Bapak Nuryono, saya Setyorini dari Werkudara Group.")
  })

  it("fills the admin's template, every placeholder, any number of times", () => {
    expect(renderWhatsAppGreeting("Halo {kontak}! {sales} di sini ({perusahaan}). {kontak}, ada waktu?", vars)).toBe(
      "Halo Bapak Nuryono! Setyorini di sini (Werkudara Group). Bapak Nuryono, ada waktu?"
    )
  })

  it("keeps a template with no placeholders as written, minus doubled spaces", () => {
    expect(renderWhatsAppGreeting("Halo,  ada  waktu?", vars)).toBe("Halo, ada waktu?")
  })
})

describe("whatsAppLink", () => {
  it("strips the plus and encodes the text", () => {
    expect(whatsAppLink("+62 813-2652-7337", "Halo Bapak Nuryono")).toBe("https://wa.me/6281326527337?text=Halo%20Bapak%20Nuryono")
    expect(whatsAppLink("081326527337")).toBe("https://wa.me/6281326527337")
  })
})
