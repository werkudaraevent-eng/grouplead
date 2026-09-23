"use server"

import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/require-permission"
import { COMPANY_LIST, type CompanyListRow } from "@/lib/lists/company-list"
import { CONTACT_LIST, type ContactListRow } from "@/lib/lists/contact-list"
import { urlSpecOf, type ListSpec } from "@/lib/lists/list-plan"
import { EXPORT_CAP, runListExport, runListOptions, runListPage, type ListPageResult } from "@/lib/lists/list-queries"
import { parseListState } from "@/lib/lists/list-state"
import type { ActionResult } from "@/types/action-result"

/**
 * Reads for the Contacts and Companies lists: one page, every match for an
 * export, and the choices for the select filters. Search, filters, sort
 * and paging run in the database. The view arrives as the list's own query
 * string and is parsed here with the same parser the page uses, so nothing
 * the URL cannot say reaches a query. The session client is used
 * throughout: row security decides what a person sees, and `scope` (the
 * active business unit, null in the holding view) only narrows it.
 */

// Any 8-4-4-4-12 id, as Postgres stores them; the scope is written into a
// filter term, so nothing else may pass.
const unitId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const input = z.object({
    query: z.string().max(4000),
    scope: unitId.nullable(),
})
const scopeOnly = z.object({ scope: unitId.nullable() })

type ListInput = z.infer<typeof input>
type ScopeInput = z.infer<typeof scopeOnly>

function failure(error: unknown, fallback: string): { success: false; error: string } {
    console.warn("[list-page-actions]", error)
    return { success: false, error: error instanceof Error && error.message ? error.message : fallback }
}

async function page<Row>(module: string, spec: ListSpec<Row>, raw: ListInput): Promise<ActionResult<ListPageResult<Row>>> {
    // Row security is the boundary; the matrix grant is checked first, as
    // every other LeadEngine action does, so a role without Lihat gets a
    // refusal rather than an empty list.
    const guard = await requirePermission(module, "read")
    if (!guard.allowed) return guard.error as { success: false; error: string }
    const parsed = input.safeParse(raw)
    if (!parsed.success) return { success: false, error: "Invalid list request" }
    try {
        const supabase = await createClient()
        const state = parseListState(new URLSearchParams(parsed.data.query), urlSpecOf(spec))
        return { success: true, data: await runListPage(supabase, spec, state, parsed.data.scope) }
    } catch (error) {
        return failure(error, "The list could not be loaded")
    }
}

async function exportRows<Row>(module: string, spec: ListSpec<Row>, raw: ListInput): Promise<ActionResult<{ rows: Row[]; total: number; cap: number }>> {
    // Row security is the boundary; the matrix grant is checked first, as
    // every other LeadEngine action does, so a role without Lihat gets a
    // refusal rather than an empty list.
    const guard = await requirePermission(module, "read")
    if (!guard.allowed) return guard.error as { success: false; error: string }
    const parsed = input.safeParse(raw)
    if (!parsed.success) return { success: false, error: "Invalid export request" }
    try {
        const supabase = await createClient()
        // Page and size are ignored: an export is every match, in the list's order.
        const state = { ...parseListState(new URLSearchParams(parsed.data.query), urlSpecOf(spec)), page: 0 }
        const { rows, total } = await runListExport(supabase, spec, state, parsed.data.scope)
        return { success: true, data: { rows, total, cap: EXPORT_CAP } }
    } catch (error) {
        return failure(error, "The export could not be prepared")
    }
}

async function options<Row>(module: string, spec: ListSpec<Row>, raw: ScopeInput): Promise<ActionResult<Record<string, string[]>>> {
    // Row security is the boundary; the matrix grant is checked first, as
    // every other LeadEngine action does, so a role without Lihat gets a
    // refusal rather than an empty list.
    const guard = await requirePermission(module, "read")
    if (!guard.allowed) return guard.error as { success: false; error: string }
    const parsed = scopeOnly.safeParse(raw)
    if (!parsed.success) return { success: false, error: "Invalid request" }
    try {
        const supabase = await createClient()
        return { success: true, data: await runListOptions(supabase, spec, parsed.data.scope) }
    } catch (error) {
        return failure(error, "The filter choices could not be loaded")
    }
}

export async function listContactsPageAction(raw: ListInput): Promise<ActionResult<ListPageResult<ContactListRow>>> {
    return page("contacts", CONTACT_LIST, raw)
}

export async function exportContactsAction(raw: ListInput): Promise<ActionResult<{ rows: ContactListRow[]; total: number; cap: number }>> {
    return exportRows("contacts", CONTACT_LIST, raw)
}

export async function contactFilterOptionsAction(raw: ScopeInput): Promise<ActionResult<Record<string, string[]>>> {
    return options("contacts", CONTACT_LIST, raw)
}

export async function listCompaniesPageAction(raw: ListInput): Promise<ActionResult<ListPageResult<CompanyListRow>>> {
    return page("companies", COMPANY_LIST, raw)
}

export async function exportCompaniesAction(raw: ListInput): Promise<ActionResult<{ rows: CompanyListRow[]; total: number; cap: number }>> {
    return exportRows("companies", COMPANY_LIST, raw)
}

export async function companyFilterOptionsAction(raw: ScopeInput): Promise<ActionResult<Record<string, string[]>>> {
    return options("companies", COMPANY_LIST, raw)
}
