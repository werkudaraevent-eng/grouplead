import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { scopedQuery } from "@/utils/supabase/scoped-query"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const [supabase, activeCompany] = await Promise.all([
        createClient(),
        getActiveCompany(),
    ])

    const base = supabase.from('leads').select('*').order('updated_at', { ascending: false })
    const { data: leads, error } = await scopedQuery(base, activeCompany?.id ?? null)

    return (
        <div className="flex-1 p-8 pt-6">
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm mb-4">
                    <strong>Database Error:</strong> {error.message}
                </div>
            )}
            <AnalyticsDashboard leads={leads || []} />
        </div>
    )
}
