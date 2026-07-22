"use server"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/require-permission"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

export type TrashEntity = "lead" | "client_company" | "contact"

/** Read the current trash retention (days). 0 = keep forever. */
export async function getTrashRetentionDays(): Promise<number> {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from("app_settings")
            .select("trash_retention_days")
            .eq("id", 1)
            .maybeSingle()
        return data?.trash_retention_days ?? 30
    } catch {
        return 30
    }
}

/** Update trash retention (days). Super admin only. 0 = keep forever. */
export async function setTrashRetentionDays(days: number): Promise<ActionResult> {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id) return { success: false, error: "Not authenticated" }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const role = (profile?.role ?? "").toLowerCase().replace(/\s+/g, "_")
    if (role !== "super_admin") {
        return { success: false, error: "Only a Super Admin can change retention." }
    }
    const clamped = Math.max(0, Math.min(3650, Math.floor(days || 0)))
    const service = createServiceClient()
    const { error } = await service
        .from("app_settings")
        .update({ trash_retention_days: clamped, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("id", 1)
    if (error) return { success: false, error: error.message }
    await logAuditEvent({
        action: "update",
        resource_type: "app_settings",
        resource_id: "1",
        resource_name: "Trash retention",
        description: `set Recycle Bin retention to ${clamped === 0 ? "keep forever" : clamped + " days"}`,
    })
    revalidatePath("/settings/recycle-bin")
    return { success: true }
}

const TABLE: Record<TrashEntity, string> = {
    lead: "leads",
    client_company: "client_companies",
    contact: "contacts",
}

const LABEL_COL: Record<TrashEntity, string> = {
    lead: "project_name",
    client_company: "name",
    contact: "full_name",
}

export interface TrashItem {
    id: string
    entity: TrashEntity
    label: string
    deleted_at: string
    deleted_by_name: string | null
}

/** Admin/super-admin gate for all Recycle Bin operations. */
async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: ActionResult }> {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id) return { ok: false, error: { success: false, error: "Not authenticated" } }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const role = (profile?.role ?? "").toLowerCase().replace(/\s+/g, "_")
    if (role !== "super_admin" && role !== "admin") {
        return { ok: false, error: { success: false, error: "Only admins can manage the Recycle Bin." } }
    }
    return { ok: true, userId: user.id }
}

/**
 * List trashed items for the three entities. Admin/super-admin only.
 * RLS already restricts trashed-row visibility to admins, but we also gate
 * here for a clean error and to resolve the deleter's name.
 */
export async function listTrash(): Promise<ActionResult<{ items: TrashItem[] }>> {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.error

    const supabase = await createClient()
    const entities: TrashEntity[] = ["lead", "client_company", "contact"]
    const items: TrashItem[] = []

    for (const entity of entities) {
        const { data, error } = await supabase
            .from(TABLE[entity])
            .select(`id, ${LABEL_COL[entity]}, deleted_at, deleter:profiles!deleted_by(full_name)`)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
        if (error) return { success: false, error: error.message }
        for (const row of ((data ?? []) as unknown as Record<string, unknown>[])) {
            items.push({
                id: String(row.id),
                entity,
                label: (row[LABEL_COL[entity]] as string) || "(untitled)",
                deleted_at: row.deleted_at as string,
                deleted_by_name: (row.deleter as { full_name: string | null } | null)?.full_name ?? null,
            })
        }
    }

    items.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1))
    return { success: true, data: { items } }
}

/** Restore a trashed item (clear deleted_at). Admin/super-admin only. */
export async function restoreTrashItem(entity: TrashEntity, id: string): Promise<ActionResult> {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.error

    const supabase = await createClient()
    const { error } = await supabase
        .from(TABLE[entity])
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", id)
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "restore",
        resource_type: entity,
        resource_id: id,
        description: `restored ${entity.replace("_", " ")} from the Recycle Bin`,
    })
    revalidatePath("/settings/recycle-bin")
    revalidatePath("/leads")
    revalidatePath("/companies")
    revalidatePath("/contacts")
    return { success: true }
}

/** Permanently delete a trashed item. Admin/super-admin only. */
export async function purgeTrashItem(entity: TrashEntity, id: string): Promise<ActionResult> {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.error

    // Service client: RLS allows admin DELETE, but use service for a clean,
    // predictable permanent removal regardless of row-scope edge cases.
    const service = createServiceClient()
    const { error } = await service.from(TABLE[entity]).delete().eq("id", id).not("deleted_at", "is", null)
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "purge",
        resource_type: entity,
        resource_id: id,
        description: `permanently deleted ${entity.replace("_", " ")} from the Recycle Bin`,
    })
    revalidatePath("/settings/recycle-bin")
    return { success: true }
}

/**
 * Auto-purge trashed items older than the configured retention period.
 * Admin/super-admin only. Returns the number purged per entity.
 * `trash_retention_days = 0` means keep forever (no auto purge).
 */
export async function purgeExpiredTrash(): Promise<ActionResult<{ purged: number }>> {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.error

    const supabase = await createClient()
    const { data: settings } = await supabase
        .from("app_settings")
        .select("trash_retention_days")
        .eq("id", 1)
        .maybeSingle()
    const days = settings?.trash_retention_days ?? 0
    if (!days || days <= 0) return { success: true, data: { purged: 0 } }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const service = createServiceClient()
    let purged = 0
    for (const table of Object.values(TABLE)) {
        const { data, error } = await service
            .from(table)
            .delete()
            .not("deleted_at", "is", null)
            .lt("deleted_at", cutoff)
            .select("id")
        if (error) return { success: false, error: error.message }
        purged += data?.length ?? 0
    }

    if (purged > 0) {
        await logAuditEvent({
            action: "purge",
            resource_type: "app_settings",
            resource_id: "1",
            description: `auto-purged ${purged} item(s) past the ${days}-day retention window`,
            metadata: { purged, days },
        })
    }
    revalidatePath("/settings/recycle-bin")
    return { success: true, data: { purged } }
}
