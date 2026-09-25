import type { SupabaseClient } from "@supabase/supabase-js"

export interface AssignableUser {
    id: string
    full_name: string
    avatar_url: string | null
}

/**
 * The active people work in a business unit can be given to, by name: its
 * members, and with `includeHolding` the members of a holding company too,
 * who see every unit's records (`fn_user_has_holding_access()`, the same
 * rule the record's row security reads).
 *
 * Read with the service client, because row security on `company_members`
 * shows a person only their own memberships; every caller checks the
 * session, and that the caller can see the record, before asking. Falls
 * back to every active profile when the unit is unknown or has no members
 * yet, so the picker is never empty where memberships were never set up.
 * Used by a lead's tasks (`listAssignableUsersForLeadAction`) and a
 * contact's or company's follow-ups (`listRecordAssigneesAction`).
 */
export async function assignableUsersForUnit(
    admin: SupabaseClient,
    companyId: string | null,
    { includeHolding = false }: { includeHolding?: boolean } = {},
): Promise<AssignableUser[]> {
    const fetchAllActive = async (): Promise<AssignableUser[]> => {
        const { data, error } = await admin
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("is_active", true)
            .order("full_name")
        if (error) {
            console.error("[assignable-users] fetch all active profiles error:", error.message)
            return []
        }
        return (data ?? []).filter((u): u is AssignableUser => Boolean(u.full_name))
    }

    if (!companyId) return fetchAllActive()

    let unitIds = [companyId]
    if (includeHolding) {
        const { data: holdings, error: holdingErr } = await admin.from("companies").select("id").eq("is_holding", true)
        if (holdingErr) console.error("[assignable-users] fetch holding units error:", holdingErr.message)
        unitIds = [...new Set([companyId, ...(holdings ?? []).map((unit) => unit.id as string)])]
    }

    const { data: members, error: memberErr } = await admin
        .from("company_members")
        .select("user_id")
        .in("company_id", unitIds)

    if (memberErr) {
        console.error("[assignable-users] fetch members error:", memberErr.message)
        return fetchAllActive()
    }

    const ids = [...new Set((members ?? []).map((m) => m.user_id as string).filter(Boolean))]
    if (ids.length === 0) {
        // No memberships provisioned for this unit yet: degrade gracefully
        // instead of returning an empty list.
        return fetchAllActive()
    }

    const { data: profiles, error: profErr } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids)
        .eq("is_active", true)
        .order("full_name")

    if (profErr) {
        console.error("[assignable-users] fetch profiles error:", profErr.message)
        return fetchAllActive()
    }

    const scoped = (profiles ?? []).filter((u): u is AssignableUser => Boolean(u.full_name))
    // Defensive: if the join produced zero usable rows (e.g. all members
    // have null full_name), fall back to all active profiles.
    return scoped.length > 0 ? scoped : fetchAllActive()
}
