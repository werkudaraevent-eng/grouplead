"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import {
  avatarUrlSchema,
  isOwnAvatarUrl,
  passwordErrorMessage,
  passwordSchema,
  profileSchema,
  profileUpdate,
} from "@/lib/profile/profile-schema"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"
import type { ActionResult } from "@/types/action-result"

/**
 * Profil: the person's own row in `public.profiles`, shared with LeadEngine,
 * written under their own session (row security lets a person update only
 * their own profile). Each action writes only its own columns, never
 * `role`: that is an admin's, in LeadEngine.
 */

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Isian belum benar."
}

/** Name, phone and job title. The drawer and the cards read the new name on the next render. */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) }

  const supabase = await createClient()
  // `select` so a write row security refused (zero rows, no error) is not reported as saved.
  const { data, error } = await supabase.from("profiles").update(profileUpdate(parsed.data)).eq("id", access.userId).select("id")
  if (error || !data?.length) return { success: false, error: "Profil gagal disimpan. Coba lagi." }

  revalidatePath(paths.workspace, "layout")
  return { success: true }
}

/**
 * Point the profile at the photo the page just uploaded to the avatars
 * bucket, at the path LeadEngine writes. Only the person's own file in this
 * project's bucket is accepted.
 */
export async function setProfilePhoto(input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  const parsed = avatarUrlSchema.safeParse(input)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!parsed.success || !isOwnAvatarUrl(parsed.data.url, supabaseUrl, access.userId)) {
    return { success: false, error: "Foto tidak dikenal." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from("profiles").update({ avatar_url: parsed.data.url }).eq("id", access.userId).select("id")
  if (error || !data?.length) return { success: false, error: "Foto gagal disimpan. Coba lagi." }

  revalidatePath(paths.workspace, "layout")
  return { success: true }
}

/**
 * A new password, as LeadEngine's Profile sets it: Supabase Auth changes it
 * for the session this request carries and, in the same step, ends every
 * other session of the account, so this device stays signed in and every
 * other one (in both apps) has to sign in again with the new password.
 */
export async function changePassword(input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { success: false, error: passwordErrorMessage(error.code) }

  revalidatePath(paths.settings.devices)
  return { success: true }
}
