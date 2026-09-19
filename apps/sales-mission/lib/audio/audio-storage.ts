import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { AUDIO_BUCKET, isCompanyAudio, parseAudioAnswer, type AudioAnswer } from "./audio-answer"

/**
 * Server side of audio storage, the photo module's twin: everything goes
 * through the user's own session so the bucket's policies decide, and every
 * path is checked against the caller's company here as well.
 */

/** Signed read URLs, an hour long, keyed by path. Paths outside the company are skipped. */
export async function signAudioUrls(access: SalesMissionAccess, paths: string[]): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((path) => isCompanyAudio(path, access.companyId)))]
  const result = new Map<string, string>()
  if (own.length === 0) return result
  const supabase = await createClient()
  const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrls(own, 3600)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl)
  }
  return result
}

/**
 * Signed download URLs that hand the browser the recording's own name
 * (a uuid is no name for a file dropped into Fireflies). One call per file:
 * the batch endpoint takes a single name for all of them.
 */
export async function signAudioDownloads(access: SalesMissionAccess, recordings: AudioAnswer[]): Promise<Map<string, string>> {
  const own = recordings.filter((item) => isCompanyAudio(item.path, access.companyId))
  const result = new Map<string, string>()
  if (own.length === 0) return result
  const supabase = await createClient()
  await Promise.all(
    own.map(async (item) => {
      const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(item.path, 3600, { download: downloadName(item) })
      if (data?.signedUrl) result.set(item.path, data.signedUrl)
    })
  )
  return result
}

/** The stored name, given the file's real extension when the phone left it off. */
function downloadName(item: AudioAnswer): string {
  const extension = item.path.slice(item.path.lastIndexOf(".") + 1)
  const base = item.name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "rekaman"
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`
}

/** Remove files. Best effort: a missing object is not an error worth surfacing. */
export async function removeAudioFiles(access: SalesMissionAccess, paths: string[]): Promise<void> {
  const own = [...new Set(paths.filter((path) => isCompanyAudio(path, access.companyId)))]
  if (own.length === 0) return
  const supabase = await createClient()
  for (let start = 0; start < own.length; start += 100) {
    await supabase.storage.from(AUDIO_BUCKET).remove(own.slice(start, start + 100))
  }
}

type Schema = ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>

function pathsIn(rows: Array<{ value: unknown }> | null | undefined): string[] {
  return (rows ?? []).flatMap((row) => parseAudioAnswer(row.value).map((item) => item.path))
}

/** Every recording attached to these missions, read before the rows are deleted. */
export async function audioPathsForMissions(schema: Schema, companyId: string, missionIds: string[]): Promise<string[]> {
  if (missionIds.length === 0) return []
  const { data: reports } = await schema.from("visit_reports").select("id").eq("company_id", companyId).in("mission_id", missionIds)
  const reportIds = (reports ?? []).map((row) => row.id as string)
  const [reportValues, missionValues] = await Promise.all([
    reportIds.length > 0 ? schema.from("report_field_values").select("value").eq("company_id", companyId).in("report_id", reportIds) : Promise.resolve({ data: [] }),
    schema.from("mission_field_values").select("value").eq("company_id", companyId).in("mission_id", missionIds),
  ])
  return [...pathsIn(reportValues.data as Array<{ value: unknown }>), ...pathsIn(missionValues.data as Array<{ value: unknown }>)]
}

export async function audioPathsForProspects(schema: Schema, companyId: string, prospectIds: string[]): Promise<string[]> {
  if (prospectIds.length === 0) return []
  const { data } = await schema.from("prospect_field_values").select("value").eq("company_id", companyId).in("prospect_id", prospectIds)
  return pathsIn(data as Array<{ value: unknown }>)
}
