"use server"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/require-permission"

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
        const service = createServiceClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get user name
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single()

        const { error } = await service.from("audit_logs").insert({
            user_id: user.id,
            user_name: profile?.full_name || user.email || "Unknown",
            action: entry.action,
            resource_type: entry.resource_type,
            resource_id: entry.resource_id || null,
            resource_name: entry.resource_name || null,
            description: entry.description,
            metadata: entry.metadata || {},
        })
        if (error) throw error
    } catch (err) {
        // Audit logging should never break the main flow
        console.warn("[audit] Failed to log event:", entry.description, err)
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
    // The trail names people and shows what they did, so it is read behind
    // the Settings grant, the same gate as the page under /settings.
    const guard = await requirePermission("settings", "read")
    if (!guard.allowed) return { data: [], total: 0 }

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
