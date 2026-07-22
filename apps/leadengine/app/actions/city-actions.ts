"use server"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import type { ActionResult } from "@/types/action-result"

/**
 * Caches a city chosen from the GeoNames autocomplete into `master_options`
 * (option_type = "event_city") so the dropdown stays "always up to date"
 * while analytics/breakdowns keep grouping on a stable, DB-backed value.
 *
 * Idempotent: a case-insensitive match on an existing active row is a no-op.
 * Re-activates a previously archived city instead of creating a duplicate.
 *
 * Cities are GLOBAL reference data → company_id stays NULL (matches the
 * seeded event_city rows). RLS lets all authenticated users read them.
 */
export async function upsertEventCityAction(
    label: string,
    country?: string | null,
): Promise<ActionResult<{ value: string }>> {
    const value = label.trim()
    if (!value) return { success: false, error: "City is required" }

    // Auth gate — only signed-in users may seed reference data.
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const svc = createServiceClient()

    // Case-insensitive existence check across active + archived global rows.
    const { data: existing } = await svc
        .from("master_options")
        .select("id, is_active")
        .eq("option_type", "event_city")
        .is("company_id", null)
        .ilike("value", value)
        .limit(1)
        .maybeSingle()

    if (existing) {
        // Re-activate if it had been archived; otherwise nothing to do.
        if (existing.is_active === false) {
            await svc
                .from("master_options")
                .update({ is_active: true })
                .eq("id", existing.id)
        }
        return { success: true, data: { value } }
    }

    // Append to the end of the list (highest sort_order + 1).
    const { data: maxRow } = await svc
        .from("master_options")
        .select("sort_order")
        .eq("option_type", "event_city")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()
    const nextSort = (maxRow?.sort_order ?? -1) + 1

    const { error } = await svc.from("master_options").insert({
        option_type: "event_city",
        label: value,
        value,
        is_active: true,
        company_id: null,
        sort_order: nextSort,
        metadata: country ? { country } : {},
    })

    if (error) return { success: false, error: error.message }
    return { success: true, data: { value } }
}
