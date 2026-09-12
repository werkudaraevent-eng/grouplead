import { describe, expect, it } from "vitest"
import { mergeContactField, mergeContactFields } from "./contact-draft"

describe("mergeContactField", () => {
  it("fills an empty field from the newly picked contact", () => {
    expect(mergeContactField("", null, "Head Marketing")).toBe("Head Marketing")
  })

  it("replaces a value that came from the contact being switched away from", () => {
    // The bug this exists for: A supplied "Head Marketing", the rep picks B, and
    // the field kept A's title under B's name because it was merely non-empty.
    expect(mergeContactField("Head Marketing", "Head Marketing", "Staff")).toBe("Staff")
  })

  it("keeps a value the rep typed over the CRM's", () => {
    expect(mergeContactField("VP Marketing", "Head Marketing", "Staff")).toBe("VP Marketing")
  })

  it("keeps a value the rep typed when the CRM had nothing", () => {
    expect(mergeContactField("GM", null, "Staff")).toBe("GM")
    expect(mergeContactField("GM", "", "Staff")).toBe("GM")
  })

  it("clears a CRM value when the new contact has none", () => {
    // Otherwise B, who has no phone on record, inherits A's.
    expect(mergeContactField("+628111", "+628111", null)).toBe("")
  })

  it("clears CRM-sourced values when the link is broken rather than switched", () => {
    expect(mergeContactField("a@b.com", "a@b.com", null)).toBe("")
  })

  it("keeps hand-typed values when the link is broken", () => {
    expect(mergeContactField("typed@b.com", "crm@b.com", null)).toBe("typed@b.com")
    expect(mergeContactField("typed@b.com", null, null)).toBe("typed@b.com")
  })
})

describe("mergeContactFields", () => {
  const A = { jobTitle: "Head Marketing", phone: "+628111", email: "a@pertamina.com" }
  const B = { jobTitle: "Staff", phone: null, email: "b@pertamina.com" }

  it("swaps every untouched field when switching contacts", () => {
    expect(mergeContactFields({ ...A }, A, B)).toEqual({
      jobTitle: "Staff",
      // B has no phone, so A's must not linger.
      phone: "",
      email: "b@pertamina.com",
    })
  })

  it("carries a single hand-edited field across the switch", () => {
    const current = { ...A, jobTitle: "VP Marketing" }
    expect(mergeContactFields(current, A, B)).toEqual({
      jobTitle: "VP Marketing",
      phone: "",
      email: "b@pertamina.com",
    })
  })

  it("fills everything on a first pick", () => {
    expect(mergeContactFields({ jobTitle: "", phone: "", email: "" }, null, A)).toEqual(A)
  })
})
