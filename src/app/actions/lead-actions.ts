"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { smartCaseRow } from "@/utils/smart-title-case"
import { parseSmartEventDates } from "@/utils/smart-date-parser"
import { coerceDateToISO, normalizeTaxonomicValue, coerceNumber } from "@/features/leads/lib/import-normalize"
import { computeMonthEvent } from "@/features/leads/lib/compute-month-event"
import { resolvePicSales, type ProfileLite } from "@/features/leads/lib/resolve-pic-sales"
import { parseDestinations } from "@/features/leads/lib/parse-destinations"
import { buildStageTransitionAuditEntries } from "@/features/leads/lib/stage-transition-audit"
import { computeAccountStatus } from "@/features/leads/lib/compute-account-status"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { requirePermission } from "@/lib/require-permission"
import type { ActionResult } from "@/types"

// ── Column Whitelist: ONLY these keys are physical columns on the `leads` table ──
const LEADS_COLUMNS = new Set([
    "category", "event_date_start", "project_name", "grade_lead", "stream_type",
    "business_purpose", "tipe", "pax_count", "nationality", "status",
    "cancel_lost_reason", "date_cancel_lost", "month_cancel_lost", "sector",
    "line_industry", "area", "is_qualified", "lead_source", "referral_source",
    "estimated_value", "remark", "company_id", "client_company_id", "contact_id",
    "pic_sales_id", "account_manager_id", "pipeline_stage_id", "event_date_end",
    "actual_value", "event_format", "target_close_date", "received_date", "description",
    "virtual_platform", "main_stream", "destinations", "pipeline_id",
    "custom_data", "general_brief", "production_sow", "special_remarks", "event_dates", "month_event",
    "kanban_sort_order", "lost_reason", "lost_reason_details",
    "closed_won_date", "closed_lost_date",
    "account_status", "account_status_source"
])

// ── Blocklist: relational join objects that come from Supabase `.select('*, relation(…)')` ──
const RELATIONAL_KEYS = new Set([
    "client_company", "contact", "pipeline_stage", "pic_sales_profile",
    "account_manager_profile", "pipeline", "assigned_role", "stage",
])

function sanitizePayload(data: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(data)) {
        // Skip undefined values
        if (val === undefined) continue
        // Skip relational join objects
        if (RELATIONAL_KEYS.has(key)) continue
        // Skip auto-managed columns
        if (key === "id" || key === "created_at" || key === "updated_at" || key === "manual_id") continue
        // Only allow physical DB columns
        if (!LEADS_COLUMNS.has(key)) continue
        // Convert empty strings to null
        clean[key] = val === "" ? null : val
    }
    return clean
}

