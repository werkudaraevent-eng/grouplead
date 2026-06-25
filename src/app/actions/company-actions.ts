"use server"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
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

    const readClient = await createClient()
    const { data: rows, error: readError } = await readClient
        .from("client_companies")
        .select("id, company_id")
        .in("id", ids)
    if (readError) return { success: false, error: readError.message }

    const foundIds = new Set((rows ?? []).map(row => row.id as string))
    const missingIds = ids.filter(id => !foundIds.has(id))
    if (missingIds.length > 0) {
        return { success: false, error: "Some companies were not found or are not accessible" }
    }

    const scopedCompanyId = guard.companyId
    const canWriteAllCompanies = await (async () => {
        if (!scopedCompanyId) return false
        const { data } = await readClient
            .from("companies")
            .select("is_holding")
            .eq("id", scopedCompanyId)
            .maybeSingle()
        return data?.is_holding === true
    })()

    if (!canWriteAllCompanies) {
        const forbidden = (rows ?? []).some(row => {
            const rowCompanyId = row.company_id as string | null
            return rowCompanyId !== null && rowCompanyId !== scopedCompanyId
        })
        if (forbidden) {
            return { success: false, error: "Forbidden: company belongs to another business unit" }
        }
    }

    const supabase = createServiceClient()
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
