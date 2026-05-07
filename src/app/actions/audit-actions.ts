"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export interface AuditLogEntry {
    action: string
    resource_type: string
    resource_id?: string
    resource_name?: string
    description: string
    metadata?: Record<string, unknown>
}

/**
 * Log an audit event. Called from other server actions after mutations.
 */
export async function logAuditEvent(entry: AuditLogEntry) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get user name
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single()

        await supabase.from("audit_logs").insert({
            user_id: user.id,
            user_name: profile?.full_name || user.email || "Unknown",
            action: entry.action,
            resource_type: entry.resource_type,
            resource_id: entry.resource_id || null,
            resource_name: entry.resource_name || null,
            description: entry.description,
            metadata: entry.metadata || {},
        })
    } catch {
        // Audit logging should never break the main flow
        console.warn("[audit] Failed to log event:", entry.description)
    }
}

export interface AuditLogRow {
    id: string
    created_at: string
    user_id: string | null
    user_name: string | null
    action: string
    resource_type: string
    resource_id: string | null
    resource_name: string | null
    description: string
    metadata: Record<string, unknown>
}

export interface FetchAuditLogsResult {
    data: AuditLogRow[]
    total: number
}

/**
 * Fetch audit logs with pagination and filters.
 */
export async function fetchAuditLogs(opts: {
    page?: number
    pageSize?: number
    action?: string
    resource_type?: string
    user_id?: string
    search?: string
}): Promise<FetchAuditLogsResult> {
    const supabase = await createClient()
    const page = opts.page || 1
    const pageSize = opts.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to)

    if (opts.action) query = query.eq("action", opts.action)
    if (opts.resource_type) query = query.eq("resource_type", opts.resource_type)
    if (opts.user_id) query = query.eq("user_id", opts.user_id)
    if (opts.search) query = query.ilike("description", `%${opts.search}%`)

    const { data, count, error } = await query

    if (error) {
        console.error("[audit] Fetch error:", error.message)
        return { data: [], total: 0 }
    }

    return { data: (data as AuditLogRow[]) || [], total: count || 0 }
}

/**
 * Get audit log visibility setting.
 */
export async function getAuditVisibility(): Promise<"all_users" | "admin_only"> {
    const supabase = await createClient()
    const { data } = await supabase
        .from("master_options")
        .select("value")
        .eq("option_type", "system_settings")
        .eq("label", "audit_log_visibility")
        .single()

    return (data?.value as "all_users" | "admin_only") || "all_users"
}

/**
 * Update audit log visibility setting (admin only).
 */
export async function updateAuditVisibility(value: "all_users" | "admin_only") {
    const supabase = await createClient()
    const { error } = await supabase
        .from("master_options")
        .update({ value })
        .eq("option_type", "system_settings")
        .eq("label", "audit_log_visibility")

    if (error) throw new Error(error.message)
    revalidatePath("/settings")
}
