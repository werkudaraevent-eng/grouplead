"use server"

import { randomUUID } from "crypto"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { AUDIO_BUCKET, AUDIO_MAX_BYTES, audioExtension, isCompanyAudio } from "@/lib/audio/audio-answer"
import { removeAudioFiles, signAudioUrls } from "@/lib/audio/audio-storage"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * The three moves an audio field needs from the server: a place to put a
 * file, a way to listen to one, and a way to take one back. The server
 * picks the path (company folder first), so the browser never names a
 * location. The full signed URL goes back too, so the browser can PUT the
 * file itself and show how far a 30 MB recording has got.
 */

const SCOPE = /^[A-Za-z0-9_-]{1,60}$/

export async function prepareAudioUpload(input: { scope: string; size: number; type: string; name: string }): Promise<ActionResult<{ path: string; token: string; signedUrl: string }>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!SCOPE.test(input.scope)) return { success: false, error: "Tujuan unggah tidak dikenal." }
  if (typeof input.size !== "number" || input.size <= 0 || input.size > AUDIO_MAX_BYTES) {
    return { success: false, error: "Rekaman maksimal 50 MB." }
  }
  const extension = audioExtension(String(input.type ?? ""), String(input.name ?? ""))
  if (!extension) return { success: false, error: "Berkas bukan rekaman suara yang dikenal." }
  const path = `${access.companyId}/${input.scope}/${randomUUID()}.${extension}`

  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: "Tidak bisa menyiapkan unggahan. Coba lagi." }
  return { success: true, data: { path: data.path, token: data.token, signedUrl: data.signedUrl } }
}

export async function signAudio(paths: string[]): Promise<Record<string, string>> {
  const access = await getSalesMissionAccess()
  if (!access) return {}
  const urls = await signAudioUrls(access, paths.slice(0, 50))
  return Object.fromEntries(urls)
}

export async function removeAudio(path: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!isCompanyAudio(path, access.companyId)) return { success: false, error: "Rekaman tidak dikenal." }
  await removeAudioFiles(access, [path])
  return { success: true }
}
