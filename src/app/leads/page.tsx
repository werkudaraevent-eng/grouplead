import { LeadDashboard } from "@/components/lead-dashboard"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { scopedQuery } from "@/utils/supabase/scoped-query"

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
    const [supabase, activeCompany] = await Promise.all([
        createClient(),
        getActiveCompany(),
    ])

    const base = supabase.from('leads').select('*, client_company:client_companies!client_company_id(name), contact:contacts!contact_id(full_name, email, phone)').order('created_at', { ascending: false })
    const { data: leads, error } = await scopedQuery(base, activeCompany?.id ?? null)

    if (error) {
        console.error("❌ Supabase Fetch Error:", JSON.stringify(error, null, 2))
    }

    return (
        <div className="p-6 lg:p-8">
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm mb-4">
                    <strong>Database Error:</strong> {error.message}
                </div>
            )}
            <LeadDashboard initialData={leads || []} />
        </div>
    )
}
