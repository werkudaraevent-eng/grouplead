"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess, isSettingsAdmin, type SalesMissionAccess } from "@/lib/sales-mission-access"
import type { ActionResult } from "@/types/action-result"
import { photoPathsForMissions, photoPathsForProspects, removePhotoFiles } from "@/lib/photos/photo-storage"

const PATHS = ["/workspace", "/workspace/missions", "/workspace/calendar", "/workspace/settings/recycle-bin", "/workspace/settings/data"]

/**
 * Only an admin (the settings grant) or a super admin touches the bin: the
 * mission module's own `delete` grant lets a person put things in, not take
 * them out or destroy them.
 */
async function requireBinAdmin(): Promise<{ access: SalesMissionAccess } | { error: string }> {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." }
  if (await isSettingsAdmin(access)) return { access }
  return { error: "Hanya admin Sales Mission yang bisa mengelola sampah." }
}

function validIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500)
}

/** Put missions back where they were. Everything under them was never touched. */
export async function restoreMissions(ids: string[]): Promise<ActionResult<{ restored: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada mission yang dipilih." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
    .eq("company_id", gate.access.companyId)
    .in("id", unique)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Mission gagal dipulihkan." }

  PATHS.forEach((path) => revalidatePath(path))
  return { success: true, data: { restored: data?.length ?? 0 } }
}

/**
 * Remove missions for good. Only rows already in the bin qualify, so a
 * crafted request cannot skip the bin. The audit log's DELETE row keeps the
 * full record of each mission with who removed it.
 */
export async function purgeMissions(ids: string[]): Promise<ActionResult<{ purged: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada mission yang dipilih." }

  await removePhotosFor(gate.access, "missions", unique)
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .delete()
    .eq("company_id", gate.access.companyId)
    .in("id", unique)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Mission gagal dihapus permanen." }

  PATHS.forEach((path) => revalidatePath(path))
  return { success: true, data: { purged: data?.length ?? 0 } }
}

/** Prospects: the same three moves. */
export async function restoreProspects(ids: string[]): Promise<ActionResult<{ restored: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada prospek yang dipilih." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
    .eq("company_id", gate.access.companyId)
    .in("id", unique)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Prospek gagal dipulihkan." }
  PATHS.concat("/workspace/prospects").forEach((path) => revalidatePath(path))
  return { success: true, data: { restored: data?.length ?? 0 } }
}

export async function purgeProspects(ids: string[]): Promise<ActionResult<{ purged: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }
  const unique = validIds(ids)
  if (unique.length === 0) return { success: false, error: "Tidak ada prospek yang dipilih." }
  await removePhotosFor(gate.access, "prospects", unique)
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .delete()
    .eq("company_id", gate.access.companyId)
    .in("id", unique)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Prospek gagal dihapus permanen." }
  PATHS.concat("/workspace/prospects").forEach((path) => revalidatePath(path))
  return { success: true, data: { purged: data?.length ?? 0 } }
}

export async function emptyProspectBin(): Promise<ActionResult<{ purged: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }
  await removePhotosFor(gate.access, "prospects")
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .delete()
    .eq("company_id", gate.access.companyId)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Sampah prospek gagal dikosongkan." }
  PATHS.concat("/workspace/prospects").forEach((path) => revalidatePath(path))
  return { success: true, data: { purged: data?.length ?? 0 } }
}

/**
 * Photos go with the rows they belong to. Read before the delete, since the
 * answers cascade away with the mission or prospect and the files would
 * otherwise stay behind for good. Best effort: a storage hiccup must not
 * stop the purge the admin asked for.
 */
async function removePhotosFor(access: SalesMissionAccess, kind: "missions" | "prospects", ids?: string[]) {
  try {
    const supabase = await createClient()
    const schema = supabase.schema("sales_mission")
    let targets = ids
    if (!targets) {
      const { data } = await schema.from(kind).select("id").eq("company_id", access.companyId).not("deleted_at", "is", null)
      targets = (data ?? []).map((row) => row.id as string)
    }
    const paths = kind === "missions"
      ? await photoPathsForMissions(schema, access.companyId, targets)
      : await photoPathsForProspects(schema, access.companyId, targets)
    await removePhotoFiles(access, paths)
  } catch {
    // The rows still go; an orphaned file is the lesser problem.
  }
}

/** Empty the bin. */
export async function emptyRecycleBin(): Promise<ActionResult<{ purged: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }

  await removePhotosFor(gate.access, "missions")
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("missions")
    .delete()
    .eq("company_id", gate.access.companyId)
    .not("deleted_at", "is", null)
    .select("id")
  if (error) return { success: false, error: "Sampah gagal dikosongkan." }

  PATHS.forEach((path) => revalidatePath(path))
  return { success: true, data: { purged: data?.length ?? 0 } }
}
