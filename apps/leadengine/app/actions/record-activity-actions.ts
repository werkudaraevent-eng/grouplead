"use server"

import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { assignableUsersForUnit, type AssignableUser } from "@/lib/assignable-users"
import type { ActionResult } from "@/types/action-result"

const recordInput = z.object({
    kind: z.enum(["contact", "company"]),
    recordId: z.string().trim().min(1).max(64),
})

/**
 * Who a follow-up on a contact or a company can be assigned to: the people
 * who can see the record's business unit (its members and a holding
 * company's), by name, with the person asking always among them. The
 * record is read as the caller first, under its row security, so someone
 * who cannot see the record learns nobody. `contacts.company_id` and
 * `client_companies.company_id` are the tenant's unit (`companies`), never
 * the client company.
 */
export async function listRecordAssigneesAction(
    kind: "contact" | "company",
    recordId: string,
): Promise<ActionResult<AssignableUser[]>> {
    const parsed = recordInput.safeParse({ kind, recordId })
    if (!parsed.success) return { success: false, error: "Invalid record" }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be signed in" }

    const table = parsed.data.kind === "contact" ? "contacts" : "client_companies"
    const { data: record, error } = await supabase
        .from(table)
        .select("company_id")
        .eq("id", parsed.data.recordId)
        .maybeSingle()
    if (error || !record) return { success: false, error: "Record not found" }

    const users = await assignableUsersForUnit(createServiceClient(), (record.company_id as string | null) ?? null, { includeHolding: true })

    if (!users.some((person) => person.id === user.id)) {
        const { data: me } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle()
        if (me?.full_name) {
            users.push({ id: me.id as string, full_name: me.full_name as string, avatar_url: (me.avatar_url as string | null) ?? null })
            users.sort((a, b) => a.full_name.localeCompare(b.full_name))
        }
    }

    return { success: true, data: users }
}
