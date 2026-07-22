import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Allowed Account Status values for a lead. Mirrors the master_options
 * convention used elsewhere in the codebase (lower-case keys, capitalized
 * for display).
 */
export type AccountStatus = "new" | "repeater" | "contracted"

export const ACCOUNT_STATUS_VALUES: readonly AccountStatus[] = [
    "new",
    "repeater",
    "contracted",
] as const

/**
 * Result of computing an account status for a brand new lead.
 *
 *  - `value` is what to write into `leads.account_status`.
 *  - `reason` describes why that value was picked, suitable for showing to
 *    a sales rep in a small UI hint ("Auto-detected from PT Roche history
 *    — 3 prior leads, 1 closed won").
 */
export interface AccountStatusComputation {
    value: AccountStatus
    reason: string
    /** Number of prior leads found at this client_company. */
    priorLeadCount: number
    /** Number of prior leads in a Closed Won stage. */
    closedWonCount: number
    /** True if the company itself is flagged Contracted. */
    companyIsContracted: boolean
}

/**
 * Computes the suggested Account Status for a lead in the given company.
 *
 * Rules (in order):
 *   1. If the client_company itself is flagged "contracted" → "contracted".
 *      Contracted is a legal status that requires a human (the company PIC)
 *      to set; the system never derives it from history.
 *   2. If the company has at least one prior lead in a Closed Won stage →
 *      "repeater".
 *   3. Otherwise → "new".
 *
 * If `clientCompanyId` is null the function returns "new" with a generic
 * reason — callers should still allow the user to override.
 */
export async function computeAccountStatus(
    supabase: SupabaseClient,
    clientCompanyId: string | null,
): Promise<AccountStatusComputation> {
    if (!clientCompanyId) {
        return {
            value: "new",
            reason: "No client company selected yet",
            priorLeadCount: 0,
            closedWonCount: 0,
            companyIsContracted: false,
        }
    }

    // Pull the company's own status + a slim window of prior leads in one
    // round-trip rather than two so the create flow stays snappy.
    const [{ data: company }, { data: priorLeads }] = await Promise.all([
        supabase
            .from("client_companies")
            .select("account_status")
            .eq("id", clientCompanyId)
            .maybeSingle(),
        supabase
            .from("leads")
            .select("id, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
            .eq("client_company_id", clientCompanyId),
    ])

    const companyStatus = (company?.account_status ?? "").toLowerCase()
    const companyIsContracted = companyStatus === "contracted"

    const leads = priorLeads ?? []
    const priorLeadCount = leads.length
    const closedWonCount = leads.filter((l) => {
        const stage = l.pipeline_stage as unknown as { closed_status: string | null } | null
        return stage?.closed_status === "won"
    }).length

    if (companyIsContracted) {
        return {
            value: "contracted",
            reason: "Company is flagged as Contracted",
            priorLeadCount,
            closedWonCount,
            companyIsContracted: true,
        }
    }

    if (closedWonCount > 0) {
        return {
            value: "repeater",
            reason: `${closedWonCount} prior closed-won deal${closedWonCount === 1 ? "" : "s"} at this company`,
            priorLeadCount,
            closedWonCount,
            companyIsContracted: false,
        }
    }

    return {
        value: "new",
        reason:
            priorLeadCount > 0
                ? `${priorLeadCount} prior lead${priorLeadCount === 1 ? "" : "s"} but none closed won yet`
                : "No prior history with this company",
        priorLeadCount,
        closedWonCount,
        companyIsContracted: false,
    }
}
