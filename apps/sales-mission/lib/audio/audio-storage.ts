import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { AUDIO_BUCKET, audioActivityId, audioDownloadName, findRecording, isCompanyAudio, parseAudioAnswer, type AudioAnswer } from "./audio-answer"

/**
 * Server side of audio storage, the photo module's twin: everything goes
 * through the user's own session so the bucket's policies decide, and every
 * path is checked against the caller's company here as well.
 */

/**
 * Signed read URLs, keyed by path. Paths outside the company are skipped.
 *
 * An hour by default, a screen's lifetime. Batched 100 paths at a time, like
 * the photos.
 */
export async function signAudioUrls(
  access: SalesMissionAccess,
  paths: string[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((path) => isCompanyAudio(path, access.companyId)))]
  const result = new Map<string, string>()
  if (own.length === 0) return result
  const supabase = await createClient()
  for (let start = 0; start < own.length; start += 100) {
    const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrls(own.slice(start, start + 100), expiresIn)
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl)
    }
  }
  return result
}

/**
 * Signed download URLs that hand the browser the recording's own name
 * (`audioDownloadName`). One call per file: the batch endpoint takes a single
 * name for all of them. An hour by default; the file link of an exported
 * workbook (`/workspace/lampiran`) asks for minutes, since it is followed at
 * once.
 */
export async function signAudioDownloads(
  access: SalesMissionAccess,
  recordings: Array<Pick<AudioAnswer, "path" | "name">>,
  expiresIn = 3600
): Promise<Map<string, string>> {
  const own = recordings.filter((item) => isCompanyAudio(item.path, access.companyId))
  const result = new Map<string, string>()
  if (own.length === 0) return result
  const supabase = await createClient()
  await Promise.all(
    own.map(async (item) => {
      const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(item.path, expiresIn, { download: audioDownloadName(item) })
      if (data?.signedUrl) result.set(item.path, data.signedUrl)
    })
  )
  return result
}

/**
 * One recording as its visit report stores it, for the file link of an
 * exported workbook (`/workspace/lampiran`), which names the download from
 * the record rather than from anything in the link: a name carried in the
 * address could be rewritten by whoever forwards it.
 *
 * The report form uploads into the activity's own folder, so the path names
 * the activity; its reports' answers are read with the person's own session
 * and filtered by company. A recording no report holds (one from the activity
 * or prospect form, or since removed) keeps an empty name, which downloads as
 * "rekaman.<ext>".
 */
export async function storedReportRecording(
  access: SalesMissionAccess,
  path: string
): Promise<Pick<AudioAnswer, "path" | "name">> {
  const unnamed = { path, name: "" }
  const activityId = audioActivityId(path)
  if (!activityId || !isCompanyAudio(path, access.companyId)) return unnamed

  const schema = (await createClient()).schema("sales_mission")
  const { data: reports } = await schema
    .from("visit_reports")
    .select("id")
    .eq("company_id", access.companyId)
    .eq("mission_id", activityId)
  const reportIds = (reports ?? []).map((row) => row.id as string)
  if (reportIds.length === 0) return unnamed

  const { data: values } = await schema
    .from("report_field_values")
    .select("value")
    .eq("company_id", access.companyId)
    .in("report_id", reportIds)
  const found = findRecording((values ?? []).map((row) => row.value as unknown), path)
  return found ? { path, name: found.name } : unnamed
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
