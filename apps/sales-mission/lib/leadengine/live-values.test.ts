import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MissionAppointment } from "@/lib/missions/mission-schema"
import { liveAppointment, liveName, recordedLine, sameName, settleWithin } from "./live-values"

const appointment = (patch: Partial<MissionAppointment> = {}): MissionAppointment => ({
  salutation: "Bapak",
  contactId: "c0ffee00-0000-4000-8000-000000000001",
  name: "Nofri",
  jobTitle: "HR",
  division: "People",
  phone: "081234567890",
  email: null,
  building: "Menara A",
  notes: "Parkir di basement",
  ...patch,
})

describe("sameName", () => {
  it("treats case and extra spaces as the same name", () => {
    expect(sameName("PT Arunika  Kreasi", " pt arunika kreasi")).toBe(true)
  })

  it("treats a changed word as a different name", () => {
    expect(sameName("PT Arunika Kreasi", "PT Arunika Kreasi Nusantara")).toBe(false)
    expect(sameName("Asuransi BRI Life", "BRI Life")).toBe(false)
  })
})

describe("liveName", () => {
  it("shows the CRM's name and names the recorded one when they differ", () => {
    expect(liveName("PT Arunka Kreasi", "PT Arunika Kreasi")).toEqual({ name: "PT Arunika Kreasi", recordedAs: "PT Arunka Kreasi" })
  })

  it("shows the CRM's spelling without a line when only case or spacing changed", () => {
    expect(liveName("pt arunika  kreasi", "PT Arunika Kreasi")).toEqual({ name: "PT Arunika Kreasi", recordedAs: null })
  })

  it("keeps the recorded name when the CRM gave none", () => {
    expect(liveName("PT Arunika Kreasi", null)).toEqual({ name: "PT Arunika Kreasi", recordedAs: null })
    expect(liveName("PT Arunika Kreasi", "   ")).toEqual({ name: "PT Arunika Kreasi", recordedAs: null })
  })

  it("has nothing to name when nothing was recorded", () => {
    expect(liveName("", "PT Arunika Kreasi")).toEqual({ name: "PT Arunika Kreasi", recordedAs: null })
  })
})

describe("liveAppointment", () => {
  it("puts the CRM's current details over the copy and names the recorded name", () => {
    const result = liveAppointment(appointment(), { fullName: "Nofri Ardian", jobTitle: "HR Manager", phone: "0811111111", email: "nofri@arunika.id" })
    expect(result.appointment).toEqual(
      appointment({ name: "Nofri Ardian", jobTitle: "HR Manager", phone: "0811111111", email: "nofri@arunika.id" })
    )
    expect(result.recordedName).toBe("Nofri")
  })

  it("keeps what the appointment team learned where the CRM has nothing", () => {
    const result = liveAppointment(appointment({ email: "nofri@mail.id" }), { fullName: "Nofri", jobTitle: null, phone: "  ", email: null })
    expect(result.appointment.jobTitle).toBe("HR")
    expect(result.appointment.phone).toBe("081234567890")
    expect(result.appointment.email).toBe("nofri@mail.id")
    expect(result.recordedName).toBeNull()
  })

  it("never replaces Sales Activity's own fields", () => {
    const result = liveAppointment(appointment(), { fullName: "Nofri Ardian", jobTitle: null, phone: null, email: null })
    expect(result.appointment.salutation).toBe("Bapak")
    expect(result.appointment.division).toBe("People")
    expect(result.appointment.building).toBe("Menara A")
    expect(result.appointment.notes).toBe("Parkir di basement")
  })

  it("shows the copy as it is without a link or without a reply", () => {
    const unlinked = appointment({ contactId: null })
    expect(liveAppointment(unlinked, { fullName: "Someone Else", jobTitle: null, phone: null, email: null })).toEqual({ appointment: unlinked, recordedName: null })
    expect(liveAppointment(appointment(), null)).toEqual({ appointment: appointment(), recordedName: null })
  })
})

describe("recordedLine", () => {
  it("says when the copy was made, in the product's words", () => {
    expect(recordedLine("activity", "PT Arunka")).toBe("Tercatat saat dijadwalkan: PT Arunka")
    expect(recordedLine("prospect", "PT Arunka")).toBe("Tercatat saat dibuat: PT Arunka")
  })

  it("is nothing when there is nothing to say", () => {
    expect(recordedLine("activity", null)).toBeNull()
  })
})

describe("settleWithin", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("passes a prompt answer through", async () => {
    await expect(settleWithin(Promise.resolve("live"), 2500, "fallback")).resolves.toBe("live")
  })

  it("falls back on a failure instead of throwing", async () => {
    await expect(settleWithin(Promise.reject(new Error("down")), 2500, "fallback")).resolves.toBe("fallback")
  })

  it("stops waiting at the deadline", async () => {
    const never = new Promise<string>(() => {})
    const settled = settleWithin(never, 2500, "fallback")
    await vi.advanceTimersByTimeAsync(2499)
    let done = false
    void settled.then(() => {
      done = true
    })
    await Promise.resolve()
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(settled).resolves.toBe("fallback")
  })
})
