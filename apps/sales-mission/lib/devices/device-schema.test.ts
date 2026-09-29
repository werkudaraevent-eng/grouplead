import { describe, expect, it } from "vitest"
import { deviceErrorMessage, signOutDeviceSchema, touchDeviceSchema } from "./device-schema"

describe("device schemas", () => {
  it("takes a user agent or none, never a novel", () => {
    expect(touchDeviceSchema.safeParse({ userAgent: "Mozilla/5.0" }).success).toBe(true)
    expect(touchDeviceSchema.safeParse({}).success).toBe(true)
    expect(touchDeviceSchema.safeParse({ userAgent: "x".repeat(1025) }).success).toBe(false)
    expect(touchDeviceSchema.safeParse({ userAgent: 42 }).success).toBe(false)
  })

  it("signs out a session by its uuid only", () => {
    expect(signOutDeviceSchema.safeParse({ sessionId: "20000000-0000-4000-8000-0000000000a1" }).success).toBe(true)
    expect(signOutDeviceSchema.safeParse({ sessionId: "all" }).success).toBe(false)
    expect(signOutDeviceSchema.safeParse({}).success).toBe(false)
  })
})

describe("deviceErrorMessage", () => {
  it("explains the refusals the database raises", () => {
    expect(deviceErrorMessage("current_session")).toMatch(/Keluar di menu akun/)
    expect(deviceErrorMessage("not_authenticated")).toMatch(/Masuk lagi/)
  })
  it("says to try again for anything else", () => {
    expect(deviceErrorMessage("connection reset")).toBe("Perangkat gagal dikeluarkan. Coba lagi.")
    expect(deviceErrorMessage(undefined)).toBe("Perangkat gagal dikeluarkan. Coba lagi.")
  })
})
