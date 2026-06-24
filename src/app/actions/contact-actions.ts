"use server"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/require-permission"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

/**
 * Guarded write operations for contacts.
 *
 * RLS is the true security boundary (see migration
 * 20260624050000_enforce_matrix_on_companies_contacts.sql). These actions add
 * a server-side permission check so the UI gets a clean, explicit error
 * instead of a raw RLS rejection, and so writes can't be triggered without the
 * `contacts` matrix grant even via a hand-crafted request.
 */

export async function createContactAction(
    payload: Record<string, unknown>,
    selectFields = "id",
): Promise<ActionResult<{ id: string; row: unknown }>> {
    const guard = await requirePermission("contacts", "create", (payload.company_id as string) ?? undefined)
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("contacts")
        .insert(payload)
        .select(selectFields)
        .single()
    if (error) return { success: false, error: error.message }

    const id = (data as unknown as { id: string }).id
    await logAuditEvent({
        action: "create",
        resource_type: "contact",
        resource_id: id,
        resource_name: (payload.full_name as string) ?? undefined,
        description: `created contact "${payload.full_name ?? id}"`,
    })
    revalidatePath("/contacts")
    return { success: true, data: { id, row: data } }
}

export async function updateContactAction(
    id: string,
    payload: Record<string, unknown>,
    selectFields = "id",
): Promise<ActionResult<{ row: unknown }>> {
    const guard = await requirePermission("contacts", "update", (payload.company_id as string) ?? undefined)
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", id)
        .select(selectFields)
        .single()
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "update",
        resource_type: "contact",
        resource_id: id,
        resource_name: (payload.full_name as string) ?? undefined,
        description: `updated contact ${payload.full_name ?? id}`,
    })
    revalidatePath("/contacts")
    return { success: true, data: { row: data } }
}

export async function deleteContactsAction(
    ids: string[],
): Promise<ActionResult> {
    const guard = await requirePermission("contacts", "delete")
    if (!guard.allowed) return guard.error
    if (!ids.length) return { success: true }

    const supabase = await createClient()
    const { error } = await supabase.from("contacts").delete().in("id", ids)
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "delete",
        resource_type: "contact",
        resource_id: ids.length === 1 ? ids[0] : undefined,
        description: `deleted ${ids.length} contact${ids.length === 1 ? "" : "s"}`,
        metadata: { ids },
    })
    revalidatePath("/contacts")
    return { success: true }
}
