import { describe, expect, it } from "vitest"
import {
  avatarObjectPath,
  isAvatarType,
  isOwnAvatarUrl,
  passwordErrorMessage,
  passwordSchema,
  profileSchema,
  profileUpdate,
} from "./profile-schema"

describe("profileSchema", () => {
  it("requires a name and trims it", () => {
    expect(profileSchema.safeParse({ fullName: "   " }).success).toBe(false)
    const parsed = profileSchema.parse({ fullName: "  Rina Kusuma  " })
    expect(parsed.fullName).toBe("Rina Kusuma")
    expect(parsed.phone).toBe("")
    expect(parsed.jobTitle).toBe("")
  })

  it("takes a phone typed any common way and refuses one too short", () => {
    expect(profileSchema.safeParse({ fullName: "Rina", phone: "0812 3456 7890" }).success).toBe(true)
    expect(profileSchema.safeParse({ fullName: "Rina", phone: "0812" }).success).toBe(false)
  })

  it("refuses a name or job title past the limit", () => {
    expect(profileSchema.safeParse({ fullName: "x".repeat(121) }).success).toBe(false)
    expect(profileSchema.safeParse({ fullName: "Rina", jobTitle: "x".repeat(121) }).success).toBe(false)
  })

  it("ignores anything but its own fields, so a role never rides along", () => {
    const parsed = profileSchema.parse({ fullName: "Rina", role: "super_admin" })
    expect(parsed).not.toHaveProperty("role")
  })
})

describe("profileUpdate", () => {
  it("stores the phone in E.164 and blanks as null", () => {
    expect(profileUpdate(profileSchema.parse({ fullName: "Rina", phone: "0812-3456-7890", jobTitle: "Sales" }))).toEqual({
      full_name: "Rina",
      phone: "+6281234567890",
      job_title: "Sales",
    })
    expect(profileUpdate(profileSchema.parse({ fullName: "Rina" }))).toEqual({ full_name: "Rina", phone: null, job_title: null })
  })
})

describe("passwordSchema", () => {
  it("asks for eight characters and the same twice", () => {
    expect(passwordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false)
    expect(passwordSchema.safeParse({ password: "longenough", confirm: "different1" }).success).toBe(false)
    expect(passwordSchema.safeParse({ password: "longenough", confirm: "longenough" }).success).toBe(true)
  })

  it("refuses what bcrypt would cut", () => {
    const long = "x".repeat(73)
    expect(passwordSchema.safeParse({ password: long, confirm: long }).success).toBe(false)
  })

  it("puts a mismatch on the second field", () => {
    const result = passwordSchema.safeParse({ password: "longenough", confirm: "different1" })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(["confirm"])
  })
})

describe("passwordErrorMessage", () => {
  it("names the refusals Supabase Auth gives", () => {
    expect(passwordErrorMessage("same_password")).toMatch(/berbeda/)
    expect(passwordErrorMessage("weak_password")).toMatch(/mudah ditebak/)
    expect(passwordErrorMessage("reauthentication_needed")).toMatch(/masuk lagi/)
    expect(passwordErrorMessage(undefined)).toMatch(/Coba lagi/)
  })
})

describe("avatars", () => {
  const supabase = "https://abc.supabase.co"
  const own = "20000000-0000-4000-8000-000000000001"

  it("writes to LeadEngine's path, by type", () => {
    expect(avatarObjectPath(own, "image/png")).toBe(`avatars/${own}.png`)
    expect(avatarObjectPath(own, "image/jpeg")).toBe(`avatars/${own}.jpg`)
    expect(isAvatarType("image/heic")).toBe(false)
    expect(isAvatarType("image/webp")).toBe(true)
  })

  it("accepts only the person's own file in this project's bucket", () => {
    expect(isOwnAvatarUrl(`${supabase}/storage/v1/object/public/avatars/avatars/${own}.jpg?t=123`, supabase, own)).toBe(true)
    expect(isOwnAvatarUrl(`${supabase}/storage/v1/object/public/avatars/avatars/someone-else.jpg`, supabase, own)).toBe(false)
    expect(isOwnAvatarUrl(`https://evil.example/storage/v1/object/public/avatars/avatars/${own}.jpg`, supabase, own)).toBe(false)
    expect(isOwnAvatarUrl(`${supabase}/storage/v1/object/public/photos/avatars/${own}.jpg`, supabase, own)).toBe(false)
    expect(isOwnAvatarUrl(`${supabase}/storage/v1/object/public/avatars/avatars/${own}.svg`, supabase, own)).toBe(false)
    expect(isOwnAvatarUrl("not a url", supabase, own)).toBe(false)
  })
})
