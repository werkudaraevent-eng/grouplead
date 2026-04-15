"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { smartCaseRow } from "@/utils/smart-title-case"
import { parseSmartEventDates } from "@/utils/smart-date-parser"
import { buildStageTransitionAuditEntries } from "@/features/leads/lib/stage-transition-audit"

export type ActionResult = { success: boolean; error?: string; data?: { id: number } }

// ── Column Whitelist: ONLY these keys are physical columns on the `leads` table ──
const LEADS_COLUMNS = new Set([
    "category", "event_date_start", "project_name", "grade_lead", "stream_type",
    "business_purpose", "tipe", "pax_count", "nationality", "status",
    "cancel_lost_reason", "date_cancel_lost", "month_cancel_lost", "sector",
    "line_industry", "area", "is_qualified", "lead_source", "referral_source",
    "estimated_value", "remark", "company_id", "client_company_id", "contact_id",
    "pic_sales_id", "account_manager_id", "pipeline_stage_id", "event_date_end",
    "actual_value", "event_format", "target_close_date", "description",
    "virtual_platform", "main_stream", "destinations", "pipeline_id",
    "custom_data", "general_brief", "production_sow", "special_remarks", "event_dates", "month_event",
    "kanban_sort_order", "lost_reason", "lost_reason_details"
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
): Promise<ActionResult> {
    try {
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

        const { data: newLead, error } = await supabase
            .from("leads")
            .insert(payload)
            .select("id")
            .single()
        if (error) return { success: false, error: error.message }

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
        const supabase = await createClient()
        const payload = sanitizePayload(data)

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
    sortOrder?: number
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
                .select("estimated_value, pipeline_stage:pipeline_stages!pipeline_stage_id(name)")
                .eq("id", leadId)
                .single(),
            supabase
                .from("pipeline_stages")
                .select("id, name")
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

        const payload: {
            pipeline_stage_id: string
            status: string
            updated_at: string
            kanban_sort_order?: number
        } = {
            pipeline_stage_id: stageId,
            status: stageRow.name,
            updated_at: new Date().toISOString(),
        }
        if (sortOrder !== undefined) {
            payload.kanban_sort_order = sortOrder
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
        const supabase = await createClient()

        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

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

export type ImportResult = { success: number; failed: number; errors: string[] }

export async function importLeadsAction(
    rows: Record<string, unknown>[]
): Promise<ImportResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    let success = 0
    let failed = 0
    const errors: string[] = []

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

    // Build stage lookup: "stageName|pipelineId" → stageId
    const stageMap = new Map<string, string>()
    for (const s of allStages ?? []) {
        stageMap.set(`${s.name.toLowerCase().trim()}|${s.pipeline_id}`, s.id)
        // Also store without pipeline scope for general matching
        if (!stageMap.has(s.name.toLowerCase().trim())) {
            stageMap.set(s.name.toLowerCase().trim(), s.id)
        }
    }

    // Build option map: "option_type|lowercase_value" -> "exact_value"
    const optionMap = new Map<string, string>()
    for (const opt of allMasterOptions ?? []) {
        if (opt?.value) {
            optionMap.set(`${opt.option_type}|${opt.value.toLowerCase().trim()}`, opt.value)
        }
    }

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
                    errors.push(`Row ${i + 1}: Subsidiary "${subsidiaryName}" not found — lead skipped`)
                    delete raw.subsidiary_name
                    continue
                }
            }
            delete raw.subsidiary_name

            // ── Resolve Pipeline Stage name → pipeline_stage_id ──
            const stageName = raw.pipeline_stage_name as string | undefined
            if (stageName && String(stageName).trim()) {
                const sNameKey = String(stageName).toLowerCase().trim()
                // Try pipeline-scoped match first, then general match
                const pipelineId = raw.pipeline_id as string | undefined
                const scopedKey = pipelineId ? `${sNameKey}|${pipelineId}` : null
                const stageId = (scopedKey ? stageMap.get(scopedKey) : null) || stageMap.get(sNameKey)
                if (stageId) {
                    raw.pipeline_stage_id = stageId
                } else {
                    errors.push(`Row ${i + 1}: Stage "${stageName}" not found — default stage will be applied`)
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
                        errors.push(`Row ${i + 1}: Failed to create company "${clientCompanyName}" — ${compErr?.message}`)
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
                        errors.push(`Row ${i + 1}: Failed to create contact "${contactName}" — ${cErr?.message}`)
                    }
                }
            }
            delete raw.contact_name

            // ── Resolve PIC Sales name → ID (must already exist as user) ──
            const picSalesName = raw.pic_sales_name as string | undefined
            if (picSalesName && String(picSalesName).trim()) {
                const profileId = profileMap.get(String(picSalesName).toLowerCase().trim())
                if (profileId) {
                    raw.pic_sales_id = profileId
                } else {
                    errors.push(`Row ${i + 1}: PIC Sales "${picSalesName}" not found (must be an existing user)`)
                }
            }
            delete raw.pic_sales_name

            // ── Validate and Auto-Correct Taxonomic Fields against Master Options ──
            const taxonomicFields = [
                "category", "grade_lead", "lead_source",
                "main_stream", "stream_type", "business_purpose", "event_format",
                "area"
            ]
            for (const field of taxonomicFields) {
                if (raw[field] && typeof raw[field] === "string") {
                    const val = (raw[field] as string).trim()
                    if (val) {
                        const exactMatch = optionMap.get(`${field}|${val.toLowerCase()}`)
                        if (exactMatch) {
                            raw[field] = exactMatch // Auto-correct to exactly match the DB
                        } else {
                            throw new Error(`Invalid ${field.replace("_", " ")} "${val}" — must exactly match an available option in settings.`)
                        }
                    }
                }
            }

            // ── Convert destination_city / destination_venue → destinations JSONB ──
            const destCity = raw.destination_city as string | undefined
            const destVenue = raw.destination_venue as string | undefined
            if (destCity && String(destCity).trim()) {
                raw.destinations = [{ city: String(destCity).trim(), venue: destVenue ? String(destVenue).trim() : "" }]
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
                    // Auto-derive month_event for Revenue Recognition
                    if (!raw.month_event) {
                        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
                        const firstDate = new Date(dates[0])
                        raw.month_event = `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`
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
                errors.push(`Row ${i + 1}: ${error.message}`)
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
            errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
    }

    revalidatePath("/", "layout")
    revalidatePath("/leads")
    return { success, failed, errors }
}
