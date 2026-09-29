import { z } from "zod"
import { isValidPhone, normalizePhone } from "@/lib/format/phone"

/**
 * Profil: the person's own row in `public.profiles`, the same row LeadEngine's
 * Settings › Account › Profile edits, with LeadEngine's rules (a name is required; the
 * phone is optional and stored in E.164; the job title is optional). Role and
 * email are not the person's to change here: the role is an admin's (in
 * LeadEngine's Settings › Users) and the email is the sign-in.
 */

/** Longest name or job title the form takes; long enough for any real one. */
export const PROFILE_TEXT_MAX = 120

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Isi nama lengkap.")
    .max(PROFILE_TEXT_MAX, `Nama paling panjang ${PROFILE_TEXT_MAX} karakter.`),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default("")
    .refine((value) => isValidPhone(value), "Nomor telepon tidak lengkap. Contoh: 0812 3456 7890."),
  jobTitle: z
    .string()
    .trim()
    .max(PROFILE_TEXT_MAX, `Jabatan paling panjang ${PROFILE_TEXT_MAX} karakter.`)
    .optional()
    .default(""),
})
export type ProfileInput = z.input<typeof profileSchema>

/** The columns a profile save writes, and nothing else (never `role`). */
export function profileUpdate(input: z.output<typeof profileSchema>): { full_name: string; phone: string | null; job_title: string | null } {
  return {
    full_name: input.fullName,
    phone: input.phone ? normalizePhone(input.phone) : null,
    job_title: input.jobTitle || null,
  }
}

/**
 * Supabase Auth's bcrypt takes 72 bytes; a longer password would be cut
 * without a word, so the form refuses it instead.
 */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Kata sandi minimal ${PASSWORD_MIN} karakter.`)
      .max(PASSWORD_MAX, `Kata sandi paling panjang ${PASSWORD_MAX} karakter.`),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: "Ulangi kata sandi yang sama.", path: ["confirm"] })

/**
 * Supabase Auth's refusals of a password change, in the words the page shows.
 * Anything else is a failure to retry.
 */
export function passwordErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "same_password":
      return "Kata sandi baru harus berbeda dari yang sekarang."
    case "weak_password":
      return "Kata sandi terlalu mudah ditebak. Pakai campuran huruf, angka, dan tanda baca."
    case "reauthentication_needed":
      return "Demi keamanan, keluar lalu masuk lagi, kemudian ganti kata sandi."
    case "session_not_found":
    case "not_authenticated":
      return "Sesimu sudah berakhir. Masuk lagi, lalu coba lagi."
    default:
      return "Kata sandi gagal diganti. Coba lagi."
  }
}

/** The public bucket LeadEngine's Profile uploads to; `profiles.avatar_url` points into it. */
export const AVATAR_BUCKET = "avatars"
/** A photo for a 36px avatar needs nothing near this; it keeps a camera original out. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Whether a picked file is a photo this form takes. */
export function isAvatarType(type: string): boolean {
  return type in AVATAR_EXTENSIONS
}

/**
 * Where a person's photo lives in the bucket: the path LeadEngine's Profile
 * writes (`avatars/<user id>.<ext>`), so both apps replace the same file.
 */
export function avatarObjectPath(userId: string, type: string): string {
  return `avatars/${userId}.${AVATAR_EXTENSIONS[type] ?? "jpg"}`
}

/**
 * Whether `url` is this person's own photo in the avatars bucket of this
 * project, as the page's upload produced it (a cache-busting `?t=` allowed).
 * The save action takes nothing else, so a profile can only ever point at
 * the person's own file.
 */
export function isOwnAvatarUrl(url: string, supabaseUrl: string, userId: string): boolean {
  let parsed: URL
  let base: URL
  try {
    parsed = new URL(url)
    base = new URL(supabaseUrl)
  } catch {
    return false
  }
  if (parsed.origin !== base.origin) return false
  const prefix = `/storage/v1/object/public/${AVATAR_BUCKET}/avatars/`
  if (!parsed.pathname.startsWith(prefix)) return false
  const file = parsed.pathname.slice(prefix.length)
  const match = /^([^/.]+)\.(jpg|png|webp|gif)$/.exec(file)
  return match !== null && match[1] === userId
}

export const avatarUrlSchema = z.object({ url: z.string().url().max(500) })
