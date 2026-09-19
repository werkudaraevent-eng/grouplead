import { createClient } from "@/utils/supabase/server"
import { photoPathsForProspects, removePhotoFiles } from "@/lib/photos/photo-storage"
import { audioPathsForProspects, removeAudioFiles } from "@/lib/audio/audio-storage"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { purgeCutoff } from "@/lib/missions/recycle-bin"

export interface DeletedProspect {
  id: string
  clientCompanyName: string
  contactName: string | null
  location: string | null
  deletedAt: string
  deletedByName: string | null
}

/** What is in the bin, most recently deleted first. */
export async function listDeletedProspects(access: SalesMissionAccess): Promise<DeletedProspect[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select("id, client_company_name, contact_name, location, deleted_at, deleted_by")
    .eq("company_id", access.companyId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(500)
  const rows = data ?? []
  const ids = [...new Set(rows.map((row) => row.deleted_by as string | null).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids)
    for (const person of people ?? []) if (person.full_name) names.set(person.id as string, person.full_name as string)
  }
  return rows.map((row) => ({
    id: row.id as string,
    clientCompanyName: row.client_company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    deletedAt: row.deleted_at as string,
    deletedByName: row.deleted_by ? (names.get(row.deleted_by as string) ?? null) : null,
  }))
}

/** Retention, applied when the bin is opened; same rule as missions. */
export async function purgeExpiredProspects(access: SalesMissionAccess, now: Date): Promise<number> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data: expired } = await schema
    .from("prospects")
    .select("id")
    .eq("company_id", access.companyId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", purgeCutoff(now))
  const ids = (expired ?? []).map((row) => row.id as string)
  if (ids.length === 0) return 0
  try {
    await removePhotoFiles(access, await photoPathsForProspects(schema, access.companyId, ids))
    await removeAudioFiles(access, await audioPathsForProspects(schema, access.companyId, ids))
  } catch {}
  const { data } = await schema.from("prospects").delete().eq("company_id", access.companyId).in("id", ids).select("id")
  return data?.length ?? 0
}
