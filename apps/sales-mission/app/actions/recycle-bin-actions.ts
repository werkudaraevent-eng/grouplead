"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess, type SalesMissionAccess } from "@/lib/sales-mission-access"
import type { ActionResult } from "@/types/action-result"

const PATHS = ["/workspace", "/workspace/missions", "/workspace/calendar", "/workspace/settings/recycle-bin", "/workspace/settings/data"]

/**
 * Only an admin (the settings grant) or a super admin touches the bin: the
 * mission module's own `delete` grant lets a person put things in, not take
 * them out or destroy them.
 */
async function requireBinAdmin(): Promise<{ access: SalesMissionAccess } | { error: string }> {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." }
  if (access.isSuperAdmin || (await canPerform(access, "sales_mission_settings", "update"))) return { access }
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

/** Empty the bin. */
export async function emptyRecycleBin(): Promise<ActionResult<{ purged: number }>> {
  const gate = await requireBinAdmin()
  if ("error" in gate) return { success: false, error: gate.error }

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
