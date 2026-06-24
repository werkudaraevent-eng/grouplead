"use server"

import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/require-permission"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

/**
 * Guarded write operations for client companies.
 *
 * RLS is the true security boundary (see migration
 * 20260624050000_enforce_matrix_on_companies_contacts.sql). These actions add
 * a server-side permission check so the UI gets a clean, explicit error
 * instead of a raw RLS rejection, and so writes can't be triggered without the
 * `companies` matrix grant even via a hand-crafted request.
 */

export async function createClientCompanyAction(
    payload: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
    const guard = await requirePermission("companies", "create", (payload.company_id as string) ?? undefined)
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("client_companies")
        .insert(payload)
        .select("id")
        .single()
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "create",
        resource_type: "client_company",
        resource_id: data.id,
        resource_name: (payload.name as string) ?? undefined,
        description: `created client company "${payload.name ?? data.id}"`,
    })
    revalidatePath("/companies")
    return { success: true, data: { id: data.id } }
}

export async function updateClientCompanyAction(
    id: string,
    payload: Record<string, unknown>,
): Promise<ActionResult> {
    const guard = await requirePermission("companies", "update", (payload.company_id as string) ?? undefined)
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { error } = await supabase.from("client_companies").update(payload).eq("id", id)
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "update",
        resource_type: "client_company",
        resource_id: id,
        resource_name: (payload.name as string) ?? undefined,
        description: `updated client company ${payload.name ?? id}`,
    })
    revalidatePath("/companies")
    return { success: true }
}

export async function deleteClientCompaniesAction(
    ids: string[],
): Promise<ActionResult> {
    const guard = await requirePermission("companies", "delete")
    if (!guard.allowed) return guard.error
    if (!ids.length) return { success: true }

    const supabase = await createClient()
    // Soft delete: move to the Recycle Bin instead of removing permanently.
    const { error } = await supabase
        .from("client_companies")
        .update({ deleted_at: new Date().toISOString(), deleted_by: guard.userId })
        .in("id", ids)
    if (error) return { success: false, error: error.message }

    await logAuditEvent({
        action: "archive",
        resource_type: "client_company",
        resource_id: ids.length === 1 ? ids[0] : undefined,
        description: `moved ${ids.length} client compan${ids.length === 1 ? "y" : "ies"} to the Recycle Bin`,
        metadata: { ids },
    })
    revalidatePath("/companies")
    return { success: true }
}
