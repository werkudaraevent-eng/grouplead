import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { PHOTO_BUCKET, isCompanyPhoto, parsePhotoAnswer } from "./photo-answer"

/**
 * Server side of photo storage. Everything goes through the user's own
 * session, so the bucket's policies (company folder = company access)
 * decide; on top of that every path is checked against the caller's
 * company here, so a crafted path never reaches storage.
 */

/** Signed read URLs, an hour long, keyed by path. Paths outside the company are skipped. */
export async function signPhotoUrls(access: SalesMissionAccess, paths: string[]): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((path) => isCompanyPhoto(path, access.companyId)))]
  const result = new Map<string, string>()
  if (own.length === 0) return result
  const supabase = await createClient()
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(own, 3600)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl)
  }
  return result
}

/** Remove files. Best effort: a missing object is not an error worth surfacing. */
export async function removePhotoFiles(access: SalesMissionAccess, paths: string[]): Promise<void> {
  const own = [...new Set(paths.filter((path) => isCompanyPhoto(path, access.companyId)))]
  if (own.length === 0) return
  const supabase = await createClient()
  for (let start = 0; start < own.length; start += 100) {
    await supabase.storage.from(PHOTO_BUCKET).remove(own.slice(start, start + 100))
  }
}

type Schema = ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>

function pathsIn(rows: Array<{ value: unknown }> | null | undefined): string[] {
  return (rows ?? []).flatMap((row) => parsePhotoAnswer(row.value).map((photo) => photo.path))
}

/**
 * Every photo attached to these missions: on their reports and on the
 * missions themselves. Read before the rows are deleted, since the values
 * go with them and the files would otherwise stay behind for good.
 */
export async function photoPathsForMissions(schema: Schema, companyId: string, missionIds: string[]): Promise<string[]> {
  if (missionIds.length === 0) return []
  const { data: reports } = await schema.from("visit_reports").select("id").eq("company_id", companyId).in("mission_id", missionIds)
  const reportIds = (reports ?? []).map((row) => row.id as string)
  const [reportValues, missionValues] = await Promise.all([
    reportIds.length > 0 ? schema.from("report_field_values").select("value").eq("company_id", companyId).in("report_id", reportIds) : Promise.resolve({ data: [] }),
    schema.from("mission_field_values").select("value").eq("company_id", companyId).in("mission_id", missionIds),
  ])
  return [...pathsIn(reportValues.data as Array<{ value: unknown }>), ...pathsIn(missionValues.data as Array<{ value: unknown }>)]
}

export async function photoPathsForProspects(schema: Schema, companyId: string, prospectIds: string[]): Promise<string[]> {
  if (prospectIds.length === 0) return []
  const { data } = await schema.from("prospect_field_values").select("value").eq("company_id", companyId).in("prospect_id", prospectIds)
  return pathsIn(data as Array<{ value: unknown }>)
}