export async function createLeadAction(
    data: Record<string, unknown>
): Promise<ActionResult<{ id: number }>> {
    try {
        const guard = await requirePermission('leads', 'create')
        if (!guard.allowed) return guard.error

        const supabase = await createClient()
        const payload = sanitizePayload(data)

        // Auto-assign default pipeline stage if not provided
        if (!payload.pipeline_stage_id) {
            let stageQuery = supabase
                .from("pipeline_stages")
                .select("id")
                .order("sort_order", { ascending: true })
                .limit(1)

            // Scope to the pipeline if provided
            if (payload.pipeline_id) {
                stageQuery = stageQuery.eq("pipeline_id", payload.pipeline_id as string)
            } else {
                stageQuery = stageQuery.eq("is_default", true)
            }

            const { data: defaultStage } = await stageQuery.single()
            if (defaultStage) {
                payload.pipeline_stage_id = defaultStage.id
            }
        }

        // Assign kanban_sort_order if not provided — place above current top
        // of the target stage so newly created leads always appear on top.
        // This beats the DB default (epoch now) which drifts below
        // previously-dragged cards.
        if (payload.kanban_sort_order == null && payload.pipeline_stage_id) {
            const { data: topLead } = await supabase
                .from("leads")
                .select("kanban_sort_order")
                .eq("pipeline_stage_id", payload.pipeline_stage_id as string)
                .order("kanban_sort_order", { ascending: false, nullsFirst: false })
                .limit(1)
                .maybeSingle()
            const currentMax = topLead?.kanban_sort_order ?? Date.now() / 1000
            payload.kanban_sort_order = Number(currentMax) + 1000
        }

        // Compute account_status if not provided. We mark the source as
        // "computed" so the UI can show an "Auto-detected" hint and so a
        // future recompute job can tell which rows were system-derived.
        if (
            (payload.account_status === undefined || payload.account_status === null) &&
            payload.client_company_id
        ) {
            const computation = await computeAccountStatus(
                supabase,
                payload.client_company_id as string,
            )
            payload.account_status = computation.value
            payload.account_status_source = "computed"
        } else if (payload.account_status && !payload.account_status_source) {
            // User explicitly set a value through the form — record it as
            // manual so subsequent UI affordances reflect that.
            payload.account_status_source = "manual"
        }

        const { data: newLead, error } = await supabase
            .from("leads")
            .insert(payload)
            .select("id")
            .single()
        if (error) return { success: false, error: error.message }

        // Log creation activity
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from("lead_activities").insert({
            lead_id: newLead.id,
            user_id: user?.id ?? null,
            action_type: "Create",
            description: "Lead created",
        })

        // Audit log — await so the insert is durable before the action
        // returns; unawaited promises can be cancelled mid-flight.
        await logAuditEvent({
            action: "create",
            resource_type: "lead",
            resource_id: String(newLead.id),
            resource_name: (payload.project_name as string) || "Untitled",
            description: `created lead "${payload.project_name || 'Untitled'}"`,
        })

        revalidatePath("/", "layout")
        revalidatePath("/leads")
        return { success: true, data: { id: newLead.id } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function updateLeadAction(
    leadId: number,
    data: Record<string, unknown>
): Promise<ActionResult> {
    try {
        const guard = await requirePermission('leads', 'update')
        if (!guard.allowed) return guard.error

        const supabase = await createClient()
        const payload = sanitizePayload(data)

        // If the user touched account_status from a UI form, mark the source
        // as "manual" so future recompute jobs leave their value alone.
        // Callers that explicitly want to preserve a 'computed' source must
        // pass account_status_source themselves.
        if (
            payload.account_status !== undefined &&
            payload.account_status_source === undefined
        ) {
            payload.account_status_source = "manual"
        }

        // ── Post-Win Adjustment Hook ──
        // Before applying updates to a Closed Won lead, check if any
        // reporting-critical fields are being modified
        const { data: currentLead } = await supabase
            .from("leads")
            .select("*, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
            .eq("id", leadId)
            .single()

        if (currentLead) {
            const stage = currentLead.pipeline_stage as unknown as { closed_status: string } | null
            const isClosedWon = stage?.closed_status === "won"

            if (isClosedWon) {
                // Fetch goal_settings for the lead's company to get critical fields list
                const { data: goalSettings } = await supabase
                    .from("goal_settings")
                    .select("reporting_critical_fields")
                    .eq("company_id", currentLead.company_id)
                    .single()

                const criticalFields = goalSettings?.reporting_critical_fields ?? [
                    "actual_value", "event_date_start", "event_date_end",
                    "project_name", "company_id", "pic_sales_id"
                ]

                const { detectCriticalFieldChange } = await import(
                    "@/features/goals/lib/adjustment-detection"
                )

                const changes = detectCriticalFieldChange(currentLead, payload, criticalFields)

                if (changes) {
                    const { data: { user } } = await supabase.auth.getUser()

                    // Check if the lead's attributed date falls in a closed period
                    let affectsClosedPeriod = false
                    const { data: closedPeriods } = await supabase
                        .from("goal_periods")
                        .select("id, start_date, end_date")
                        .eq("company_id", currentLead.company_id)
                        .eq("status", "closed")

                    if (closedPeriods && closedPeriods.length > 0) {
                        const eventDate = currentLead.event_date_end ?? currentLead.event_date_start
                        if (eventDate) {
                            const dateStr = typeof eventDate === "string" ? eventDate : String(eventDate)
                            affectsClosedPeriod = closedPeriods.some(
                                (p) => dateStr >= p.start_date && dateStr <= p.end_date
                            )
                        }
                    }

                    // Insert post_win_adjustments records
                    const adjustmentRows = changes.map((change) => ({
                        company_id: currentLead.company_id,
                        lead_id: leadId,
                        field_name: change.field_name,
                        old_value: change.old_value,
                        new_value: change.new_value,
                        changed_by: user?.id ?? "",
                        affects_closed_period: affectsClosedPeriod,
                    }))

                    await supabase.from("post_win_adjustments").insert(adjustmentRows)
                }
            }
        }

        const { error } = await supabase
            .from("leads")
            .update(payload)
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        // Audit log — await so the insert is durable before the
        // action returns and the request lifecycle ends.
        await logAuditEvent({
            action: "update",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: currentLead?.project_name || "",
            description: `updated lead "${currentLead?.project_name || leadId}"`,
            metadata: { fields: Object.keys(payload) },
        })

        revalidatePath("/", "layout")
        revalidatePath("/leads")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function updatePipelineStageAction(
    leadId: number,
    stageId: string,
    sortOrder?: number,
    options?: { closedDate?: string | null }
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const [
            { data: leadRow, error: leadError },
            { data: stageRow, error: stageError },
            { data: authData },
        ] = await Promise.all([
            supabase
                .from("leads")
                .select("estimated_value, project_name, pipeline_stage:pipeline_stages!pipeline_stage_id(name)")
                .eq("id", leadId)
                .single(),
            supabase
                .from("pipeline_stages")
                .select("id, name, closed_status")
                .eq("id", stageId)
                .single(),
            supabase.auth.getUser(),
        ])

        if (leadError) return { success: false, error: leadError.message }
        if (stageError) return { success: false, error: stageError.message }

        const user = authData.user
        let userName = "System"

        if (user?.id) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single()
            if (profile?.full_name) userName = profile.full_name
        }

        const now = new Date().toISOString()
        const payload: Record<string, unknown> = {
            pipeline_stage_id: stageId,
            status: stageRow.name,
            updated_at: now,
        }
        if (sortOrder !== undefined) {
            payload.kanban_sort_order = sortOrder
        }

        // Auto-stamp closed dates when transitioning to Won or Lost.
        // If the caller supplies an explicit closed date (e.g. a transition
        // prompt where the user picks the actual won/lost date), honor it.
        const closedStatus = (stageRow as any).closed_status as string | null
        const explicitClosedDate = options?.closedDate ?? null
        const resolvedClosedDate = explicitClosedDate ? new Date(explicitClosedDate).toISOString() : now
        if (closedStatus === "won") {
            payload.closed_won_date = resolvedClosedDate
            payload.closed_lost_date = null  // clear if previously lost
        } else if (closedStatus === "lost") {
            payload.closed_lost_date = resolvedClosedDate
            payload.closed_won_date = null  // clear if previously won
        } else {
            // Reopened — clear both closed dates
            payload.closed_won_date = null
            payload.closed_lost_date = null
        }

        const { error } = await supabase
            .from("leads")
            .update(payload)
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        const auditEntries = buildStageTransitionAuditEntries({
            leadId,
            newStageId: stageRow.id,
            newStageName: stageRow.name,
            previousStageName: (leadRow.pipeline_stage as unknown as { name: string } | null)?.name ?? null,
            userId: user?.id ?? null,
            userName,
            amount: leadRow.estimated_value ?? null,
        })

        const { error: stageHistoryError } = await supabase
            .from("lead_stage_history")
            .insert(auditEntries.stageHistoryEntry)

        if (stageHistoryError) return { success: false, error: stageHistoryError.message }

        const { error: activityError } = await supabase
            .from("lead_activities")
            .insert(auditEntries.activityEntry)

        if (activityError) return { success: false, error: activityError.message }

        // Audit log — must await so the row lands before the server
        // action returns; otherwise Next.js can drop the unawaited insert.
        const prevStage = (leadRow.pipeline_stage as unknown as { name: string } | null)?.name ?? "Unknown"
        const leadProjectName = (leadRow as { project_name?: string | null }).project_name ?? ""
        await logAuditEvent({
            action: "stage_change",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: leadProjectName,
            description: `moved lead${leadProjectName ? ` "${leadProjectName}"` : ""} from "${prevStage}" to "${stageRow.name}"`,
            metadata: { from: prevStage, to: stageRow.name },
        })

        revalidatePath("/", "layout")
        revalidatePath("/leads")
        revalidatePath(`/leads/${leadId}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function deleteLeadAction(
    leadId: number
): Promise<ActionResult> {
    try {
        const guard = await requirePermission('leads', 'delete')
        if (!guard.allowed) return guard.error

        const supabase = await createClient()

        // Get lead name before deleting
        const { data: leadData } = await supabase
            .from("leads")
            .select("project_name")
            .eq("id", leadId)
            .single()

        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        // Audit log — await so the insert is durable before the action
        // returns; unawaited promises can be cancelled mid-flight.
        await logAuditEvent({
            action: "delete",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: leadData?.project_name || "",
            description: `deleted lead "${leadData?.project_name || leadId}"`,
        })

        revalidatePath("/", "layout")
        revalidatePath("/leads")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function bulkDeleteLeadsAction(
    leadIds: number[]
): Promise<ActionResult<{ deleted: number }>> {
    try {
        const guard = await requirePermission('leads', 'delete')
        if (!guard.allowed) return guard.error

        const ids = Array.from(new Set(leadIds.filter((id) => Number.isFinite(id))))
        if (ids.length === 0) return { success: false, error: "No leads selected" }

        const supabase = await createClient()

        const { data: leadData, error: fetchError } = await supabase
            .from("leads")
            .select("id, project_name")
            .in("id", ids)

        if (fetchError) return { success: false, error: fetchError.message }

        const { error } = await supabase
            .from("leads")
            .delete()
            .in("id", ids)

        if (error) return { success: false, error: error.message }

        for (const lead of leadData ?? []) {
            await logAuditEvent({
                action: "delete",
                resource_type: "lead",
                resource_id: String(lead.id),
                resource_name: lead.project_name || "",
                description: `deleted lead "${lead.project_name || lead.id}"`,
            })
        }

        revalidatePath("/", "layout")
        revalidatePath("/leads")
        return { success: true, data: { deleted: leadData?.length ?? ids.length } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export type ImportResult = {
    success: number
    failed: number
    /** Hard failures — these rows did NOT get inserted. */
    errors: string[]
    /** Soft notes — row was inserted but something was auto-corrected
     *  (PIC fuzzy-matched, taxonomic value coerced, stage defaulted, ...).*/
    warnings: string[]
}

/** Build a human-readable row label for log messages. */
function rowLabel(i: number, raw: Record<string, unknown>): string {
    const name = typeof raw.project_name === "string" ? raw.project_name.trim() : ""
    return name ? `Row ${i + 1} (${name})` : `Row ${i + 1}`
}

export async function importLeadsAction(
    rows: Record<string, unknown>[]
): Promise<ImportResult> {
    const guard = await requirePermission('leads', 'create')
    if (!guard.allowed) {
        return {
            success: 0,
            failed: rows.length,
            errors: [guard.error.error ?? 'Forbidden'],
            warnings: [],
        }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    let success = 0
    let failed = 0
    const errors: string[] = []
    const warnings: string[] = []

    // Pre-fetch lookup tables (same as standard import)

    // Pre-fetch lookup tables for name → ID resolution
    const { data: allCompanies } = await supabase
        .from("client_companies")
        .select("id, name")
        .order("name")

    const { data: allContacts } = await supabase
        .from("contacts")
        .select("id, full_name, client_company_id")
        .order("full_name")

    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name")

    // Pre-fetch subsidiaries (companies table, not client_companies)
    const { data: allSubsidiaries } = await supabase
        .from("companies")
        .select("id, name, slug")
        .order("name")

    // Pre-fetch pipeline stages
    const { data: allStages } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id")
        .order("sort_order")

    // Pre-fetch taxonomic master options
    const { data: allMasterOptions } = await supabase
        .from("master_options")
        .select("option_type, value")
        .eq("is_active", true)

    // Build lookup maps (case-insensitive)
    const companyMap = new Map<string, string>()
    for (const c of allCompanies ?? []) {
        companyMap.set(c.name.toLowerCase().trim(), c.id)
    }

    const contactMap = new Map<string, { id: string; client_company_id: string | null }>()
    for (const c of allContacts ?? []) {
        contactMap.set(c.full_name.toLowerCase().trim(), { id: c.id, client_company_id: c.client_company_id })
    }

    const profileMap = new Map<string, string>()
    for (const p of allProfiles ?? []) {
        if (p.full_name) profileMap.set(p.full_name.toLowerCase().trim(), p.id)
    }

    const subsidiaryMap = new Map<string, string>()
    for (const s of allSubsidiaries ?? []) {
        subsidiaryMap.set(s.name.toLowerCase().trim(), s.id)
        subsidiaryMap.set(s.slug.toLowerCase().trim(), s.id) // also match by slug
    }

    // Build stage lookup: "stageName|pipelineId" → stageId.
    // IMPORTANT: pipeline-scoped only. We deliberately do NOT store a fallback
    // entry without the pipeline scope — a stage with the same name in another
    // pipeline must never satisfy a lookup for the target pipeline. Allowing
    // that caused the 2026-05-17 bug where 140 historical leads imported into
    // "Group Lead 2025" got assigned stage IDs from "Group Lead 2026".
    const stageMap = new Map<string, string>()
    for (const s of allStages ?? []) {
        stageMap.set(`${s.name.toLowerCase().trim()}|${s.pipeline_id}`, s.id)
    }

    // Build option map: "option_type|lowercase_value" -> "exact_value"
    const optionMap = new Map<string, string>()
    for (const opt of allMasterOptions ?? []) {
        if (opt?.value) {
            optionMap.set(`${opt.option_type}|${opt.value.toLowerCase().trim()}`, opt.value)
        }
    }

    // Resolve the company-wide event cut-off day for revenue recognition.
    // Falls back to 25 (matches the default in lead-form.tsx). Using `any`
    // shape here because system_setting rows store the day as `value` text.
    const cutoffOpt = (allMasterOptions ?? []).find(
        (o) => (o as { option_type?: string; label?: string }).option_type === "system_setting" &&
            (o as { label?: string }).label === "event_cutoff_date",
    )
    const eventCutoffDay = (() => {
        const raw = (cutoffOpt as { value?: string } | undefined)?.value
        const n = raw ? parseInt(raw, 10) : NaN
        return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 25
    })()

    // Pre-fetch default stage per pipeline
    const stageCache = new Map<string, string>()

    for (let i = 0; i < rows.length; i++) {
        try {
            const raw = smartCaseRow({ ...rows[i] }) as Record<string, unknown>

            // ── Resolve Subsidiary / Business Unit name → company_id ──
            const subsidiaryName = raw.subsidiary_name as string | undefined
            if (subsidiaryName && String(subsidiaryName).trim()) {
                const subId = subsidiaryMap.get(String(subsidiaryName).toLowerCase().trim())
                if (subId) {
                    raw.company_id = subId
                } else {
                    failed++
                    errors.push(`${rowLabel(i, raw)}: Subsidiary "${subsidiaryName}" not found — lead skipped`)
                    delete raw.subsidiary_name
                    continue
                }
            }
            delete raw.subsidiary_name

            // ── Resolve Pipeline Stage name → pipeline_stage_id ──
            // Pipeline-scoped only. Never fall back to an unscoped match — a
            // stage from a different pipeline would let DB writes succeed but
            // produce cross-pipeline stage_id, which breaks kanban visibility
            // and dashboard counts.
            const stageName = raw.pipeline_stage_name as string | undefined
            if (stageName && String(stageName).trim()) {
                const sNameKey = String(stageName).toLowerCase().trim()
                const pipelineId = raw.pipeline_id as string | undefined
                const stageId = pipelineId ? stageMap.get(`${sNameKey}|${pipelineId}`) : undefined
                if (stageId) {
                    raw.pipeline_stage_id = stageId
                } else {
                    warnings.push(`${rowLabel(i, raw)}: Stage "${stageName}" not found — default stage applied`)
                }
            } else if (!raw.pipeline_stage_id && raw.pipeline_id) {
                // No stage name mapped — auto-derive from closed dates so a
                // recap row tagged LOST/CANCELLED/TURNDOWN with DATE CXL/LOST
                // filled lands in the right closed bucket instead of the
                // default Open stage.
                const pipelineId = raw.pipeline_id as string
                if (raw.closed_won_date) {
                    const wonStageId =
                        stageMap.get(`closed won|${pipelineId}`) ||
                        stageMap.get(`won|${pipelineId}`)
                    if (wonStageId) raw.pipeline_stage_id = wonStageId
                } else if (raw.closed_lost_date) {
                    const lostStageId =
                        stageMap.get(`closed lost|${pipelineId}`) ||
                        stageMap.get(`lost|${pipelineId}`) ||
                        stageMap.get(`closed turndown|${pipelineId}`)
                    if (lostStageId) raw.pipeline_stage_id = lostStageId
                }
            }
            delete raw.pipeline_stage_name

            // ── Resolve Client Company name → ID (auto-create if new) ──
            const clientCompanyName = raw.client_company_name as string | undefined
            if (clientCompanyName && String(clientCompanyName).trim()) {
                const nameKey = String(clientCompanyName).toLowerCase().trim()
                let companyId = companyMap.get(nameKey)
                if (!companyId) {
                    // Auto-create the client company
                    const { data: newCompany, error: compErr } = await supabase
                        .from("client_companies")
                        .insert({ name: String(clientCompanyName).trim() })
                        .select("id")
                        .single()
                    if (newCompany && !compErr) {
                        companyId = newCompany.id
                        companyMap.set(nameKey, newCompany.id) // cache for subsequent rows
                    } else {
                        errors.push(`${rowLabel(i, raw)}: Failed to create company "${clientCompanyName}" — ${compErr?.message}`)
                    }
                }
                if (companyId) raw.client_company_id = companyId
            }
            delete raw.client_company_name

            // ── Resolve Contact Person name → ID (auto-create if new) ──
            const contactName = raw.contact_name as string | undefined
            if (contactName && String(contactName).trim()) {
                const nameKey = String(contactName).toLowerCase().trim()
                const contact = contactMap.get(nameKey)
                if (contact) {
                    raw.contact_id = contact.id
                    if (!raw.client_company_id && contact.client_company_id) {
                        raw.client_company_id = contact.client_company_id
                    }
                } else {
                    // Auto-create the contact, linked to client_company if available
                    const contactPayload: Record<string, unknown> = {
                        full_name: String(contactName).trim(),
                    }
                    if (raw.client_company_id) {
                        contactPayload.client_company_id = raw.client_company_id
                    }
                    const { data: newContact, error: cErr } = await supabase
                        .from("contacts")
                        .insert(contactPayload)
                        .select("id")
                        .single()
                    if (newContact && !cErr) {
                        raw.contact_id = newContact.id
                        contactMap.set(nameKey, {
                            id: newContact.id,
                            client_company_id: (raw.client_company_id as string) || null,
                        })
                    } else {
                        errors.push(`${rowLabel(i, raw)}: Failed to create contact "${contactName}" — ${cErr?.message}`)
                    }
                }
            }
            delete raw.contact_name

            // ── Resolve PIC Sales name → ID ──
            // Werkudara recap usually only has first names ("ADIEL", "MITHA")
            // while profiles store full names. Use the fuzzy resolver so
            // imports don't all land as Unassigned.
            const picSalesName = raw.pic_sales_name as string | undefined
            if (picSalesName && String(picSalesName).trim()) {
                const match = resolvePicSales(
                    String(picSalesName),
                    (allProfiles ?? []) as ProfileLite[],
                )
                if (match) {
                    raw.pic_sales_id = match.id
                    if (match.matched !== "exact") {
                        warnings.push(
                            `${rowLabel(i, raw)}: PIC Sales "${picSalesName}" matched to "${match.via}" (${match.matched}, ${Math.round(match.confidence * 100)}%)`,
                        )
                    }
                } else {
                    warnings.push(`${rowLabel(i, raw)}: PIC Sales "${picSalesName}" not found — lead will be Unassigned`)
                }
            }
            delete raw.pic_sales_name

            // ── Validate and Auto-Correct Taxonomic Fields against Master Options ──
            // Soft matching: exact → collapsed-whitespace → fuzzy (Dice).
            // Mismatches no longer kill the row — we keep the raw value and
            // surface a warning so the user can clean up master_options later.
            const taxonomicFields = [
                "category", "grade_lead", "lead_source",
                "main_stream", "stream_type", "business_purpose", "event_format",
                "area", "lost_reason",
            ]
            for (const field of taxonomicFields) {
                if (raw[field] && typeof raw[field] === "string") {
                    const result = normalizeTaxonomicValue(field, raw[field] as string, optionMap)
                    raw[field] = result.value
                    if (result.warning) {
                        warnings.push(`${rowLabel(i, raw)}: ${result.warning}`)
                    }
                }
            }

            // ── Coerce target_close_date (accepts Excel serials and ISO) ──
            if (raw.target_close_date != null && raw.target_close_date !== "") {
                const iso = coerceDateToISO(raw.target_close_date)
                if (iso) raw.target_close_date = iso
                else delete raw.target_close_date
            }

            // ── Coerce closed dates (Excel serials + ISO + DD-MMM-YY) ──
            // Standard imports increasingly carry closed_won/lost dates and
            // their reason — the recap rows tagged LOST/POSTPONED/CANCELLED
            // come with DATE CXL/LOST already filled. If a value can't be
            // coerced into a real date (e.g. a name accidentally landed in
            // this column), drop the field rather than failing the row.
            if (raw.closed_won_date != null && raw.closed_won_date !== "") {
                const iso = coerceDateToISO(raw.closed_won_date)
                if (iso) raw.closed_won_date = iso
                else delete raw.closed_won_date
            }
            if (raw.closed_lost_date != null && raw.closed_lost_date !== "") {
                const iso = coerceDateToISO(raw.closed_lost_date)
                if (iso) raw.closed_lost_date = iso
                else delete raw.closed_lost_date
            }

            // ── Convert destination_city / destination_venue → destinations JSONB ──
            // Recap rows often pack several cities into one cell
            // ("JAKARTA, SURABAYA", "BANDUNG / LOMBOK"). Split + normalize
            // each so the multi-destination editor in the form picks them up.
            const destCity = raw.destination_city as string | undefined
            const destVenue = raw.destination_venue as string | undefined
            if (destCity && String(destCity).trim()) {
                const parsed = parseDestinations(
                    String(destCity),
                    destVenue ? String(destVenue) : "",
                    optionMap,
                )
                if (parsed.destinations.length > 0) {
                    raw.destinations = parsed.destinations
                    // Form-side gates the destinations editor on event_format
                    // being Onsite/Hybrid. Recap rows rarely fill that
                    // column explicitly, so default to Onsite when we know
                    // there are physical destinations — the editor will
                    // surface the cities to the user instead of hiding them.
                    if (!raw.event_format || (typeof raw.event_format === "string" && !raw.event_format.trim())) {
                        const onsiteOption = optionMap.get("event_format|onsite")
                        raw.event_format = onsiteOption ?? "Onsite"
                    }
                }
                for (const w of parsed.warnings) {
                    warnings.push(`${rowLabel(i, raw)}: ${w}`)
                }
            }
            delete raw.destination_city
            delete raw.destination_venue

            // ── Smart parse event_dates (natural language → ISO array) ──
            const eventDatesRaw = raw.event_dates as string | undefined
            if (eventDatesRaw && typeof eventDatesRaw === "string" && eventDatesRaw.trim()) {
                const dates = parseSmartEventDates(eventDatesRaw)
                if (dates.length > 0) {
                    raw.event_dates = dates
                    // Auto-derive event_date_start and event_date_end from min/max
                    if (!raw.event_date_start) raw.event_date_start = dates[0]
                    if (!raw.event_date_end) raw.event_date_end = dates[dates.length - 1]
                    // Auto-derive month_event for Revenue Recognition.
                    // Uses the END date and respects the company cut-off (matches
                    // form-side logic in lead-form.tsx). Importing a 13-Sept to
                    // 21-Oct event with cutoff 25 should land in October, not
                    // September.
                    if (!raw.month_event) {
                        const me = computeMonthEvent(dates, eventCutoffDay)
                        if (me) raw.month_event = me
                    }
                } else {
                    delete raw.event_dates
                }
            }

            const payload = sanitizePayload(raw)

            // Auto-assign default pipeline stage if not set
            if (!payload.pipeline_stage_id) {
                const cacheKey = payload.pipeline_id ? String(payload.pipeline_id) : "__default__"
                if (!stageCache.has(cacheKey)) {
                    let q = supabase
                        .from("pipeline_stages")
                        .select("id")
                        .order("sort_order", { ascending: true })
                        .limit(1)
                    if (payload.pipeline_id) {
                        q = q.eq("pipeline_id", payload.pipeline_id as string)
                    } else {
                        q = q.eq("is_default", true)
                    }
                    const { data: stageData } = await q.single()
                    if (stageData) stageCache.set(cacheKey, stageData.id)
                }
                const cachedStage = stageCache.get(cacheKey)
                if (cachedStage) payload.pipeline_stage_id = cachedStage
            }

            const { data: insertedData, error } = await supabase.from("leads").insert(payload).select("id")
            if (error) {
                failed++
                errors.push(`${rowLabel(i, raw)}: ${error.message}`)
            } else {
                success++
                if (insertedData?.[0]?.id) {
                    await supabase.from("lead_activities").insert({
                        lead_id: insertedData[0].id,
                        user_id: user?.id ?? null,
                        action_type: "Create",
                        description: "Lead created via Import"
                    })
                }
            }
        } catch (err) {
            failed++
            const projectName = typeof rows[i]?.project_name === "string" ? (rows[i].project_name as string).trim() : ""
            const label = projectName ? `Row ${i + 1} (${projectName})` : `Row ${i + 1}`
            errors.push(`${label}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
    }

    // Audit log — await so the row is durable.
    if (success > 0) {
        await logAuditEvent({
            action: "import",
            resource_type: "lead",
            description: `imported ${success} lead(s)${failed > 0 ? ` (${failed} failed)` : ''}`,
            metadata: { success, failed, total: rows.length, warnings: warnings.length },
        })
    }

    revalidatePath("/", "layout")
    revalidatePath("/leads")
    return { success, failed, errors, warnings }
}

// ── Historical sanitize — allows received_date (and created_at) for backdating ──
function sanitizeHistoricalPayload(data: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(data)) {
        if (val === undefined) continue
        if (RELATIONAL_KEYS.has(key)) continue
        if (key === "id" || key === "updated_at" || key === "manual_id") continue
        // Allow created_at explicitly so backdating still works for rows
        // imported before received_date existed. New imports also set
        // received_date below; we keep created_at in lock-step for
        // historical clarity.
        if (key === "created_at") {
            clean[key] = val === "" ? null : val
            continue
        }
        if (!LEADS_COLUMNS.has(key)) continue
        clean[key] = val === "" ? null : val
    }
    return clean
}

/**
 * Import historical leads with custom received_date (and matching created_at)
 * dates. Uses the service client (admin) to bypass the DEFAULT current_date /
 * NOW() on those columns. Same logic as importLeadsAction but allows
 * backdating.
 */
export async function importHistoricalLeadsAction(
    rows: Record<string, unknown>[]
): Promise<ImportResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const adminClient = createServiceClient()

    let success = 0
    let failed = 0
    const errors: string[] = []
    const warnings: string[] = []
    const { data: allCompanies } = await supabase
        .from("client_companies")
        .select("id, name")
        .order("name")

    const { data: allContacts } = await supabase
        .from("contacts")
        .select("id, full_name, client_company_id")
        .order("full_name")

    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name")

    const { data: allSubsidiaries } = await supabase
        .from("companies")
        .select("id, name, slug")
        .order("name")

    const { data: allStages } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id")
        .order("sort_order")

    const { data: allMasterOptions } = await supabase
        .from("master_options")
        .select("option_type, value")
        .eq("is_active", true)

    // Build lookup maps
    const companyMap = new Map<string, string>()
    for (const c of allCompanies ?? []) companyMap.set(c.name.toLowerCase().trim(), c.id)

    const contactMap = new Map<string, { id: string; client_company_id: string | null }>()
    for (const c of allContacts ?? []) contactMap.set(c.full_name.toLowerCase().trim(), { id: c.id, client_company_id: c.client_company_id })

    const profileMap = new Map<string, string>()
    for (const p of allProfiles ?? []) { if (p.full_name) profileMap.set(p.full_name.toLowerCase().trim(), p.id) }

    const subsidiaryMap = new Map<string, string>()
    for (const s of allSubsidiaries ?? []) {
        subsidiaryMap.set(s.name.toLowerCase().trim(), s.id)
        subsidiaryMap.set(s.slug.toLowerCase().trim(), s.id)
    }

    // Pipeline-scoped only. Identical rationale as importLeadsAction — see
    // comment there. The whole reason this action exists is historical
    // imports go into a non-default pipeline, so unscoped lookups are
    // exactly the wrong default here.
    const stageMap = new Map<string, string>()
    for (const s of allStages ?? []) {
        stageMap.set(`${s.name.toLowerCase().trim()}|${s.pipeline_id}`, s.id)
    }

    const optionMap = new Map<string, string>()
    for (const opt of allMasterOptions ?? []) {
        if (opt?.value) optionMap.set(`${opt.option_type}|${opt.value.toLowerCase().trim()}`, opt.value)
    }

    // Same cut-off resolution as importLeadsAction.
    const cutoffOpt = (allMasterOptions ?? []).find(
        (o) => (o as { option_type?: string; label?: string }).option_type === "system_setting" &&
            (o as { label?: string }).label === "event_cutoff_date",
    )
    const eventCutoffDay = (() => {
        const raw = (cutoffOpt as { value?: string } | undefined)?.value
        const n = raw ? parseInt(raw, 10) : NaN
        return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 25
    })()

    const stageCache = new Map<string, string>()

    for (let i = 0; i < rows.length; i++) {
        try {
            const raw = smartCaseRow({ ...rows[i] }) as Record<string, unknown>

            // ── Validate received_date (required for historical) ──
            // Accept Excel serials, ISO strings, JS-parseable dates. The
            // historical template uses "Received Date" as the canonical
            // header; we still fall back to a stray `created_at` value if
            // the file came from an older template.
            const receivedRaw = (raw.received_date ?? raw.created_at) as unknown
            if (!receivedRaw || (typeof receivedRaw === "string" && !receivedRaw.trim())) {
                failed++
                errors.push(`${rowLabel(i, raw)}: Received Date is required for historical import`)
                continue
            }
            const receivedISO = coerceDateToISO(receivedRaw)
            if (!receivedISO) {
                failed++
                errors.push(`${rowLabel(i, raw)}: Invalid Received Date "${String(receivedRaw)}" — use YYYY-MM-DD format`)
                continue
            }
            const receivedDate = new Date(receivedISO)
            // Store the day on `received_date` (DATE column) and mirror the
            // same instant onto `created_at` so legacy reports keyed on
            // created_at also see the backdated value.
            raw.received_date = receivedISO.slice(0, 10)
            raw.created_at = receivedDate.toISOString()

            // ── Resolve Subsidiary ──
            const subsidiaryName = raw.subsidiary_name as string | undefined
            if (subsidiaryName && String(subsidiaryName).trim()) {
                const subId = subsidiaryMap.get(String(subsidiaryName).toLowerCase().trim())
                if (subId) {
                    raw.company_id = subId
                } else {
                    failed++
                    errors.push(`${rowLabel(i, raw)}: Subsidiary "${subsidiaryName}" not found — lead skipped`)
                    continue
                }
            }
            delete raw.subsidiary_name

            // ── Resolve Pipeline Stage ──
            // Pipeline-scoped only. Auto-determination from closed dates also
            // resolves within the lead's pipeline so we never write a
            // stage_id that lives in a different pipeline.
            const pipeId = raw.pipeline_id as string | undefined
            const stageName = raw.pipeline_stage_name as string | undefined
            if (stageName && String(stageName).trim()) {
                const sNameKey = String(stageName).toLowerCase().trim()
                const stageId = pipeId ? stageMap.get(`${sNameKey}|${pipeId}`) : undefined
                if (stageId) raw.pipeline_stage_id = stageId
            } else if (pipeId) {
                // Auto-determine stage from closed dates — scoped to the lead's pipeline
                if (raw.closed_won_date) {
                    const wonStageId = stageMap.get(`closed won|${pipeId}`)
                    if (wonStageId) raw.pipeline_stage_id = wonStageId
                } else if (raw.closed_lost_date) {
                    const lostStageId =
                        stageMap.get(`closed lost|${pipeId}`) ||
                        stageMap.get(`closed turndown|${pipeId}`)
                    if (lostStageId) raw.pipeline_stage_id = lostStageId
                }
            }
            delete raw.pipeline_stage_name

            // ── Resolve Client Company (auto-create) ──
            const clientCompanyName = raw.client_company_name as string | undefined
            if (clientCompanyName && String(clientCompanyName).trim()) {
                const nameKey = String(clientCompanyName).toLowerCase().trim()
                let companyId = companyMap.get(nameKey)
                if (!companyId) {
                    const { data: newCompany, error: compErr } = await adminClient
                        .from("client_companies")
                        .insert({ name: String(clientCompanyName).trim() })
                        .select("id")
                        .single()
                    if (newCompany && !compErr) {
                        companyId = newCompany.id
                        companyMap.set(nameKey, newCompany.id)
                    }
                }
                if (companyId) raw.client_company_id = companyId
            }
            delete raw.client_company_name

            // ── Resolve Contact (auto-create) ──
            const contactName = raw.contact_name as string | undefined
            if (contactName && String(contactName).trim()) {
                const nameKey = String(contactName).toLowerCase().trim()
                const contact = contactMap.get(nameKey)
                if (contact) {
                    raw.contact_id = contact.id
                    if (!raw.client_company_id && contact.client_company_id) raw.client_company_id = contact.client_company_id
                } else {
                    const contactPayload: Record<string, unknown> = { full_name: String(contactName).trim() }
                    if (raw.client_company_id) contactPayload.client_company_id = raw.client_company_id
                    const { data: newContact, error: cErr } = await adminClient
                        .from("contacts")
                        .insert(contactPayload)
                        .select("id")
                        .single()
                    if (newContact && !cErr) {
                        raw.contact_id = newContact.id
                        contactMap.set(nameKey, { id: newContact.id, client_company_id: (raw.client_company_id as string) || null })
                    }
                }
            }
            delete raw.contact_name

            // ── Resolve PIC Sales (fuzzy, see importLeadsAction) ──
            const picSalesName = raw.pic_sales_name as string | undefined
            if (picSalesName && String(picSalesName).trim()) {
                const match = resolvePicSales(
                    String(picSalesName),
                    (allProfiles ?? []) as ProfileLite[],
                )
                if (match) {
                    raw.pic_sales_id = match.id
                    if (match.matched !== "exact") {
                        warnings.push(
                            `${rowLabel(i, raw)}: PIC Sales "${picSalesName}" matched to "${match.via}" (${match.matched}, ${Math.round(match.confidence * 100)}%)`,
                        )
                    }
                } else {
                    warnings.push(`${rowLabel(i, raw)}: PIC Sales "${picSalesName}" not found — lead will be Unassigned`)
                }
            }
            delete raw.pic_sales_name

            // ── Validate Taxonomic Fields (soft fuzzy match) ──
            const taxonomicFields = ["category", "grade_lead", "lead_source", "main_stream", "stream_type", "business_purpose", "event_format", "area", "lost_reason"]
            for (const field of taxonomicFields) {
                if (raw[field] && typeof raw[field] === "string") {
                    const result = normalizeTaxonomicValue(field, raw[field] as string, optionMap)
                    raw[field] = result.value
                    if (result.warning) {
                        warnings.push(`${rowLabel(i, raw)}: ${result.warning}`)
                    }
                }
            }

            // ── Destinations (split + normalize, see importLeadsAction) ──
            const destCity = raw.destination_city as string | undefined
            const destVenue = raw.destination_venue as string | undefined
            if (destCity && String(destCity).trim()) {
                const parsed = parseDestinations(
                    String(destCity),
                    destVenue ? String(destVenue) : "",
                    optionMap,
                )
                if (parsed.destinations.length > 0) {
                    raw.destinations = parsed.destinations
                    if (!raw.event_format || (typeof raw.event_format === "string" && !raw.event_format.trim())) {
                        const onsiteOption = optionMap.get("event_format|onsite")
                        raw.event_format = onsiteOption ?? "Onsite"
                    }
                }
                for (const w of parsed.warnings) {
                    warnings.push(`${rowLabel(i, raw)}: ${w}`)
                }
            }
            delete raw.destination_city
            delete raw.destination_venue

            // ── Smart parse event_dates ──
            const eventDatesRaw = raw.event_dates as string | undefined
            if (eventDatesRaw && typeof eventDatesRaw === "string" && eventDatesRaw.trim()) {
                const dates = parseSmartEventDates(eventDatesRaw)
                if (dates.length > 0) {
                    raw.event_dates = dates
                    if (!raw.event_date_start) raw.event_date_start = dates[0]
                    if (!raw.event_date_end) raw.event_date_end = dates[dates.length - 1]
                    // End-date based + cutoff-aware. See computeMonthEvent docs.
                    if (!raw.month_event) {
                        const me = computeMonthEvent(dates, eventCutoffDay)
                        if (me) raw.month_event = me
                    }
                } else {
                    delete raw.event_dates
                }
            }

            // ── Parse closed dates (accepts Excel serials too) ──
            if (raw.closed_won_date) {
                const iso = coerceDateToISO(raw.closed_won_date)
                if (iso) raw.closed_won_date = iso
                else delete raw.closed_won_date
            }
            if (raw.closed_lost_date) {
                const iso = coerceDateToISO(raw.closed_lost_date)
                if (iso) raw.closed_lost_date = iso
                else delete raw.closed_lost_date
            }

            // ── Convert actual_value to number (handles "3.090.000") ──
            if (raw.actual_value != null && raw.actual_value !== "") {
                const n = coerceNumber(raw.actual_value)
                if (n !== null) raw.actual_value = n
                else delete raw.actual_value
            }

            const payload = sanitizeHistoricalPayload(raw)

            // Assign default closed stage if no stage was resolved
            // Scoped to the target pipeline if pipeline_id is set
            if (!payload.pipeline_stage_id && payload.pipeline_id) {
                const pipeKey = `__closed_won__|${payload.pipeline_id}`
                if (!stageCache.has(pipeKey)) {
                    const { data: wonStage } = await supabase
                        .from("pipeline_stages")
                        .select("id")
                        .eq("pipeline_id", payload.pipeline_id as string)
                        .ilike("name", "%closed won%")
                        .limit(1)
                        .single()
                    if (wonStage) stageCache.set(pipeKey, wonStage.id)
                }
                const closedWonStage = stageCache.get(pipeKey)
                if (closedWonStage) payload.pipeline_stage_id = closedWonStage
            }
            // Fallback: first stage of the pipeline
            if (!payload.pipeline_stage_id && payload.pipeline_id) {
                const fallbackKey = `__first__|${payload.pipeline_id}`
                if (!stageCache.has(fallbackKey)) {
                    const { data: firstStage } = await supabase
                        .from("pipeline_stages")
                        .select("id")
                        .eq("pipeline_id", payload.pipeline_id as string)
                        .order("sort_order", { ascending: true })
                        .limit(1)
                        .single()
                    if (firstStage) stageCache.set(fallbackKey, firstStage.id)
                }
                const fallbackStage = stageCache.get(fallbackKey)
                if (fallbackStage) payload.pipeline_stage_id = fallbackStage
            }

            // Use admin client to insert with custom received_date / created_at
            const { data: insertedData, error } = await adminClient
                .from("leads")
                .insert(payload)
                .select("id")
            if (error) {
                failed++
                errors.push(`${rowLabel(i, raw)}: ${error.message}`)
            } else {
                success++
                if (insertedData?.[0]?.id) {
                    await adminClient.from("lead_activities").insert({
                        lead_id: insertedData[0].id,
                        user_id: user?.id ?? null,
                        action_type: "Create",
                        description: `Lead created via Historical Import (received: ${receivedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`
                    })
                }
            }
        } catch (err) {
            failed++
            const projectName = typeof rows[i]?.project_name === "string" ? (rows[i].project_name as string).trim() : ""
            const label = projectName ? `Row ${i + 1} (${projectName})` : `Row ${i + 1}`
            errors.push(`${label}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
    }

    // Audit log — await so the row is durable.
    if (success > 0) {
        await logAuditEvent({
            action: "import",
            resource_type: "lead",
            description: `imported ${success} historical lead(s)${failed > 0 ? ` (${failed} failed)` : ''}`,
            metadata: { success, failed, total: rows.length, type: "historical", warnings: warnings.length },
        })
    }

    revalidatePath("/", "layout")
    revalidatePath("/leads")
    return { success, failed, errors, warnings }
}

/**
 * Update a single rich-text field on a lead (general_brief, production_sow,
 * special_remarks) with full audit trail. Used by the inline editor.
 */
export async function updateLeadFieldAction(
    leadId: number,
    fieldPath: string,
    value: string | null,
    label: string
): Promise<ActionResult<{ id: number }>> {
    try {
        // Whitelist: only allow editable rich-text fields
        const ALLOWED_FIELDS = new Set(["general_brief", "production_sow", "special_remarks", "description", "remark"])
        if (!ALLOWED_FIELDS.has(fieldPath)) {
            return { success: false, error: `Field '${fieldPath}' is not allowed` }
        }

        const supabase = await createClient()

        // Fetch old value + lead context for audit
        const { data: existing, error: fetchError } = await supabase
            .from("leads")
            .select(`${fieldPath}, project_name`)
            .eq("id", leadId)
            .single()

        if (fetchError) return { success: false, error: fetchError.message }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldValue = (existing as any)?.[fieldPath] as string | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectName = (existing as any)?.project_name as string | null

        // Update lead
        const { error: updateError } = await supabase
            .from("leads")
            .update({ [fieldPath]: value, updated_at: new Date().toISOString() })
            .eq("id", leadId)

        if (updateError) return { success: false, error: updateError.message }

        // Local timeline (lead_activities) — visible in lead detail Timeline tab
        const { data: { user } } = await supabase.auth.getUser()
        const oldSnippet = (oldValue || "").replace(/<[^>]*>/g, '').slice(0, 120)
        const newSnippet = (value || "").replace(/<[^>]*>/g, '').slice(0, 120)

        await supabase.from("lead_activities").insert({
            lead_id: leadId,
            user_id: user?.id ?? null,
            action_type: "field_update",
            field_name: fieldPath,
            description: `Updated ${label}`,
            old_value: oldSnippet || null,
            new_value: newSnippet || null,
        })

        // Global audit log — visible in /history page
        await logAuditEvent({
            action: "update",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: projectName || "Untitled",
            description: `updated ${label} on lead "${projectName || 'Untitled'}"`,
            metadata: { field: fieldPath },
        })

        revalidatePath(`/leads/${leadId}`)
        return { success: true, data: { id: leadId } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
