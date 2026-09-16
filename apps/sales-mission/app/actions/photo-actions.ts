"use server"

import { randomUUID } from "crypto"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, isCompanyPhoto } from "@/lib/photos/photo-answer"
import { removePhotoFiles, signPhotoUrls } from "@/lib/photos/photo-storage"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * The three moves a photo field needs from the server: a place to put a
 * file, a way to look at one, and a way to take one back. The server picks
 * the path (company folder first), so the browser never names a location.
 */

const SCOPE = /^[A-Za-z0-9_-]{1,60}$/

export async function preparePhotoUpload(input: { scope: string; size: number; type: string }): Promise<ActionResult<{ path: string; token: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!SCOPE.test(input.scope)) return { success: false, error: "Tujuan unggah tidak dikenal." }
  if (typeof input.size !== "number" || input.size <= 0 || input.size > PHOTO_MAX_BYTES) {
    return { success: false, error: "Foto maksimal 10 MB." }
  }
  const extension = input.type === "image/png" ? "png" : input.type === "image/webp" ? "webp" : "jpg"
  const path = `${access.companyId}/${input.scope}/${randomUUID()}.${extension}`

  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: "Tidak bisa menyiapkan unggahan. Coba lagi." }
  return { success: true, data: { path: data.path, token: data.token } }
}

export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const access = await getSalesMissionAccess()
  if (!access) return {}
  const urls = await signPhotoUrls(access, paths.slice(0, 50))
  return Object.fromEntries(urls)
}

export async function removePhoto(path: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!isCompanyPhoto(path, access.companyId)) return { success: false, error: "Foto tidak dikenal." }
  await removePhotoFiles(access, [path])
  return { success: true }
}
